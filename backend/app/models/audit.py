from datetime import datetime, timezone

from backend.app.extensions import db


class AuditLog(db.Model):
    __tablename__ = "AuditLogs"

    # Note: T-SQL schema specifies BIGINT, but SQLite autoincrement only works
    # reliably with INTEGER. The separate db/schema_mssql.sql retains BIGINT.
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    actor_id = db.Column(db.Integer, nullable=False)
    actor_role = db.Column(db.String(20), nullable=False)
    target_patient_id = db.Column(db.Integer, nullable=False)
    action_type = db.Column(db.String(50), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() + "Z" if self.timestamp else None,
            "actor_id": self.actor_id,
            "actor_role": self.actor_role,
            "target_patient_id": self.target_patient_id,
            "action_type": self.action_type,
            "ip_address": self.ip_address,
        }
