from datetime import datetime, timedelta, timezone

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.app.extensions import db
from backend.app.models import User, VitalReading
from backend.app.services import evaluate_vitals
from backend.app.utils import role_required, ok, fail

vitals_bp = Blueprint("vitals", __name__)


def _current_user():
    identity = get_jwt_identity()
    return User.query.filter_by(public_id=identity).first()


@vitals_bp.route("/ingest", methods=["POST"])
@jwt_required()
@role_required("LabTech", "Patient", "Admin")
def ingest():
    user = _current_user()
    data = request.get_json(silent=True) or {}

    patient_id = data.get("patient_id") or user.id
    heart_rate = data.get("heart_rate")
    spo2 = data.get("spo2")
    temperature_f = data.get("temperature_f")
    bp_systolic = data.get("bp_systolic")
    bp_diastolic = data.get("bp_diastolic")
    sleep_quality = data.get("sleep_quality", "").strip()

    # Patients can only ingest for themselves unless they are Admin/LabTech
    if user.role == "Patient" and patient_id != user.id:
        return fail("FORBIDDEN", "You can only record your own vitals.", 403)

    alert_level, reasons = evaluate_vitals(heart_rate, spo2, temperature_f)

    reading = VitalReading(
        patient_id=patient_id,
        heart_rate=heart_rate,
        spo2=spo2,
        temperature_f=temperature_f,
        bp_systolic=bp_systolic,
        bp_diastolic=bp_diastolic,
        checked_by=user.id if user.role == "LabTech" else None,
        checked_by_name=user.full_name if user.role == "LabTech" else None,
        sleep_quality=sleep_quality,
        alert_level=alert_level,
        alert_reasons=reasons,
    )
    db.session.add(reading)
    db.session.commit()

    return ok({
        "reading": reading.to_dict(),
        "reasons": reasons,
    }), 201


@vitals_bp.route("/patient/<int:patient_id>/latest", methods=["GET"])
@jwt_required()
# @role_required("Doctor", "Patient", "Admin", "LabTech")
def latest(patient_id):
    user = _current_user()
    if user.role == "Patient" and user.id != patient_id:
        return fail("FORBIDDEN", "You can only view your own vitals.", 403)

    # Verify patient_id refers to an actual patient
    patient = User.query.get(patient_id)
    if not patient or patient.role != "Patient":
        return fail("VALIDATION_ERROR", "Invalid patient ID.", 400)

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    reading = VitalReading.query.filter(
        VitalReading.patient_id == patient_id,
        VitalReading.recorded_at >= since
    ).order_by(VitalReading.recorded_at.desc()).first()
    if not reading:
        return fail("NOT_FOUND", "No recent vitals found (within 24 hours).", 404)
    return ok(reading.to_dict())


@vitals_bp.route("/patient/<int:patient_id>/trend", methods=["GET"])
@jwt_required()
@role_required("Doctor", "Patient", "Admin", "LabTech")
def trend(patient_id):
    user = _current_user()
    if user.role == "Patient" and user.id != patient_id:
        return fail("FORBIDDEN", "You can only view your own vitals.", 403)

    # Verify patient_id refers to an actual patient
    patient = User.query.get(patient_id)
    if not patient or patient.role != "Patient":
        return fail("VALIDATION_ERROR", "Invalid patient ID.", 400)

    hours = request.args.get("hours", 24, type=int)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    readings = VitalReading.query.filter(
        VitalReading.patient_id == patient_id,
        VitalReading.recorded_at >= since,
    ).order_by(VitalReading.recorded_at.asc()).all()

    return ok([r.to_dict() for r in readings])


@vitals_bp.route("/alerts", methods=["GET"])
@jwt_required()
@role_required("Doctor", "Admin", "LabTech")
def alerts():
    """Return recent CRITICAL vitals for any patient."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    readings = VitalReading.query.filter(
        VitalReading.alert_level == "CRITICAL",
        VitalReading.recorded_at >= since,
    ).order_by(VitalReading.recorded_at.desc()).limit(20).all()

    return ok([r.to_dict() for r in readings])
