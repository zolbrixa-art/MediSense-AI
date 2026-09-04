from datetime import date

from backend.app.extensions import db


class DoctorSchedule(db.Model):
    __tablename__ = "DoctorSchedules"

    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("Users.id"), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    current_serving_token = db.Column(db.Integer, default=0, nullable=False)
    last_allocated_token = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    shift_date = db.Column(db.Date, default=date.today, nullable=False)

    doctor = db.relationship("User", backref="schedules")

    __table_args__ = (
        db.UniqueConstraint("doctor_id", "shift_date", name="uq_doctor_shift"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "doctor_id": self.doctor_id,
            "department": self.department,
            "current_serving_token": self.current_serving_token,
            "last_allocated_token": self.last_allocated_token,
            "is_active": self.is_active,
            "shift_date": self.shift_date.isoformat() if self.shift_date else None,
        }
