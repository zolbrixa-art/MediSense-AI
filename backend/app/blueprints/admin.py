from datetime import date, datetime, timezone

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.app.extensions import db
from backend.app.models import (
    User, DoctorSchedule, Appointment, AppointmentStatus,
    DiagnosticScan, AuditLog,
)
from backend.app.utils import role_required, ok, fail

admin_bp = Blueprint("admin", __name__)


def _current_user():
    identity = get_jwt_identity()
    return User.query.filter_by(public_id=identity).first()


def _doctor_department(doctor_id, schedule=None):
    if schedule and schedule.department:
        return schedule.department

    latest = DoctorSchedule.query.filter(
        DoctorSchedule.doctor_id == doctor_id,
        DoctorSchedule.department.isnot(None),
        DoctorSchedule.department != "General",
    ).order_by(DoctorSchedule.shift_date.desc()).first()
    if latest and latest.department:
        return latest.department

    return "General"


# ── Dashboard Stats ──────────────────────────────────────────

@admin_bp.route("/stats", methods=["GET"])
@jwt_required()
@role_required("Admin")
def stats():
    today = datetime.now(timezone.utc).date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    total_doctors = User.query.filter_by(role="Doctor").count()
    total_patients = User.query.filter_by(role="Patient").count()
    total_lab_techs = User.query.filter_by(role="LabTech").count()

    total_appointments = Appointment.query.count()
    todays_appointments = Appointment.query.filter(
        Appointment.created_at >= today_start
    ).count()
    pending_appointments = Appointment.query.filter_by(
        status=AppointmentStatus.PENDING
    ).count()
    active_consultations = Appointment.query.filter_by(
        status=AppointmentStatus.IN_CONSULTATION
    ).count()
    completed_today = Appointment.query.filter(
        Appointment.status == AppointmentStatus.COMPLETED,
        Appointment.completed_at >= today_start,
    ).count()

    scans_today = DiagnosticScan.query.filter(
        DiagnosticScan.uploaded_at >= today_start
    ).count()

    # Queue snapshot — count of active doctor schedules
    active_queues = DoctorSchedule.query.filter_by(
        shift_date=today, is_active=True
    ).count()

    return ok({
        "total_doctors": total_doctors,
        "total_patients": total_patients,
        "total_lab_techs": total_lab_techs,
        "total_appointments": total_appointments,
        "todays_appointments": todays_appointments,
        "pending": pending_appointments,
        "active_consultations": active_consultations,
        "completed_today": completed_today,
        "scans_today": scans_today,
        "active_queues": active_queues,
    })


# ── Queue Snapshot (all doctors) ─────────────────────────────

@admin_bp.route("/queue-snapshot", methods=["GET"])
@jwt_required()
@role_required("Admin")
def queue_snapshot():
    today = date.today()
    doctors = User.query.filter_by(role="Doctor").all()

    result = []
    for doc in doctors:
        schedule = DoctorSchedule.query.filter_by(
            doctor_id=doc.id, shift_date=today
        ).first()

        # Get waiting tokens
        waiting = Appointment.query.filter_by(
            doctor_id=doc.id, status=AppointmentStatus.PENDING
        ).order_by(Appointment.token_number.asc()).all()

        current = Appointment.query.filter_by(
            doctor_id=doc.id, status=AppointmentStatus.IN_CONSULTATION
        ).first()

        current_patient = None
        if current:
            p = User.query.get(current.patient_id)
            current_patient = {
                "token_number": current.token_number,
                "patient_name": p.full_name if p else "Unknown",
            }

        next_tokens = [
            {"token_number": a.token_number, "patient_name": User.query.get(a.patient_id).full_name if User.query.get(a.patient_id) else "Unknown"}
            for a in waiting[:3]
        ]

        result.append({
            "doctor_id": doc.id,
            "doctor_name": doc.full_name,
            "department": _doctor_department(doc.id, schedule),
            "is_active": schedule.is_active if schedule else False,
            "current_serving_token": schedule.current_serving_token if schedule else 0,
            "last_allocated_token": schedule.last_allocated_token if schedule else 0,
            "current_patient": current_patient,
            "next_tokens": next_tokens,
            "waiting_count": len(waiting),
        })

    return ok(result)


# ── Manage Doctors ────────────────────────────────────────────

@admin_bp.route("/doctors", methods=["GET"])
@jwt_required()
@role_required("Admin")
def list_doctors():
    doctors = User.query.filter_by(role="Doctor").all()
    today = date.today()

    result = []
    for doc in doctors:
        schedule = DoctorSchedule.query.filter_by(
            doctor_id=doc.id, shift_date=today
        ).first()
        total_appts = Appointment.query.filter_by(doctor_id=doc.id).count()

        result.append({
            "id": doc.id,
            "name": doc.full_name,
            "email": doc.email,
            "department": _doctor_department(doc.id, schedule),
            "is_active": schedule.is_active if schedule else False,
            "total_appointments": total_appts,
            "current_serving_token": schedule.current_serving_token if schedule else 0,
            "last_allocated_token": schedule.last_allocated_token if schedule else 0,
        })

    return ok(result)


@admin_bp.route("/doctors/<int:doctor_id>/toggle", methods=["POST"])
@jwt_required()
@role_required("Admin")
def toggle_doctor(doctor_id):
    doctor = User.query.filter_by(id=doctor_id, role="Doctor").first()
    if not doctor:
        return fail("NOT_FOUND", "Doctor not found.", 404)

    today = date.today()
    schedule = DoctorSchedule.query.filter_by(
        doctor_id=doctor_id, shift_date=today
    ).first()

    if schedule:
        schedule.is_active = not schedule.is_active
    else:
        schedule = DoctorSchedule(
            doctor_id=doctor_id,
            department="General",
            current_serving_token=0,
            last_allocated_token=0,
            is_active=True,
            shift_date=today,
        )
        db.session.add(schedule)

    db.session.commit()

    return ok({
        "doctor_id": doctor_id,
        "doctor_name": doctor.full_name,
        "is_active": schedule.is_active,
    })


# ── All Appointments ─────────────────────────────────────────

@admin_bp.route("/appointments", methods=["GET"])
@jwt_required()
@role_required("Admin")
def all_appointments():
    status_filter = request.args.get("status")
    doctor_id = request.args.get("doctor_id", type=int)
    limit = request.args.get("limit", 50, type=int)

    query = Appointment.query

    if status_filter:
        query = query.filter_by(status=status_filter)
    if doctor_id:
        query = query.filter_by(doctor_id=doctor_id)

    appts = query.order_by(Appointment.created_at.desc()).limit(limit).all()

    result = []
    for a in appts:
        patient = User.query.get(a.patient_id)
        doctor = User.query.get(a.doctor_id)
        result.append({
            "id": a.id,
            "token_number": a.token_number,
            "patient_name": patient.full_name if patient else "Unknown",
            "patient_id": a.patient_id,
            "doctor_name": doctor.full_name if doctor else "Unknown",
            "doctor_id": a.doctor_id,
            "status": a.status,
            "scheduled_time": a.scheduled_time.isoformat() + "Z" if a.scheduled_time else None,
            "created_at": a.created_at.isoformat() + "Z" if a.created_at else None,
            "completed_at": a.completed_at.isoformat() + "Z" if a.completed_at else None,
        })

    return ok(result)


# ── Departments ──────────────────────────────────────────────

@admin_bp.route("/departments", methods=["GET"])
@jwt_required()
@role_required("Admin")
def departments():
    today = date.today()
    schedules = DoctorSchedule.query.filter_by(shift_date=today).all()

    # Group by department
    dept_map = {}
    for s in schedules:
        dept = s.department
        if dept not in dept_map:
            dept_map[dept] = {
                "name": dept,
                "doctor_count": 0,
                "active_doctors": 0,
                "total_tokens_today": 0,
            }
        dept_map[dept]["doctor_count"] += 1
        if s.is_active:
            dept_map[dept]["active_doctors"] += 1
        dept_map[dept]["total_tokens_today"] += s.last_allocated_token

    # Include departments from doctors without schedules
    doctors = User.query.filter_by(role="Doctor").all()
    for doc in doctors:
        has_schedule = any(s.doctor_id == doc.id for s in schedules)
        if not has_schedule:
            dept = _doctor_department(doc.id)
            if dept not in dept_map:
                dept_map[dept] = {
                    "name": dept,
                    "doctor_count": 0,
                    "active_doctors": 0,
                    "total_tokens_today": 0,
                }
            dept_map[dept]["doctor_count"] += 1

    return ok(list(dept_map.values()))


# ── Audit Logs ───────────────────────────────────────────────

@admin_bp.route("/audit-logs", methods=["GET"])
@jwt_required()
@role_required("Admin")
def audit_logs():
    limit = request.args.get("limit", 50, type=int)
    logs = AuditLog.query.order_by(
        AuditLog.timestamp.desc()
    ).limit(limit).all()

    result = []
    for log in logs:
        actor = User.query.get(log.actor_id)
        patient = User.query.get(log.target_patient_id)
        result.append({
            "id": log.id,
            "timestamp": log.timestamp.isoformat() + "Z" if log.timestamp else None,
            "actor_name": actor.full_name if actor else "Unknown",
            "actor_role": log.actor_role,
            "patient_name": patient.full_name if patient else "Unknown",
            "target_patient_id": log.target_patient_id,
            "action_type": log.action_type,
            "ip_address": log.ip_address,
        })

    return ok(result)
