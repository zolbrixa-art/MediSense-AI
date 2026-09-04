import os
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.app.extensions import db
from backend.app.models import User, Appointment, AppointmentStatus, EncounterNote, Prescription, VitalReading
from backend.app.services import PrescriptionService
from backend.app.utils import role_required, ok, fail, write_audit

emr_bp = Blueprint("emr", __name__)


def _current_user():
    identity = get_jwt_identity()
    return User.query.filter_by(public_id=identity).first()


def _assert_active_consultation(doctor_id: int, patient_id: int):
    active = Appointment.query.filter_by(
        doctor_id=doctor_id,
        patient_id=patient_id,
        status=AppointmentStatus.IN_CONSULTATION,
    ).first()
    if not active:
        return False
    return True


@emr_bp.route("/patient/<int:patient_id>", methods=["GET"])
@jwt_required()
@role_required("Doctor", "Patient", "Admin", "LabTech")
def patient_record(patient_id):
    user = _current_user()

    if user.role == "Patient" and user.id != patient_id:
        return fail("FORBIDDEN", "You can only view your own medical record.", 403)

    if user.role == "Doctor" and not _assert_active_consultation(user.id, patient_id):
        return fail(
            "FORBIDDEN",
            "You may only access a patient's EMR during an active consultation.",
            403,
        )

    patient = User.query.get_or_404(patient_id)
    encounters = EncounterNote.query.filter_by(patient_id=patient_id).order_by(EncounterNote.created_at.desc()).all()
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    vitals = VitalReading.query.filter(
        VitalReading.patient_id == patient_id,
        VitalReading.recorded_at >= since_24h
    ).order_by(VitalReading.recorded_at.desc()).all()

    write_audit(user.id, user.role, patient_id, "READ_EHR")

    return ok({
        "patient": patient.to_dict(),
        "encounters": [e.to_dict() for e in encounters],
        "vitals": [v.to_dict() for v in vitals],
    })


@emr_bp.route("/encounter", methods=["POST"])
@jwt_required()
@role_required("Doctor")
def create_encounter():
    user = _current_user()
    data = request.get_json(silent=True) or {}

    patient_id = data.get("patient_id")
    appointment_id = data.get("appointment_id")
    subjective = data.get("subjective", "").strip()
    assessment = data.get("assessment", "").strip()
    plan = data.get("plan", "").strip()
    prescriptions = data.get("prescriptions", [])

    if not patient_id:
        return fail("VALIDATION_ERROR", "patient_id is required.")

    if not _assert_active_consultation(user.id, patient_id):
        return fail("FORBIDDEN", "No active consultation with this patient.", 403)

    patient = User.query.get(patient_id)
    encounter = EncounterNote(
        patient_id=patient_id,
        doctor_id=user.id,
        appointment_id=appointment_id,
        subjective=subjective,
        assessment=assessment,
        plan=plan,
    )
    db.session.add(encounter)
    db.session.flush()

    rx_list = []
    for rx in prescriptions:
        prescription = Prescription(
            encounter_id=encounter.id,
            drug_name=rx.get("drug_name", "").strip(),
            dose=rx.get("dose", "").strip(),
            frequency=rx.get("frequency", "").strip(),
            duration=rx.get("duration", "").strip(),
        )
        db.session.add(prescription)
        rx_list.append(prescription)

    db.session.flush()

    # Generate prescription images if any prescriptions exist
    if rx_list:
        try:
            pres_folder = PrescriptionService.get_patient_prescriptions_folder(patient_id)
            filename = PrescriptionService.get_prescription_filename(patient_id, encounter.id)
            file_path = os.path.join(pres_folder, filename)

            # Format prescriptions for the image
            med_data = [
                {
                    "drug_name": rx.drug_name,
                    "dose": rx.dose,
                    "frequency": rx.frequency,
                    "duration": rx.duration,
                }
                for rx in rx_list
            ]

            # Generate prescription image
            success = PrescriptionService.generate_prescription(
                patient_name=patient.full_name,
                patient_age=getattr(patient, "age", 30) or 30,
                doctor_name=user.full_name,
                medications=med_data,
                output_path=file_path,
            )

            if success:
                # Update all prescriptions with the file path
                for rx in rx_list:
                    rx.file_path = file_path
        except Exception as e:
            print(f"Warning: Could not generate prescription image: {str(e)}")

    db.session.commit()
    write_audit(user.id, user.role, patient_id, "CREATE_ENCOUNTER")

    encounter_data = encounter.to_dict()
    encounter_data["prescriptions"] = [
        {
            **rx.to_dict(),
            "download_url": f"/api/emr/prescription/{rx.id}/download",
        }
        for rx in rx_list
    ]
    return ok(encounter_data), 201


@emr_bp.route("/encounter/<int:encounter_id>/sign", methods=["POST"])
@jwt_required()
@role_required("Doctor")
def sign_encounter(encounter_id):
    user = _current_user()
    encounter = EncounterNote.query.get_or_404(encounter_id)

    if encounter.doctor_id != user.id:
        return fail("FORBIDDEN", "You can only sign your own encounters.", 403)

    encounter.signed_at = datetime.now(timezone.utc)
    db.session.commit()

    write_audit(user.id, user.role, encounter.patient_id, "SIGN_ENCOUNTER")
    return ok(encounter.to_dict())


@emr_bp.route("/prescription/<int:prescription_id>/download", methods=["GET"])
@jwt_required()
@role_required("Patient", "Doctor", "Admin", "LabTech")
def download_prescription(prescription_id):
    """Download a prescription image"""
    user = _current_user()
    prescription = Prescription.query.get_or_404(prescription_id)
    encounter = prescription.encounter

    # Verify access: patient can download their own, doctor can download theirs, admin can download any
    if user.role == "Patient" and encounter.patient_id != user.id:
        return fail("FORBIDDEN", "You can only download your own prescriptions.", 403)
    if user.role == "Doctor" and encounter.doctor_id != user.id:
        if not _assert_active_consultation(user.id, encounter.patient_id):
            return fail(
                "FORBIDDEN",
                "You may only access a patient's prescriptions during an active consultation.",
                403,
            )

    if not prescription.file_path or not os.path.exists(prescription.file_path):
        # Auto-generate prescription image if missing on disk
        patient = User.query.get(encounter.patient_id)
        doctor = User.query.get(encounter.doctor_id)
        all_rxs = Prescription.query.filter_by(encounter_id=encounter.id).all()

        pres_folder = PrescriptionService.get_patient_prescriptions_folder(encounter.patient_id)
        filename = PrescriptionService.get_prescription_filename(encounter.patient_id, encounter.id)
        file_path = os.path.join(pres_folder, filename)

        med_data = [
            {
                "drug_name": r.drug_name,
                "dose": r.dose,
                "frequency": r.frequency,
                "duration": r.duration,
            }
            for r in all_rxs
        ]

        success = PrescriptionService.generate_prescription(
            patient_name=patient.full_name if patient else "Patient",
            patient_age=getattr(patient, "age", 30) or 30,
            doctor_name=doctor.full_name if doctor else "Doctor",
            medications=med_data,
            output_path=file_path,
        )

        if success:
            for r in all_rxs:
                r.file_path = file_path
            db.session.commit()
        else:
            return fail("INTERNAL_ERROR", "Could not generate prescription image file.", 500)

    try:
        return send_file(
            os.path.abspath(prescription.file_path),
            mimetype="image/png",
            as_attachment=False,
            download_name=f"prescription_{prescription_id}.png",
        )
    except Exception as e:
        return fail("INTERNAL_ERROR", f"Error downloading prescription: {str(e)}", 500)


@emr_bp.route("/encounter/<int:encounter_id>/prescriptions", methods=["GET"])
@jwt_required()
@role_required("Patient", "Doctor", "Admin")
def get_encounter_prescriptions(encounter_id):
    """Get all prescriptions for an encounter with download links"""
    user = _current_user()
    encounter = EncounterNote.query.get_or_404(encounter_id)

    # Verify access
    if user.role == "Patient" and encounter.patient_id != user.id:
        return fail("FORBIDDEN", "You can only view your own prescriptions.", 403)
    if user.role == "Doctor" and encounter.doctor_id != user.id:
        return fail("FORBIDDEN", "You can only view your own prescriptions.", 403)

    prescriptions = Prescription.query.filter_by(encounter_id=encounter_id).all()
    result = []

    for rx in prescriptions:
        rx_dict = rx.to_dict()
        rx_dict["download_url"] = f"/api/emr/prescription/{rx.id}/download"
        result.append(rx_dict)

    return ok({"prescriptions": result})

