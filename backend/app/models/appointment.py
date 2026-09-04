from datetime import datetime, timezone

from backend.app.extensions import db


class AppointmentStatus:
    PENDING = "Pending"
    IN_CONSULTATION = "InConsultation"
    COMPLETED = "Completed"
    SKIPPED = "Skipped"


class Appointment(db.Model):
    __tablename__ = "Appointments"

    id = db.Column(db.Integer, primary_key=True)
    token_number = db.Column(db.Integer, nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey("Users.id"), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey("Users.id"), nullable=False)
    status = db.Column(db.String(20), default=AppointmentStatus.PENDING, nullable=False)
    scheduled_time = db.Column(db.DateTime, nullable=False)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    suggested_test = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    patient = db.relationship("User", foreign_keys=[patient_id], backref="patient_appointments")
    doctor = db.relationship("User", foreign_keys=[doctor_id], backref="doctor_appointments")

    __table_args__ = (
        db.UniqueConstraint("doctor_id", "scheduled_time", "token_number", name="uq_appointment_doctor_token"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "token_number": self.token_number,
            "patient_id": self.patient_id,
            "doctor_id": self.doctor_id,
            "status": self.status,
            "suggested_test": self.suggested_test,
            "scheduled_time": self.scheduled_time.isoformat() + "Z" if self.scheduled_time else None,
            "started_at": self.started_at.isoformat() + "Z" if self.started_at else None,
            "completed_at": self.completed_at.isoformat() + "Z" if self.completed_at else None,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }
