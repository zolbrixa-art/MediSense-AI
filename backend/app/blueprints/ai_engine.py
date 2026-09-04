from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.app.extensions import db
from backend.app.models import User, Appointment, AppointmentStatus, EncounterNote, VitalReading, DiagnosticScan, Prescription
from backend.app.services import QwenClinicalService
from backend.app.utils import role_required, ok, fail, write_audit

ai_engine_bp = Blueprint("ai_engine", __name__)


def _current_user():
    identity = get_jwt_identity()
    return User.query.filter_by(public_id=identity).first()


def _assert_active_consultation(doctor_id: int, patient_id: int) -> bool:
    return Appointment.query.filter_by(
        doctor_id=doctor_id,
        patient_id=patient_id,
        status=AppointmentStatus.IN_CONSULTATION,
    ).first() is not None


def _assemble_context(patient_id: int) -> tuple[str, str, str, dict]:
    # Last 3 encounters (signed or unsigned)
    encounters = EncounterNote.query.filter_by(patient_id=patient_id).order_by(
        EncounterNote.created_at.desc()
    ).limit(3).all()

    encounter_texts = []
    for enc in encounters:
        rxs = Prescription.query.filter_by(encounter_id=enc.id).all()
        rx_text = "\n".join(
            f"- {p.drug_name} {p.dose or ''} {p.frequency or ''} {p.duration or ''}".strip()
            for p in rxs
        )
        encounter_texts.append(
            f"Encounter ({enc.created_at.date()}):\n"
            f"Subjective: {enc.subjective or 'N/A'}\n"
            f"Assessment: {enc.assessment or 'N/A'}\n"
            f"Plan: {enc.plan or 'N/A'}\n"
            f"Prescriptions:\n{rx_text or 'None'}"
        )
    clinical_history = "\n\n".join(encounter_texts) or "No prior encounters on record."

    # 24h vitals
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    vitals = VitalReading.query.filter(
        VitalReading.patient_id == patient_id,
        VitalReading.recorded_at >= since,
    ).order_by(VitalReading.recorded_at.desc()).all()

    vitals_summary = "\n".join(
        f"- {v.recorded_at}: HR {v.heart_rate or 'N/A'} BPM, SpO2 {v.spo2 or 'N/A'}%, "
        f"Temp {v.temperature_f or 'N/A'}°F, Alert {v.alert_level}"
        for v in vitals
    ) or "No vitals recorded in the last 24 hours."

    # Latest scan — extract structured flags
    latest_scan = DiagnosticScan.query.filter_by(patient_id=patient_id).order_by(
        DiagnosticScan.uploaded_at.desc()
    ).first()

    scan_flags = {"has_scan": False, "flags": [], "is_normal": False, "scan_type": None}

    if latest_scan:
        scan_text = (
            f"Latest scan ({latest_scan.scan_type}) uploaded at {latest_scan.uploaded_at}.\n"
            f"Inference results: {latest_scan.ai_inference_results or 'N/A'}"
        )
        inference = latest_scan.get_inference_results()  # Parse JSON string to dict
        scan_flags["has_scan"] = True
        scan_flags["scan_type"] = latest_scan.scan_type

        if inference.get("status") == "SUCCESS":
            detections = inference.get("detections", [])
            if detections:
                scan_flags["flags"] = [
                    {"label": d.get("label", "Unknown"), "confidence": d.get("confidence", 0)}
                    for d in detections
                ]
                scan_flags["is_normal"] = False
            else:
                scan_flags["is_normal"] = True
        else:
            scan_flags["is_normal"] = None  # model unavailable
    else:
        scan_text = "No diagnostic scans on record."

    return clinical_history, vitals_summary, scan_text, scan_flags


@ai_engine_bp.route("/clinical-overview", methods=["POST"])
@jwt_required()
@role_required("Doctor")
def clinical_overview():
    user = _current_user()
    data = request.get_json(silent=True) or {}
    patient_id = data.get("patient_id")

    if not patient_id:
        return fail("VALIDATION_ERROR", "patient_id is required.")

    if not _assert_active_consultation(user.id, patient_id):
        return fail("FORBIDDEN", "AI overview requires an active consultation with this patient.", 403)

    clinical_history, vitals_summary, scan_text, scan_flags = _assemble_context(patient_id)

    service = current_app.extensions.get("qwen_service")
    if service is None:
        service = QwenClinicalService()
        current_app.extensions["qwen_service"] = service

    result = service.generate_clinical_overview(
        patient_id=patient_id,
        clinical_history=clinical_history,
        vitals_summary=vitals_summary,
        latest_scans=scan_text,
        scan_flags=scan_flags,
    )

    write_audit(user.id, user.role, patient_id, "GENERATE_AI_OVERVIEW")

    return ok(result)


@ai_engine_bp.route("/health", methods=["GET"])
@jwt_required()
def ai_health():
    service = current_app.extensions.get("qwen_service")
    if service is None:
        service = QwenClinicalService()
        current_app.extensions["qwen_service"] = service

    vision_service = current_app.extensions.get("vision_service")
    vision_available = vision_service.available if vision_service else False

    return ok({
        "qwen": "live" if service.is_live else "mock",
        "vision": vision_available,
    })
