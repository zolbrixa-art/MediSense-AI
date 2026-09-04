from datetime import date, datetime, timezone
from typing import Optional

from backend.app.extensions import db
from backend.app.models import DoctorSchedule, Appointment, AppointmentStatus


def get_or_create_schedule(doctor_id: int, department: str = "General", shift_date: Optional[date] = None) -> DoctorSchedule:
    """Get the active schedule for a doctor on a given shift date, creating one if needed."""
    if shift_date is None:
        shift_date = date.today()

    schedule = DoctorSchedule.query.filter_by(
        doctor_id=doctor_id, shift_date=shift_date
    ).first()

    if schedule is None:
        schedule = DoctorSchedule(
            doctor_id=doctor_id,
            department=department,
            current_serving_token=0,
            last_allocated_token=0,
            is_active=True,
            shift_date=shift_date,
        )
        db.session.add(schedule)
        db.session.flush()

    return schedule


def allocate_token(doctor_id: int, department: str = "General", shift_date: Optional[date] = None) -> int:
    """Allocate the next sequential token for a doctor atomically."""
    schedule = get_or_create_schedule(doctor_id, department, shift_date)
    schedule.last_allocated_token += 1
    db.session.commit()
    return schedule.last_allocated_token


def get_current_queue(doctor_id: int, shift_date: Optional[date] = None) -> dict:
    """Return the current serving token and pending appointments."""
    if shift_date is None:
        shift_date = date.today()

    schedule = DoctorSchedule.query.filter_by(
        doctor_id=doctor_id, shift_date=shift_date
    ).first()

    current_token = schedule.current_serving_token if schedule else 0

    waiting = Appointment.query.filter_by(
        doctor_id=doctor_id,
        status=AppointmentStatus.PENDING,
    ).order_by(Appointment.token_number.asc()).all()

    return {
        "doctor_id": doctor_id,
        "current_serving_token": current_token,
        "last_allocated_token": schedule.last_allocated_token if schedule else 0,
        "waiting": [a.to_dict() for a in waiting],
        "estimated_wait_minutes": estimate_wait(doctor_id),
    }


def advance_queue(doctor_id: int, action: str = "next") -> Optional[Appointment]:
    """
    Complete the current InConsultation appointment and promote the next Pending one.
    If action is 'skip', mark the current InConsultation as Skipped instead.
    """
    current = Appointment.query.filter_by(
        doctor_id=doctor_id,
        status=AppointmentStatus.IN_CONSULTATION,
    ).first()

    now = datetime.now(timezone.utc)

    if current:
        current.completed_at = now
        current.status = AppointmentStatus.SKIPPED if action == "skip" else AppointmentStatus.COMPLETED

    next_appointment = Appointment.query.filter_by(
        doctor_id=doctor_id,
        status=AppointmentStatus.PENDING,
    ).order_by(Appointment.token_number.asc()).first()

    if next_appointment:
        next_appointment.status = AppointmentStatus.IN_CONSULTATION
        next_appointment.started_at = now

    schedule = DoctorSchedule.query.filter_by(doctor_id=doctor_id, shift_date=date.today()).first()
    if schedule and next_appointment:
        schedule.current_serving_token = next_appointment.token_number
    elif schedule and current:
        # No more patients; current token stays at the last served.
        schedule.current_serving_token = current.token_number

    db.session.commit()
    return next_appointment


def estimate_wait(doctor_id: int, default_minutes: int = 12) -> int:
    """Estimate wait time using a rolling average of completed consultation durations."""
    completed = Appointment.query.filter_by(
        doctor_id=doctor_id,
        status=AppointmentStatus.COMPLETED,
    ).order_by(Appointment.completed_at.desc()).limit(10).all()

    durations = []
    for appt in completed:
        if appt.started_at and appt.completed_at:
            delta = appt.completed_at - appt.started_at
            durations.append(delta.total_seconds() / 60.0)

    if not durations:
        return default_minutes

    return int(sum(durations) / len(durations))
