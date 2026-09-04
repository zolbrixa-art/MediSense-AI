# Product Requirements Document (PRD)

## 1. Project Overview
* **Product Name:** MediSense AI
* **Version:** 1.0.0
* **Target Audience:** OPD Clinics, Hospital Administrations, Attending Physicians, Patients
* **Core Value Proposition:** A connected healthcare ecosystem uniting deterministic OPD queue management, longitudinal EHRs, wearable vitals telemetry, and non-diagnostic Clinical Decision Support (CDSS) powered by Alibaba Qwen and PyTorch/YOLOv8 vision models.

---

## 2. User Roles & Permissions Matrix

| Feature / Module | Patient | Doctor | Admin | Lab Tech |
| :--- | :---: | :---: | :---: | :---: |
| Book Appointment & Receive Token | ✅ | ❌ | ❌ | ❌ |
| View Personal Medical History & Vitals | ✅ | ❌ | ❌ | ❌ |
| Real-time Token Queue Monitor | ✅ | ✅ | ✅ | ❌ |
| Patient EMR Access (Active Token) | ❌ | ✅ | ❌ | ❌ |
| Run Qwen AI EHR Clinical Summary | ❌ | ✅ | ❌ | ❌ |
| Inspect Scan Overlays (YOLOv8) | ❌ | ✅ | ❌ | ✅ |
| Sign & Finalize Prescription / Notes | ❌ | ✅ | ❌ | ❌ |
| Upload X-Ray / MRI Diagnostics | ❌ | ❌ | ❌ | ✅ |
| Doctor Scheduling & Department Config | ❌ | ❌ | ✅ | ❌ |
| Audit Logs & Security Metrics | ❌ | ❌ | ✅ | ❌ |

---

## 3. Core Functional Requirements

### 3.1 Deterministic Queue & Token Engine
* Assign sequential, collision-free numeric tokens per doctor/department shift.
* Broadcast live token state transitions (`PENDING` $\rightarrow$ `IN_CONSULTATION` $\rightarrow$ `COMPLETED` $\rightarrow$ `SKIPPED`) over WebSockets.
* Provide an estimated wait time based on a rolling average of consultation durations.

### 3.2 Alibaba Qwen AI Clinical Decision Support (CDSS)
* Strip all Personally Identifiable Information (PII) before sending payload to Qwen LLM.
* Aggregate last 3 clinical encounters, active prescriptions, latest lab results, and 24-hour vital trends into a standardized prompt.
* Enforce structured JSON schema output containing:
  * **Clinical Snapshot:** 2-sentence longitudinal context.
  * **Key Red Flags:** Critical deviations in labs or vitals.
  * **Differential Pointers:** Non-binding clinical markers for physician review.
  * **Contraindication Alerts:** Potential drug-to-drug or drug-to-condition clashes.

### 3.3 Medical Computer Vision Imaging Pipeline
* Accept high-resolution DICOM, PNG, and JPEG formats.
* Route image to YOLOv8/PyTorch specialized weights (e.g., Bone Fracture Detection, Brain MRI Lesion Localization).
* Persist bounding box coordinates, label taxonomy, and confidence scores ($0.00 - 1.00$) in SQL Server.

### 3.4 Wearable Vitals Telemetry & Triage Engine
* Ingest periodic data: Heart Rate (BPM), SpO2 (%), Temperature (°F), and Sleep Quality.
* Trigger instant high-priority alerts on doctor dashboard when:
  * Resting Heart Rate $> 110\text{ BPM}$ or $< 50\text{ BPM}$
  * $\text{SpO2} < 92\%$

---

## 4. Non-Functional Requirements
* **Inference Latency:** Qwen summary generation $< 2.0\text{s}$; YOLO vision inference $< 400\text{ms}$.
* **Queue Latency:** WebSocket broadcast propagation $< 100\text{ms}$.
* **Availability:** Graceful fallback to raw medical records if AI services are unavailable.
* **Compliance:** Explicit non-diagnostic disclaimer visible on all AI output surfaces.