import json
from datetime import datetime, timezone

from backend.app.extensions import db


class DiagnosticScan(db.Model):
    __tablename__ = "DiagnosticScans"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("Users.id"), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("Users.id"), nullable=False)
    scan_type = db.Column(db.String(50), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    ai_inference_results = db.Column(db.Text, nullable=True)
    clinical_recommendations_json = db.Column(db.Text, nullable=True)
    confidence_score = db.Column(db.Float, nullable=True)
    uploaded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    patient = db.relationship("User", foreign_keys=[patient_id], backref="scans")
    uploader = db.relationship("User", foreign_keys=[uploaded_by], backref="uploaded_scans")

    def set_inference_results(self, data: dict) -> None:
        self.ai_inference_results = json.dumps(data)

    def get_inference_results(self) -> dict:
        if not self.ai_inference_results:
            return {}
        try:
            return json.loads(self.ai_inference_results)
        except json.JSONDecodeError:
            return {}

    def set_clinical_recommendations(self, data: dict) -> None:
        self.clinical_recommendations_json = json.dumps(data)

    def get_clinical_recommendations(self) -> dict:
        if not self.clinical_recommendations_json:
            return {}
        try:
            return json.loads(self.clinical_recommendations_json)
        except json.JSONDecodeError:
            return {}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "uploaded_by": self.uploaded_by,
            "scan_type": self.scan_type,
            "file_path": self.file_path,
            "ai_inference_results": self.get_inference_results(),
            "clinical_recommendations": self.get_clinical_recommendations(),
            "confidence_score": self.confidence_score,
            "uploaded_at": self.uploaded_at.isoformat() + "Z" if self.uploaded_at else None,
        }
