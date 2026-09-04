from datetime import date, datetime, timezone, timedelta

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.app.extensions import db
from backend.app.models import (
    User, DoctorSchedule, Appointment, AppointmentStatus,
    EncounterNote, Prescription, VitalReading, DiagnosticScan,
)
from backend.app.utils import role_required, ok, fail

patient_bp = Blueprint("patient", __name__)


def _current_user():
    identity = get_jwt_identity()
    return User.query.filter_by(public_id=identity).first()


# ── Dashboard Stats ───────────────────────────────────────────

@patient_bp.route("/stats", methods=["GET"])
@jwt_required()
@role_required("Patient")
def stats():
    user = _current_user()

    all_appts = Appointment.query.filter_by(patient_id=user.id).all()
    upcoming = [a for a in all_appts if a.status == AppointmentStatus.PENDING]
    completed = [a for a in all_appts if a.status == AppointmentStatus.COMPLETED]
    active = next((a for a in all_appts if a.status == AppointmentStatus.IN_CONSULTATION), None)

    # Next upcoming appointment with doctor info
    next_appt = None
    if upcoming:
        nxt = sorted(upcoming, key=lambda a: a.scheduled_time)[0]
        doc = User.query.get(nxt.doctor_id)
        sched = DoctorSchedule.query.filter_by(doctor_id=nxt.doctor_id, shift_date=date.today()).first()
        next_appt = {
            "appointment_id": nxt.id,
            "token_number": nxt.token_number,
            "doctor_name": doc.full_name if doc else "Unknown",
            "department": sched.department if sched else "General",
            "scheduled_time": nxt.scheduled_time.isoformat() + "Z",
        }

    # Active token info
    active_token = None
    if active:
        doc = User.query.get(active.doctor_id)
        sched = DoctorSchedule.query.filter_by(doctor_id=active.doctor_id, shift_date=date.today()).first()
        active_token = {
            "appointment_id": active.id,
            "token_number": active.token_number,
            "doctor_name": doc.full_name if doc else "Unknown",
            "department": sched.department if sched else "General",
            "current_serving": sched.current_serving_token if sched else 0,
        }

    # Latest vitals
    latest_vital = VitalReading.query.filter_by(patient_id=user.id).order_by(
        VitalReading.recorded_at.desc()
    ).first()

    # Latest scan count
    scan_count = DiagnosticScan.query.filter_by(patient_id=user.id).count()

    # Prescriptions count
    encounters = EncounterNote.query.filter_by(patient_id=user.id).all()
    rx_count = sum(
        Prescription.query.filter_by(encounter_id=e.id).count()
        for e in encounters
    )

    return ok({
        "total_appointments": len(all_appts),
        "upcoming_count": len(upcoming),
        "completed_count": len(completed),
        "next_appointment": next_appt,
        "active_token": active_token,
        "scan_count": scan_count,
        "rx_count": rx_count,
        "latest_vitals": latest_vital.to_dict() if latest_vital else None,
    })


# ── Queue Position for a specific appointment ─────────────────

@patient_bp.route("/token-position/<int:appointment_id>", methods=["GET"])
@jwt_required()
@role_required("Patient")
def token_position(appointment_id):
    user = _current_user()
    appt = Appointment.query.filter_by(id=appointment_id, patient_id=user.id).first()
    if not appt:
        return fail("NOT_FOUND", "Appointment not found.", 404)

    sched = DoctorSchedule.query.filter_by(doctor_id=appt.doctor_id, shift_date=date.today()).first()
    current_serving = sched.current_serving_token if sched else 0

    # Tokens pending before this one
    ahead = Appointment.query.filter(
        Appointment.doctor_id == appt.doctor_id,
        Appointment.status == AppointmentStatus.PENDING,
        Appointment.token_number < appt.token_number,
    ).count()

    return ok({
        "token_number": appt.token_number,
        "current_serving": current_serving,
        "patients_ahead": ahead,
        "estimated_wait_min": ahead * 8,
        "status": appt.status,
        "doctor_id": appt.doctor_id,
    })


# ── Full Medical Records (own only) ───────────────────────────

@patient_bp.route("/records", methods=["GET"])
@jwt_required()
@role_required("Patient")
def my_records():
    user = _current_user()

    encounters = EncounterNote.query.filter_by(patient_id=user.id).order_by(
        EncounterNote.created_at.desc()
    ).all()

    result = []
    for enc in encounters:
        doc = User.query.get(enc.doctor_id)
        prescriptions = Prescription.query.filter_by(encounter_id=enc.id).all()
        
        rx_list = []
        for rx in prescriptions:
            rx_dict = {
                "id": rx.id,
                "drug_name": rx.drug_name,
                "dose": rx.dose,
                "frequency": rx.frequency,
                "duration": rx.duration,
                "download_url": f"/api/emr/prescription/{rx.id}/download",
            }
            rx_list.append(rx_dict)
        
        result.append({
            "encounter_id": enc.id,
            "created_at": enc.created_at.isoformat() + "Z" if enc.created_at else None,
            "signed_at": enc.signed_at.isoformat() + "Z" if enc.signed_at else None,
            "doctor_name": doc.full_name if doc else "Unknown",
            "subjective": enc.subjective,
            "assessment": enc.assessment,
            "plan": enc.plan,
            "prescriptions": rx_list,
        })

    return ok(result)


# ── Own Scans/Reports ─────────────────────────────────────────

@patient_bp.route("/scans", methods=["GET"])
@jwt_required()
@role_required("Patient")
def my_scans():
    user = _current_user()
    scan_type = request.args.get("type")

    query = DiagnosticScan.query.filter_by(patient_id=user.id)
    if scan_type:
        query = query.filter_by(scan_type=scan_type)

    scans = query.order_by(DiagnosticScan.uploaded_at.desc()).all()

    result = []
    for s in scans:
        inf = s.get_inference_results() if hasattr(s, "get_inference_results") else (s.ai_inference_results or {})
        result.append({
            "id": s.id,
            "scan_type": s.scan_type,
            "file_url": f"/api/imaging/scan/{s.id}/file",
            "confidence_score": s.confidence_score,
            "ai_inference": inf,
            "uploaded_at": s.uploaded_at.isoformat() + "Z" if s.uploaded_at else None,
        })

    return ok(result)


# ── Vitals Trend (last N days) ────────────────────────────────

@patient_bp.route("/vitals-trend", methods=["GET"])
@jwt_required()
@role_required("Patient")
def vitals_trend():
    user = _current_user()
    days = request.args.get("days", 7, type=int)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    readings = VitalReading.query.filter(
        VitalReading.patient_id == user.id,
        VitalReading.recorded_at >= since,
    ).order_by(VitalReading.recorded_at.asc()).all()

    # Critical alerts
    alerts = [r for r in readings if r.alert_level in ("CRITICAL", "WARNING")]

    return ok({
        "readings": [r.to_dict() for r in readings],
        "alerts": [r.to_dict() for r in alerts],
        "days": days,
    })


# ── Reminders (derived from appointments + prescriptions) ─────

@patient_bp.route("/reminders", methods=["GET"])
@jwt_required()
@role_required("Patient")
def reminders():
    user = _current_user()

    reminders_list = []

    # Upcoming appointments as arrival reminders
    upcoming = Appointment.query.filter(
        Appointment.patient_id == user.id,
        Appointment.status == AppointmentStatus.PENDING,
    ).order_by(Appointment.scheduled_time.asc()).limit(5).all()

    for a in upcoming:
        doc = User.query.get(a.doctor_id)
        sched = DoctorSchedule.query.filter_by(doctor_id=a.doctor_id, shift_date=date.today()).first()
        dept = sched.department if sched else "OPD"
        reminders_list.append({
            "type": "appointment",
            "title": f"Appointment with {doc.full_name if doc else 'Doctor'}",
            "body": f"Token #{a.token_number} — {dept}. Please arrive 15 minutes early.",
            "scheduled_time": a.scheduled_time.isoformat() + "Z" if a.scheduled_time else None,
            "priority": "high",
        })

    # Medicine reminders from latest prescriptions
    encounters = EncounterNote.query.filter_by(patient_id=user.id).order_by(
        EncounterNote.created_at.desc()
    ).limit(3).all()

    for enc in encounters:
        prescriptions = Prescription.query.filter_by(encounter_id=enc.id).all()
        for rx in prescriptions:
            if rx.frequency:
                reminders_list.append({
                    "type": "medicine",
                    "title": f"Take {rx.drug_name}",
                    "body": f"{rx.dose or ''} — {rx.frequency}{' for ' + rx.duration if rx.duration else ''}".strip(" —"),
                    "scheduled_time": None,
                    "priority": "normal",
                })

    return ok(reminders_list)


@patient_bp.route("/all-patients", methods=["GET"])
@jwt_required()
@role_required("LabTech", "Doctor", "Admin")
def all_patients():
    """Return all patients (for lab tech vitals and other purposes)."""
    patients = User.query.filter_by(role="Patient").order_by(User.full_name.asc()).all()
    return ok([{
        "id": p.id,
        "name": p.full_name,
        "email": p.email,
    } for p in patients])
