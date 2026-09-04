from typing import List, Tuple


class AlertLevel:
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


def evaluate_vitals(
    heart_rate: int | None,
    spo2: int | None,
    temperature_f: float | None,
) -> Tuple[str, List[str]]:
    """
    Evaluate vitals against PRD triage thresholds.
    Returns (alert_level, reasons).
    """
    reasons = []

    if heart_rate is not None:
        if heart_rate > 110:
            reasons.append(f"Heart rate {heart_rate} BPM is elevated (>110)")
        elif heart_rate < 50:
            reasons.append(f"Heart rate {heart_rate} BPM is bradycardic (<50)")

    if spo2 is not None and spo2 < 92:
        reasons.append(f"SpO2 {spo2}% is low (<92%)")

    if temperature_f is not None and temperature_f >= 100.4:
        reasons.append(f"Temperature {temperature_f}°F indicates fever (≥100.4°F)")

    if not reasons:
        return AlertLevel.NORMAL, ["All monitored vitals within normal thresholds"]

    # Any critical threshold triggers CRITICAL; fever alone is WARNING.
    critical_keywords = ("Heart rate", "SpO2")
    if any(keyword in reason for reason in reasons for keyword in critical_keywords):
        return AlertLevel.CRITICAL, reasons

    return AlertLevel.WARNING, reasons
