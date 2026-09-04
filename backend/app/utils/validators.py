import re

from backend.app.models import User


EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")


def validate_email(email: str) -> tuple[bool, str]:
    if not email or not EMAIL_REGEX.match(email):
        return False, "A valid email is required."
    return True, ""


def validate_password(password: str) -> tuple[bool, str]:
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters."
    if not re.search(r"[A-Za-z]", password):
        return False, "Password must contain at least one letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    return True, ""


def validate_role(role: str) -> tuple[bool, str]:
    if not role or role not in User.VALID_ROLES:
        return False, f"Role must be one of: {', '.join(sorted(User.VALID_ROLES))}."
    return True, ""


def validate_required(value: str, name: str = "Field") -> tuple[bool, str]:
    if not value or not str(value).strip():
        return False, f"{name} is required."
    return True, ""
