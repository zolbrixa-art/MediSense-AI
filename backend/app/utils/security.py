from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity


def role_required(*allowed_roles):
    """Decorator that requires a valid JWT and an allowed role claim."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            role = claims.get("role")

            # Fallback: Agar login ke waqt JWT claims mein role na mila ho to DB se nikaalein
            if not role:
                identity = get_jwt_identity()
                try:
                    from backend.app.models import User
                    user = User.query.filter_by(public_id=identity).first()
                    if not user and str(identity).isdigit():
                        user = User.query.get(int(identity))
                    if user:
                        role = user.role
                except Exception:
                    pass

            def clean_role(val):
                if not val:
                    return ""
                normalized = str(val).strip().lower().replace("_", "").replace("-", "").replace(" ", "")
                # Aliases handle karein
                if normalized in ("labtechnician", "labtech"):
                    return "labtech"
                return normalized

            user_role = clean_role(role)
            allowed = [clean_role(r) for r in allowed_roles]

            if user_role not in allowed:
                return jsonify({
                    "ok": False,
                    "error": {
                        "code": "FORBIDDEN",
                        "message": "Forbidden: Insufficient privileges for this clinical resource",
                    },
                }), 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator