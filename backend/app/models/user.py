import uuid
from datetime import datetime, timezone

from backend.app.extensions import db, bcrypt


class User(db.Model):
    __tablename__ = "Users"

    id = db.Column(db.Integer, primary_key=True)
    public_id = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    VALID_ROLES = {"Patient", "Doctor", "Admin", "LabTech"}

    @property
    def portal_id(self) -> str:
        prefix = "MRI" if self.role == "Patient" else self.role[:3].upper()
        return f"{prefix}-{self.id:03d}"

    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "public_id": self.public_id,
            "portal_id": self.portal_id,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }
