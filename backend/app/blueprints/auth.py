from datetime import date, datetime, timezone

from flask import Blueprint, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt

from backend.app.extensions import db
from backend.app.models import User, DoctorSchedule
from backend.app.utils import ok, fail, validate_email, validate_password, validate_role, validate_required

auth_bp = Blueprint("auth", __name__)


def _get_user_from_jwt():
    identity = get_jwt_identity()
    return User.query.filter_by(public_id=identity).first()


@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}

    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "").strip()
    department = data.get("department", "").strip()

    valid, msg = validate_required(full_name, "Full name")
    if not valid:
        return fail("VALIDATION_ERROR", msg)

    valid, msg = validate_email(email)
    if not valid:
        return fail("VALIDATION_ERROR", msg)

    valid, msg = validate_password(password)
    if not valid:
        return fail("VALIDATION_ERROR", msg)

    valid, msg = validate_role(role)
    if not valid:
        return fail("VALIDATION_ERROR", msg)

    if User.query.filter_by(email=email).first():
        return fail("CONFLICT", "An account with this email already exists.", 409)

    user = User(email=email, full_name=full_name, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    if role == "Doctor":
        specialty = department or "General"
        schedule = DoctorSchedule.query.filter_by(
            doctor_id=user.id,
            shift_date=date.today(),
        ).first()

        if schedule:
            schedule.department = specialty
            schedule.is_active = True
        else:
            db.session.add(DoctorSchedule(
                doctor_id=user.id,
                department=specialty,
                current_serving_token=0,
                last_allocated_token=0,
                is_active=True,
                shift_date=date.today(),
            ))

    db.session.commit()

    access_token = create_access_token(identity=user.public_id, additional_claims={"role": user.role})

    return ok({
        "access_token": access_token,
        "user": user.to_dict(),
    }, "Account created successfully."), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return fail("INVALID_CREDENTIALS", "Invalid email or password.", 401)

    access_token = create_access_token(identity=user.public_id, additional_claims={"role": user.role})

    return ok({
        "access_token": access_token,
        "user": user.to_dict(),
    })


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    user = User.query.filter_by(public_id=identity).first()
    if not user:
        return fail("NOT_FOUND", "User not found.", 404)

    access_token = create_access_token(identity=user.public_id, additional_claims={"role": user.role})
    return ok({"access_token": access_token})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = _get_user_from_jwt()
    if not user:
        return fail("NOT_FOUND", "User not found.", 404)
    return ok({"user": user.to_dict()})
