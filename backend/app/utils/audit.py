from flask import request

from backend.app.extensions import db
from backend.app.models import AuditLog


def write_audit(actor_id: int, actor_role: str, target_patient_id: int, action_type: str) -> None:
    """Persist an audit log entry."""
    log = AuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        target_patient_id=target_patient_id,
        action_type=action_type,
        ip_address=request.remote_addr or "unknown",
    )
    db.session.add(log)
    db.session.commit()
