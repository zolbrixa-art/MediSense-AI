from datetime import datetime, timezone

from backend.app.extensions import db


class EncounterNote(db.Model):
    __tablename__ = "EncounterNotes"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("Users.id"), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey("Users.id"), nullable=False)
    appointment_id = db.Column(db.Integer, db.ForeignKey("Appointments.id"), nullable=True)
    subjective = db.Column(db.Text, nullable=True)
    assessment = db.Column(db.Text, nullable=True)
    plan = db.Column(db.Text, nullable=True)
    signed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    patient = db.relationship("User", foreign_keys=[patient_id], backref="encounter_notes")
    doctor = db.relationship("User", foreign_keys=[doctor_id], backref="doctor_notes")
    appointment = db.relationship("Appointment", backref="encounter_notes")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "doctor_id": self.doctor_id,
            "appointment_id": self.appointment_id,
            "subjective": self.subjective,
            "assessment": self.assessment,
            "plan": self.plan,
            "signed_at": self.signed_at.isoformat() + "Z" if self.signed_at else None,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class VitalReading(db.Model):
    __tablename__ = "VitalReadings"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("Users.id"), nullable=False)
    heart_rate = db.Column(db.Integer, nullable=True)
    spo2 = db.Column(db.Integer, nullable=True)
    temperature_f = db.Column(db.Float, nullable=True)
    bp_systolic = db.Column(db.Integer, nullable=True)
    bp_diastolic = db.Column(db.Integer, nullable=True)
    checked_by = db.Column(db.Integer, db.ForeignKey("Users.id"), nullable=True)
    checked_by_name = db.Column(db.String(255), nullable=True)
    sleep_quality = db.Column(db.String(20), nullable=True)
    alert_level = db.Column(db.String(20), default="NORMAL", nullable=False)
    alert_reasons = db.Column(db.JSON, nullable=True, default=list)
    recorded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    patient = db.relationship("User", foreign_keys=[patient_id], backref="vital_readings")
    checker = db.relationship("User", foreign_keys=[checked_by])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "heart_rate": self.heart_rate,
            "spo2": self.spo2,
            "temperature_f": self.temperature_f,
            "bp_systolic": self.bp_systolic,
            "bp_diastolic": self.bp_diastolic,
            "checked_by": self.checked_by,
            "checked_by_name": self.checked_by_name,
            "sleep_quality": self.sleep_quality,
            "alert_level": self.alert_level,
            "alert_reasons": self.alert_reasons or [],
            "recorded_at": self.recorded_at.isoformat() + "Z" if self.recorded_at else None,
        }


class Prescription(db.Model):
    __tablename__ = "Prescriptions"

    id = db.Column(db.Integer, primary_key=True)
    encounter_id = db.Column(db.Integer, db.ForeignKey("EncounterNotes.id"), nullable=False)
    drug_name = db.Column(db.String(255), nullable=False)
    dose = db.Column(db.String(100), nullable=True)
    frequency = db.Column(db.String(100), nullable=True)
    duration = db.Column(db.String(100), nullable=True)
    file_path = db.Column(db.String(500), nullable=True)  # Path to generated prescription image
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    encounter = db.relationship("EncounterNote", backref="prescriptions")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "encounter_id": self.encounter_id,
            "drug_name": self.drug_name,
            "dose": self.dose,
            "frequency": self.frequency,
            "duration": self.duration,
            "file_path": self.file_path,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }
