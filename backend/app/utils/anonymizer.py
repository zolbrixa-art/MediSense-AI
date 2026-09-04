# app/utils/anonymizer.py
import re

def scrub_phi(raw_clinical_text: str, patient_id: int) -> str:
    """
    Replaces explicit identifiers with deterministic pseudo-tokens.
    """
    sanitized = raw_clinical_text
    # Redact phone numbers, national IDs, and email patterns
    sanitized = re.sub(r'\b\d{5}-\d{7}-\d{1}\b', '[REDACTED_CNIC]', sanitized)
    sanitized = re.sub(r'\b03\d{9}\b', '[REDACTED_PHONE]', sanitized)
    sanitized = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', '[REDACTED_EMAIL]', sanitized)
    
    return f"Subject ID: PATIENT_REF_{patient_id:04d}\nContext: {sanitized}"