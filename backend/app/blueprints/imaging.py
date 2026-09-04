import os
import uuid
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from backend.app.extensions import db
from backend.app.models import User, DiagnosticScan, Appointment, AppointmentStatus
from backend.app.services import MedicalVisionService, QwenClinicalService
from backend.app.utils import role_required, ok, fail, write_audit

imaging_bp = Blueprint("imaging", __name__)


def _current_user():
    identity = get_jwt_identity()
    return User.query.filter_by(public_id=identity).first()


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in {"png", "jpg", "jpeg", "dcm", "webp"}


@imaging_bp.route("/upload", methods=["POST"])
@jwt_required()
@role_required("LabTech", "Doctor")
def upload():
    user = _current_user()

    if "file" not in request.files:
        return fail("VALIDATION_ERROR", "No file provided.")

    file = request.files["file"]
    patient_id = request.form.get("patient_id", type=int)
    scan_type = request.form.get("scan_type", "").strip()

    if not patient_id:
        return fail("VALIDATION_ERROR", "patient_id is required.")
    if not file or file.filename == "":
        return fail("VALIDATION_ERROR", "No file selected.")
    if not _allowed_file(file.filename):
        return fail("VALIDATION_ERROR", "Allowed formats: png, jpg, jpeg, dcm, webp.")
    st_upper = scan_type.upper().replace(" ", "").replace("-", "")
    if st_upper in {"XRAY"}:
        scan_type = "X-Ray"
    elif st_upper in {"MRI"}:
        scan_type = "MRI"
    elif st_upper in {"CT", "CTSCAN"}:
        scan_type = "CT"
    elif st_upper in {"ULTRASOUND"}:
        scan_type = "Ultrasound"
    else:
        return fail("VALIDATION_ERROR", "scan_type must be X-Ray, MRI, CT, or Ultrasound.")

    ext = secure_filename(file.filename).rsplit(".", 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], unique_name)
    file.save(filepath)

    vision_service = current_app.extensions.get("vision_service")
    if vision_service is None:
        vision_service = MedicalVisionService()
        current_app.extensions["vision_service"] = vision_service

    inference = vision_service.analyze_scan(filepath)

    scan = DiagnosticScan(
        patient_id=patient_id,
        uploaded_by=user.id,
        scan_type=scan_type,
        file_path=filepath,
    )
    scan.set_inference_results(inference)
    scan.confidence_score = inference.get("max_confidence")

    db.session.add(scan)
    db.session.commit()

    write_audit(user.id, user.role, patient_id, "UPLOAD_SCAN")

    # Auto-generate AI recommendations if tumors/anomalies detected
    detections = inference.get("detections", [])
    ai_recommendations = None
    if detections and len(detections) > 0:
        try:
            patient = User.query.get(patient_id)
            scan_flags = {
                "scan_type": scan_type,
                "flags": detections,
                "is_normal": False,
            }
            
            clinical_history = f"Patient: {patient.full_name if patient else 'Unknown'}. Scan Type: {scan_type}."
            vitals_summary = "(Vitals not currently integrated)"
            latest_scans = f"{scan_type} scan uploaded at {scan.uploaded_at.isoformat()}"
            
            qwen_service = QwenClinicalService()
            ai_recommendations = qwen_service.generate_clinical_overview(
                patient_id=patient_id,
                clinical_history=clinical_history,
                vitals_summary=vitals_summary,
                latest_scans=latest_scans,
                scan_flags=scan_flags,
            )
        except Exception as e:
            # Log error but don't fail the upload
            print(f"Warning: Failed to generate AI recommendations: {str(e)}")

    return ok({
        "scan": scan.to_dict(),
        "inference": inference,
        "ai_recommendations": ai_recommendations,
    }), 201


@imaging_bp.route("/patient/<int:patient_id>/scans", methods=["GET"])
@jwt_required()
@role_required("Doctor", "LabTech", "Admin", "Patient")
def patient_scans(patient_id):
    user = _current_user()
    if user.role == "Patient" and user.id != patient_id:
        return fail("FORBIDDEN", "You can only view your own scans.", 403)
    scans = DiagnosticScan.query.filter_by(patient_id=patient_id).order_by(DiagnosticScan.uploaded_at.desc()).all()
    return ok([s.to_dict() for s in scans])


@imaging_bp.route("/scan/<int:scan_id>", methods=["GET"])
@jwt_required()
@role_required("Doctor", "LabTech", "Admin")
def scan_detail(scan_id):
    user = _current_user()
    scan = DiagnosticScan.query.get_or_404(scan_id)
    write_audit(user.id, user.role, scan.patient_id, "INSPECT_SCAN")
    return ok(scan.to_dict())


@imaging_bp.route("/scan/<int:scan_id>/generate-ai-recommendations", methods=["POST"])
@jwt_required()
@role_required("Doctor", "LabTech", "Admin")
def generate_ai_recommendations(scan_id):
    """Generate AI clinical recommendations for detected tumors/anomalies in a scan."""
    user = _current_user()
    scan = DiagnosticScan.query.get_or_404(scan_id)
    
    # Get inference results (detected tumors)
    inference = scan.get_inference_results()
    
    # Check if there are any detections
    detections = inference.get("detections", [])
    if not detections:
        return ok({
            "message": "No anomalies detected in this scan.",
            "clinical_recommendations": {},
            "scan_id": scan_id,
        })
    
    # Prepare scan flags for Qwen
    scan_flags = {
        "scan_type": scan.scan_type,
        "flags": detections,
        "is_normal": len(detections) == 0,
    }
    
    # Get patient info for context
    patient = User.query.get(scan.patient_id)
    clinical_history = f"Patient: {patient.full_name if patient else 'Unknown'}. Scan Type: {scan.scan_type}."
    vitals_summary = "(Vitals not currently integrated)"
    latest_scans = f"{scan.scan_type} scan uploaded at {scan.uploaded_at.isoformat()}"
    
    # Generate clinical recommendations using Qwen
    qwen_service = QwenClinicalService()
    recommendations = qwen_service.generate_clinical_overview(
        patient_id=scan.patient_id,
        clinical_history=clinical_history,
        vitals_summary=vitals_summary,
        latest_scans=latest_scans,
        scan_flags=scan_flags,
    )
    
    # Store recommendations in the database
    scan.set_clinical_recommendations(recommendations)
    db.session.commit()
    
    write_audit(user.id, user.role, scan.patient_id, "GENERATE_AI_RECOMMENDATIONS")
    
    return ok({
        "scan_id": scan_id,
        "clinical_recommendations": recommendations,
    }), 201


@imaging_bp.route("/scan/<int:scan_id>/file", methods=["GET"])
@jwt_required()
@role_required("Doctor", "LabTech", "Admin", "Patient")
def scan_file(scan_id):
    user = _current_user()
    scan = DiagnosticScan.query.get_or_404(scan_id)
    if user.role == "Patient" and scan.patient_id != user.id:
        return fail("FORBIDDEN", "You can only view your own scans.", 403)
    if not os.path.exists(scan.file_path):
        return fail("NOT_FOUND", "Scan file not found.", 404)
    return send_file(os.path.abspath(scan.file_path))


@imaging_bp.route("/lab-stats", methods=["GET"])
@jwt_required()
@role_required("LabTech", "Doctor", "Admin")
def lab_stats():
    today = datetime.now(timezone.utc).date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    # Today's scans
    todays_scans = DiagnosticScan.query.filter(
        DiagnosticScan.uploaded_at >= today_start
    ).all()

    # AI flagged vs cleared (today)
    ai_flagged = 0
    ai_cleared = 0
    awaiting_analysis = 0
    for s in todays_scans:
        inf = s.get_inference_results()
        if not inf or inf.get("status") == "MODEL_UNAVAILABLE":
            awaiting_analysis += 1
        elif inf.get("detections_count", 0) > 0:
            ai_flagged += 1
        else:
            ai_cleared += 1

    # Pending appointments as proxy for pending test orders
    pending_orders = Appointment.query.filter_by(
        status=AppointmentStatus.PENDING
    ).count()

    # Emergency / STAT orders — derive from InConsultation with high-priority heuristic
    stat_orders = Appointment.query.filter_by(
        status=AppointmentStatus.IN_CONSULTATION
    ).count()

    # Average turnaround (minutes) — avg time from appointment created to scan uploaded today
    tat_values = []
    for s in todays_scans:
        appt = Appointment.query.filter_by(
            patient_id=s.patient_id,
        ).order_by(Appointment.created_at.desc()).first()
        if appt and appt.created_at and s.uploaded_at:
            delta = (s.uploaded_at - appt.created_at).total_seconds() / 60
            if delta > 0:
                tat_values.append(delta)
    avg_tat = round(sum(tat_values) / len(tat_values)) if tat_values else 0

    return ok({
        "pending_orders": pending_orders,
        "stat_orders": stat_orders,
        "scans_today": len(todays_scans),
        "ai_flagged": ai_flagged,
        "ai_cleared": ai_cleared,
        "awaiting_analysis": awaiting_analysis,
        "avg_turnaround_min": avg_tat,
    })


@imaging_bp.route("/recent-scans", methods=["GET"])
@jwt_required()
@role_required("LabTech", "Doctor", "Admin")
def recent_scans():
    """List recent scans with AI status."""
    limit = request.args.get("limit", 20, type=int)
    scans = DiagnosticScan.query.order_by(
        DiagnosticScan.uploaded_at.desc()
    ).limit(limit).all()

    result = []
    for s in scans:
        patient = User.query.get(s.patient_id)
        inf = s.get_inference_results()

        # Determine AI status
        if not inf or inf.get("status") == "MODEL_UNAVAILABLE":
            ai_status = "Awaiting Analysis"
        elif inf.get("detections_count", 0) > 0:
            ai_status = "AI Flagged"
        else:
            ai_status = "AI Cleared"

        result.append({
            "id": s.id,
            "patient_id": s.patient_id,
            "patient_name": patient.full_name if patient else "Unknown",
            "scan_type": s.scan_type,
            "confidence_score": s.confidence_score,
            "ai_status": ai_status,
            "uploaded_at": s.uploaded_at.isoformat() + "Z" if s.uploaded_at else None,
        })
    return ok(result)

@imaging_bp.route("/patients", methods=["GET"])
@jwt_required()
@role_required("LabTech", "Doctor", "Admin")
def patients_with_scans():
    """List patients whose folder has scans or prescriptions."""
    from sqlalchemy import func
    from backend.app.models import EncounterNote, Prescription

    scan_counts = dict(db.session.query(
        DiagnosticScan.patient_id,
        func.count(DiagnosticScan.id),
    ).group_by(DiagnosticScan.patient_id).all())
    prescription_counts = dict(db.session.query(
        EncounterNote.patient_id,
        func.count(Prescription.id),
    ).join(Prescription, Prescription.encounter_id == EncounterNote.id)
      .group_by(EncounterNote.patient_id).all())

    patients = []
    for patient in User.query.filter_by(role="Patient").all():
        scan_count = scan_counts.get(patient.id, 0)
        prescription_count = prescription_counts.get(patient.id, 0)
        if not scan_count and not prescription_count:
            continue

        latest = DiagnosticScan.query.filter_by(
            patient_id=patient.id
        ).order_by(DiagnosticScan.uploaded_at.desc()).first()
        patients.append({
            "id": patient.id,
            "portal_id": patient.portal_id,
            "name": patient.full_name,
            "email": patient.email,
            "scan_count": scan_count,
            "prescription_count": prescription_count,
            "last_scan": latest.uploaded_at.isoformat() + "Z" if latest and latest.uploaded_at else None,
        })

    patients.sort(key=lambda p: (p["scan_count"] + p["prescription_count"]), reverse=True)
    return ok(patients)


@imaging_bp.route("/patient/<int:patient_id>/folder", methods=["GET"])
@jwt_required()
@role_required("LabTech", "Doctor", "Admin")
def patient_folder(patient_id):
    """Complete patient folder: scans with image URLs + prescriptions."""
    patient = User.query.get_or_404(patient_id)
    
    # Only allow access to actual patients
    if patient.role != "Patient":
        return fail("VALIDATION_ERROR", f"User {patient.full_name} is a {patient.role}, not a patient.", 400)

    scans = DiagnosticScan.query.filter_by(
        patient_id=patient_id
    ).order_by(DiagnosticScan.uploaded_at.desc()).all()

    scan_list = []
    for s in scans:
        inf = s.get_inference_results()
        scan_list.append({
            "id": s.id,
            "scan_type": s.scan_type,
            "file_url": f"/api/imaging/scan/{s.id}/file",
            "confidence_score": s.confidence_score,
            "ai_inference": inf,
            "uploaded_at": s.uploaded_at.isoformat() + "Z" if s.uploaded_at else None,
        })

    # Fetch prescriptions from encounter notes
    from backend.app.models import EncounterNote, Prescription
    encounters = EncounterNote.query.filter_by(
        patient_id=patient_id
    ).order_by(EncounterNote.created_at.desc()).all()

    prescriptions = []
    for enc in encounters:
        doctor = User.query.get(enc.doctor_id)
        rx_list = Prescription.query.filter_by(encounter_id=enc.id).all()
        for rx in rx_list:
            prescriptions.append({
                "id": rx.id,
                "drug_name": rx.drug_name,
                "dose": rx.dose,
                "frequency": rx.frequency,
                "duration": rx.duration,
                "download_url": f"/api/emr/prescription/{rx.id}/download",
                "prescribed_at": enc.created_at.isoformat() + "Z" if enc.created_at else None,
                "doctor_id": enc.doctor_id,
                "doctor_name": doctor.full_name if doctor else "Doctor",
            })

    return ok({
        "patient": {
            "id": patient.id,
            "portal_id": patient.portal_id,
            "name": patient.full_name,
            "email": patient.email,
        },
        "scans": scan_list,
        "prescriptions": prescriptions,
    })
