from datetime import date, datetime, timezone

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.app.extensions import db
from backend.app.models import User, DoctorSchedule, Appointment, AppointmentStatus, DiagnosticScan
from backend.app.services import allocate_token, get_current_queue, advance_queue
from backend.app.utils import role_required, ok, fail, write_audit

appointments_bp = Blueprint("appointments", __name__)


def _current_user():
    identity = get_jwt_identity()
    return User.query.filter_by(public_id=identity).first()


@appointments_bp.route("/dashboard-stats", methods=["GET"])
@jwt_required()
@role_required("Doctor")
def dashboard_stats():
    user = _current_user()
    today = date.today()

    total = Appointment.query.filter_by(doctor_id=user.id).count()

    # Current InConsultation appointment (across all dates)
    current_appt = Appointment.query.filter_by(
        doctor_id=user.id,
        status=AppointmentStatus.IN_CONSULTATION,
    ).first()

    current_patient = None
    if current_appt:
        patient = User.query.get(current_appt.patient_id)
        current_patient = {
            "token_number": current_appt.token_number,
            "patient_name": patient.full_name if patient else "Unknown",
            "patient_id": current_appt.patient_id,
            "appointment_id": current_appt.id,
        }

    schedule = DoctorSchedule.query.filter_by(
        doctor_id=user.id, shift_date=today
    ).first()

    if schedule and schedule.last_allocated_token > 0:
        todays_appts = Appointment.query.filter(
            Appointment.doctor_id == user.id,
            Appointment.token_number <= schedule.last_allocated_token,
        ).all()
    else:
        todays_appts = []

    pending = sum(1 for a in todays_appts if a.status == AppointmentStatus.PENDING)
    in_progress = sum(1 for a in todays_appts if a.status == AppointmentStatus.IN_CONSULTATION)
    completed = sum(1 for a in todays_appts if a.status == AppointmentStatus.COMPLETED)
    todays_count = len(todays_appts)

    # Include active consultation in counts even if no schedule today
    if current_appt and current_appt not in todays_appts:
        in_progress = 1
        todays_count += 1

    remaining = todays_count - completed
    current_token = current_appt.token_number if current_appt else (schedule.current_serving_token if schedule else 0)

    return ok({
        "total_appointments": total,
        "todays_appointments": todays_count,
        "pending": pending,
        "in_progress": in_progress,
        "token_number": current_token,
        "remaining": remaining,
        "current_patient": current_patient,
    })


@appointments_bp.route("/doctors", methods=["GET"])
@jwt_required()
def list_doctors():
    doctors = User.query.filter_by(role="Doctor").all()
    result = []
    for doc in doctors:
        today_schedule = DoctorSchedule.query.filter_by(
            doctor_id=doc.id, shift_date=date.today()
        ).first()
        latest_schedule = DoctorSchedule.query.filter_by(
            doctor_id=doc.id
        ).order_by(DoctorSchedule.shift_date.desc()).first()

        preferred_schedule = today_schedule or latest_schedule
        department = "General"

        if preferred_schedule and preferred_schedule.department:
            department = preferred_schedule.department.strip() or "General"

        if department == "General" or not department:
            non_general = DoctorSchedule.query.filter(
                DoctorSchedule.doctor_id == doc.id,
                DoctorSchedule.department.isnot(None),
                DoctorSchedule.department != "General",
            ).order_by(DoctorSchedule.shift_date.desc()).first()
            if non_general and non_general.department:
                department = non_general.department.strip()

        if department == "General" and hasattr(doc, "department") and doc.department:
            department = doc.department.strip()
        elif department == "General" and hasattr(doc, "specialization") and doc.specialization:
            department = doc.specialization.strip()

        if department == "General":
            schedule_row = DoctorSchedule.query.filter(
                DoctorSchedule.doctor_id == doc.id,
                DoctorSchedule.department.isnot(None),
            ).order_by(DoctorSchedule.shift_date.desc()).first()
            if schedule_row and schedule_row.department and schedule_row.department.strip() != "General":
                department = schedule_row.department.strip()

        result.append({
            "id": doc.id,
            "public_id": doc.public_id,
            "full_name": doc.full_name,
            "department": department,
            "is_active": (preferred_schedule.is_active if preferred_schedule else True),
        })
    return ok(result)


@appointments_bp.route("/book", methods=["POST"])
@jwt_required()
@role_required("Patient")
def book():
    user = _current_user()
    data = request.get_json(silent=True) or {}

    doctor_id = data.get("doctor_id")
    scheduled_time_str = data.get("scheduled_time")
    department = data.get("department", "General").strip()

    if not doctor_id:
        return fail("VALIDATION_ERROR", "doctor_id is required.")

    doctor = User.query.filter_by(id=doctor_id, role="Doctor").first()
    if not doctor:
        return fail("NOT_FOUND", "Doctor not found.", 404)

    try:
        scheduled_time = datetime.fromisoformat(scheduled_time_str)
        if scheduled_time.tzinfo is None:
            scheduled_time = scheduled_time.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        scheduled_time = datetime.now(timezone.utc)

    existing_booking = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.scheduled_time == scheduled_time,
    ).first()
    if existing_booking:
        return fail("SLOT_UNAVAILABLE", "This time slot is already booked. Please select an available slot.", 409)

    token_number = allocate_token(doctor_id, department=department, shift_date=scheduled_time.date())

    appointment = Appointment(
        token_number=token_number,
        patient_id=user.id,
        doctor_id=doctor.id,
        status=AppointmentStatus.PENDING,
        scheduled_time=scheduled_time,
    )
    db.session.add(appointment)
    db.session.commit()

    write_audit(user.id, user.role, user.id, "BOOK_APPOINTMENT")

    return ok({
        "appointment_id": appointment.id,
        "token_number": appointment.token_number,
        "doctor_id": doctor.id,
        "scheduled_time": appointment.scheduled_time.isoformat(),
    }), 201


@appointments_bp.route("/my", methods=["GET"])
@jwt_required()
def my_appointments():
    user = _current_user()
    if user.role == "Doctor":
        appointments = Appointment.query.filter_by(doctor_id=user.id).order_by(Appointment.created_at.desc()).all()
    elif user.role == "Patient":
        appointments = Appointment.query.filter_by(patient_id=user.id).order_by(Appointment.created_at.desc()).all()
    else:
        appointments = Appointment.query.order_by(Appointment.created_at.desc()).limit(50).all()

    result = []
    for a in appointments:
        a_dict = a.to_dict()
        patient = User.query.get(a.patient_id)
        doctor = User.query.get(a.doctor_id)
        # A scan in the patient's lookup folder means the lab has completed the order.
        # Do not tie this to appointment timestamps because uploads can be matched later.
        latest_scan = DiagnosticScan.query.filter_by(
            patient_id=a.patient_id,
        ).order_by(DiagnosticScan.uploaded_at.desc()).first()
        a_dict["lab_status"] = "Completed" if latest_scan else "Pending"
        a_dict["patient_name"] = patient.full_name if patient else "Unknown"
        a_dict["doctor_name"] = doctor.full_name if doctor else "Unknown"
        result.append(a_dict)

    return ok(result)


@appointments_bp.route("/queue/<int:doctor_id>", methods=["GET"])
@jwt_required()
@role_required("Patient", "Doctor", "LabTech", "Admin")
def queue(doctor_id):
    return ok(get_current_queue(doctor_id))


@appointments_bp.route("/<int:appointment_id>/next", methods=["POST"])
@jwt_required()
@role_required("Doctor")
def next_patient(appointment_id):
    user = _current_user()
    appointment = Appointment.query.get_or_404(appointment_id)

    if appointment.doctor_id != user.id:
        return fail("FORBIDDEN", "You can only manage your own queue.", 403)

    next_appt = advance_queue(user.id, action="next")
    if next_appt:
        write_audit(user.id, user.role, next_appt.patient_id, "QUEUE_ADVANCE")
        return ok(next_appt.to_dict())
    return ok({"message": "No more patients in queue."})


@appointments_bp.route("/<int:doctor_id>/start-queue", methods=["POST"])
@jwt_required()
@role_required("Doctor")
def start_queue(doctor_id):
    """Start the queue by moving the first PENDING patient to IN_CONSULTATION."""
    user = _current_user()
    if user.id != doctor_id:
        return fail("FORBIDDEN", "You can only manage your own queue.", 403)

    # Check if there's already an active consultation
    current = Appointment.query.filter_by(
        doctor_id=doctor_id,
        status=AppointmentStatus.IN_CONSULTATION,
    ).first()

    if current:
        return ok(current.to_dict())  # Already have an active patient

    # Get first PENDING patient
    next_appt = Appointment.query.filter_by(
        doctor_id=doctor_id,
        status=AppointmentStatus.PENDING,
    ).order_by(Appointment.token_number.asc()).first()

    if not next_appt:
        return ok({"message": "No patients in queue."})

    from datetime import datetime, timezone
    next_appt.status = AppointmentStatus.IN_CONSULTATION
    next_appt.started_at = datetime.now(timezone.utc)

    # Update schedule
    schedule = DoctorSchedule.query.filter_by(
        doctor_id=doctor_id, shift_date=date.today()
    ).first()
    if schedule:
        schedule.current_serving_token = next_appt.token_number

    db.session.commit()
    write_audit(user.id, user.role, next_appt.patient_id, "QUEUE_START")
    return ok(next_appt.to_dict())


@appointments_bp.route("/<int:doctor_id>/stop-queue", methods=["POST"])
@jwt_required()
@role_required("Doctor")
def stop_queue(doctor_id):
    """Stop the queue and mark doctor as inactive (off-duty)."""
    user = _current_user()
    if user.id != doctor_id:
        return fail("FORBIDDEN", "You can only manage your own queue.", 403)

    today = date.today()
    schedule = DoctorSchedule.query.filter_by(
        doctor_id=doctor_id, shift_date=today
    ).first()

    if schedule:
        schedule.is_active = False

    # Complete any active consultation
    from datetime import datetime, timezone
    current = Appointment.query.filter_by(
        doctor_id=doctor_id,
        status=AppointmentStatus.IN_CONSULTATION,
    ).first()
    if current:
        current.status = AppointmentStatus.COMPLETED
        current.completed_at = datetime.now(timezone.utc)

    db.session.commit()
    write_audit(user.id, user.role, user.id, "QUEUE_STOP")
    return ok({"message": "Queue stopped. You are now off-duty."})


@appointments_bp.route("/<int:appointment_id>/suggest-test", methods=["POST"])
@jwt_required()
@role_required("Doctor")
def suggest_test(appointment_id):
    user = _current_user()
    appointment = Appointment.query.get_or_404(appointment_id)

    if appointment.doctor_id != user.id:
        return fail("FORBIDDEN", "You can only order tests for your own patients.", 403)

    data = request.get_json(silent=True) or {}
    test_name = data.get("suggested_test", "").strip()

    if not test_name:
        return fail("VALIDATION_ERROR", "suggested_test is required.")

    # Ensure format like "Brain MRI suggested" or test name format
    if not test_name.lower().endswith("suggested"):
        test_text = f"{test_name} suggested"
    else:
        test_text = test_name

    appointment.suggested_test = test_text
    db.session.commit()

    write_audit(user.id, user.role, appointment.patient_id, "ORDER_LAB_TEST")
    return ok(appointment.to_dict())


@appointments_bp.route("/pending", methods=["GET"])
@jwt_required()
@role_required("LabTech", "Doctor", "Admin")
def pending_appointments():
    # Return appointments that are PENDING OR have a suggested_test and are not COMPLETED
    appts = Appointment.query.filter(
        db.or_(
            Appointment.status == AppointmentStatus.PENDING,
            db.and_(
                Appointment.suggested_test.isnot(None),
                Appointment.status != AppointmentStatus.COMPLETED
            )
        )
    ).order_by(Appointment.created_at.asc()).all()

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
            "suggested_test": a.suggested_test,
            "scheduled_time": a.scheduled_time.isoformat() + "Z" if a.scheduled_time else None,
            "created_at": a.created_at.isoformat() + "Z" if a.created_at else None,
        })

    return ok(result)


@appointments_bp.route("/booked-slots", methods=["GET"])
@jwt_required()
def booked_slots():
    """Get booked time slots for a doctor on a specific date."""
    doctor_id = request.args.get("doctor_id", type=int)
    date_str = request.args.get("date")

    if not doctor_id or not date_str:
        return fail("VALIDATION_ERROR", "doctor_id and date are required.")

    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        return fail("VALIDATION_ERROR", "Invalid date format.")

    # A time slot remains booked even after the appointment is completed.
    appointments = Appointment.query.filter(
        Appointment.doctor_id == doctor_id,
        db.func.date(Appointment.scheduled_time) == target_date,
    ).all()

    # Extract time slots in HH:MM format
    booked = []
    for a in appointments:
        if a.scheduled_time:
            time_str = a.scheduled_time.strftime("%H:%M")
            booked.append(time_str)

    return ok(booked)


@appointments_bp.route("/<int:appointment_id>/skip", methods=["POST"])
@jwt_required()
@role_required("Doctor")
def skip_patient(appointment_id):
    user = _current_user()
    appointment = Appointment.query.get_or_404(appointment_id)

    if appointment.doctor_id != user.id:
        return fail("FORBIDDEN", "You can only manage your own queue.", 403)

    next_appt = advance_queue(user.id, action="skip")
    if next_appt:
        write_audit(user.id, user.role, next_appt.patient_id, "QUEUE_SKIP")
        return ok(next_appt.to_dict())
    return ok({"message": "No more patients in queue."})
