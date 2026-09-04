import os
import json
from typing import Optional

from backend.app.utils.anonymizer import scrub_phi
from backend.app.config import BaseConfig


class QwenClinicalService:
    def __init__(self, model: Optional[str] = None):
        self._client = None
        self.model = model or os.getenv("QWEN_MODEL", "qwen-plus")
        self.api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
        self.base_url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
        self.disclaimer = BaseConfig.AI_DISCLAIMER

    @property
    def client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
            )
        return self._client

    @property
    def is_live(self) -> bool:
        return bool(self.api_key) and self.api_key not in {"your-dashscope-api-key"}

    def _mock_overview(self, scan_flags: dict = None) -> dict:
        sf = scan_flags or {}
        flags = sf.get("flags", [])
        scan_type = sf.get("scan_type", "MRI")

        # Build scan-specific analysis
        if flags:
            # Anomalies detected — generate flag-specific response
            flag_details = "; ".join(
                f"{f['label']} ({f['confidence']}% confidence)" for f in flags
            )
            unique_labels = list(set(f["label"] for f in flags))

            scan_analysis = (
                f"YOLOv8 inference on {scan_type} detected {len(flags)} flagged region(s): {flag_details}. "
            )

            # Generate specific clinical context per detection type
            clinical_notes = []
            for label in unique_labels:
                label_lower = label.lower()
                if any(kw in label_lower for kw in ["fracture", "crack", "break"]):
                    clinical_notes.append(
                        f"Detected potential fracture pattern ({label}). "
                        "Recommend orthopedic consultation and confirmatory CT if not already performed."
                    )
                elif any(kw in label_lower for kw in ["opacity", "infiltrate", "consolidation"]):
                    clinical_notes.append(
                        f"Opacity/infiltrate region flagged ({label}). "
                        "Consider pneumonia vs. atelectasis; correlate with clinical presentation and CBC."
                    )
                elif any(kw in label_lower for kw in ["mass", "tumor", "lesion", "nodule"]):
                    clinical_notes.append(
                        f"Space-occupying lesion flagged ({label}). "
                        "Recommend contrast-enhanced MRI/CT for characterization and biopsy consideration."
                    )
                elif any(kw in label_lower for kw in ["effusion", "fluid"]):
                    clinical_notes.append(
                        f"Fluid collection/effusion flagged ({label}). "
                        "Assess clinical significance; consider drainage if symptomatic."
                    )
                elif any(kw in label_lower for kw in ["hemorrhage", "bleed", "blood"]):
                    clinical_notes.append(
                        f"Hemorrhage pattern flagged ({label}). "
                        "URGENT: Assess neurological status and consider emergency neurosurgical consultation."
                    )
                elif any(kw in label_lower for kw in ["cardiomegaly", "enlarged"]):
                    clinical_notes.append(
                        f"Organ enlargement flagged ({label}). "
                        "Correlate with echocardiography and BNP levels."
                    )
                else:
                    clinical_notes.append(
                        f"Anomalous region detected ({label}). "
                        "Clinical correlation recommended with additional imaging if indicated."
                    )

            critical_obs = [
                f"{scan_type} scan shows {len(flags)} AI-flagged region(s): {flag_details}",
                "AI detection requires physician confirmation before clinical action.",
            ]
            if any(f["confidence"] > 70 for f in flags):
                critical_obs.insert(0, "HIGH CONFIDENCE detection — prioritize clinical review.")

            return {
                "clinical_snapshot": scan_analysis + " | ".join(clinical_notes[:2]),
                "critical_observations": critical_obs,
                "differential_considerations": clinical_notes,
                "drug_interaction_notes": "No active prescriptions to cross-reference. Review patient medication history before prescribing.",
                "scan_findings": {
                    "scan_type": scan_type,
                    "total_flags": len(flags),
                    "detections": flags,
                    "severity": "HIGH" if any(f["confidence"] > 70 for f in flags) else "MODERATE",
                },
                "disclaimer": self.disclaimer,
                "mode": "mock",
            }

        elif sf.get("is_normal") is True:
            # Scan is clean — no flags
            return {
                "clinical_snapshot": (
                    f"YOLOv8 inference on {scan_type} completed — no anomalies detected. "
                    "Scan appears within normal limits. Correlate with clinical presentation."
                ),
                "critical_observations": [
                    f"{scan_type} scan: No flagged regions detected by AI.",
                    "Clinical symptoms may not correlate with imaging — continue evaluation if symptomatic.",
                ],
                "differential_considerations": [
                    "Imaging within normal limits; consider functional or non-structural causes.",
                    "If symptoms persist, recommend follow-up imaging or alternative diagnostic modality.",
                ],
                "drug_interaction_notes": "No active prescriptions to cross-reference.",
                "scan_findings": {
                    "scan_type": scan_type,
                    "total_flags": 0,
                    "detections": [],
                    "severity": "NORMAL",
                },
                "disclaimer": self.disclaimer,
                "mode": "mock",
            }

        elif sf.get("is_normal") is None:
            # Model unavailable
            return {
                "clinical_snapshot": (
                    f"{scan_type} scan uploaded but AI model is currently unavailable. "
                    "Manual radiologist review recommended."
                ),
                "critical_observations": [
                    "YOLOv8 model offline — automated scan analysis not performed.",
                    "Manual review of imaging required before clinical decision.",
                ],
                "differential_considerations": [
                    "Await radiologist report for scan interpretation.",
                ],
                "drug_interaction_notes": "No active prescriptions to cross-reference.",
                "scan_findings": {
                    "scan_type": scan_type,
                    "total_flags": 0,
                    "detections": [],
                    "severity": "MODEL_UNAVAILABLE",
                },
                "disclaimer": self.disclaimer,
                "mode": "mock",
            }

        else:
            # No scan at all
            return {
                "clinical_snapshot": (
                    "Mock mode: 42-year-old female with two weeks of tension headaches and "
                    "mild episodic dizziness. No scan data available for analysis."
                ),
                "critical_observations": [
                    "No diagnostic scans on record for this patient.",
                    "Mock observation: resting heart rate trend is within normal limits.",
                ],
                "differential_considerations": [
                    "Tension-type headache",
                    "Benign paroxysmal positional vertigo",
                ],
                "drug_interaction_notes": "No active prescriptions in mock record; no interactions to report.",
                "scan_findings": None,
                "disclaimer": self.disclaimer,
                "mode": "mock",
            }

    def _force_disclaimer(self, payload: dict) -> dict:
        payload["disclaimer"] = self.disclaimer
        return payload

    def generate_clinical_overview(
        self,
        patient_id: int,
        clinical_history: str,
        vitals_summary: str,
        latest_scans: str,
        scan_flags: dict = None,
    ) -> dict:
        """
        Synthesizes patient longitudinal records into a non-diagnostic
        Clinical Decision Support summary.
        """
        # Scrub all text inputs for PHI before sending to the LLM.
        clean_history = scrub_phi(clinical_history, patient_id)
        clean_vitals = scrub_phi(vitals_summary, patient_id)
        clean_scans = scrub_phi(latest_scans, patient_id)

        if not self.is_live:
            return self._mock_overview(scan_flags)

        system_prompt = (
            "You are an expert Clinical Decision Support System (CDSS) assistant for qualified doctors.\n"
            "Analyze the de-identified medical context, vitals, and scan findings provided.\n\n"
            "IMPORTANT — SCAN FLAG ANALYSIS:\n"
            "If YOLOv8 has flagged specific anomalies in the scan, you MUST:\n"
            "1. List each flagged detection with its label and confidence.\n"
            "2. Explain the clinical significance of each flagged finding.\n"
            "3. Suggest appropriate follow-up actions for each flag.\n"
            "4. If no flags are detected (normal scan), confirm the scan is within normal limits.\n\n"
            "Return a strictly valid JSON object matching this schema:\n"
            "{\n"
            '  "clinical_snapshot": "Concise summary with specific scan findings",\n'
            '  "critical_observations": ["Observation about each flagged region", "Vital concerns"],\n'
            '  "differential_considerations": ["Differential based on specific flags"],\n'
            '  "drug_interaction_notes": "Safety warnings or no contraindications found",\n'
            '  "scan_findings": {\n'
            '    "scan_type": "MRI/CT/X-Ray",\n'
            '    "total_flags": 0,\n'
            '    "detections": [{"label": "name", "confidence": 0}],\n'
            '    "severity": "NORMAL/MODERATE/HIGH"\n'
            '  },\n'
            '  "disclaimer": "Clinical Decision Support only. Requires licensed physician validation."\n'
            "}\n"
            "Do not output markdown codeblocks. Return pure raw JSON."
        )

        user_content = (
            f"CLINICAL DATA:\n{clean_history}\n\n"
            f"RECENT VITALS TELEMETRY:\n{clean_vitals}\n\n"
            f"LAB & SCAN FINDINGS:\n{clean_scans}\n\n"
            f"YOLO SCAN FLAGS: {json.dumps(scan_flags or {})}"
        )

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            payload = json.loads(response.choices[0].message.content)
            payload = self._force_disclaimer(payload)
            payload["mode"] = "live"
            # Ensure scan_findings exists in live response
            if "scan_findings" not in payload:
                payload["scan_findings"] = scan_flags or None
            return payload
        except Exception as e:
            return {
                "clinical_snapshot": "Automated summary currently unavailable.",
                "critical_observations": [f"Inference error: {str(e)}"],
                "differential_considerations": ["Review manual EHR records."],
                "drug_interaction_notes": "Manual verification required.",
                "scan_findings": scan_flags or None,
                "disclaimer": self.disclaimer,
                "mode": "offline",
            }
