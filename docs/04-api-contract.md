# MediSense AI — API Contract

Base URL: `http://127.0.0.1:5000/api`

Response envelope:

```json
{ "ok": true, "data": { ... } }
```

or

```json
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

## Authentication

### POST /auth/signup
Create a new account.

**Body:**
```json
{
  "full_name": "Aisha Khan",
  "email": "aisha@example.com",
  "password": "Secure123!",
  "role": "Patient"
}
```

Valid roles: `Patient`, `Doctor`, `Admin`, `LabTech`.

### POST /auth/login
Obtain a JWT access token.

**Body:**
```json
{
  "email": "doctor@medisense.local",
  "password": "Doctor123!"
}
```

### GET /auth/me
Return the current authenticated user.

## Appointments

### GET /appointments/doctors
List available doctors and departments.

### POST /appointments/book
Book an appointment and receive a deterministic token number.

**Body:**
```json
{
  "doctor_id": 2,
  "scheduled_time": "2026-08-30T14:00:00"
}
```

### GET /appointments/my
Return the current patient's appointments.

### GET /appointments/queue/{doctor_id}
Return the live queue for a doctor.

### POST /appointments/{appointment_id}/next
Doctor only. Complete current appointment and advance to the next patient.

### POST /appointments/{appointment_id}/skip
Doctor only. Skip the current appointment.

## EMR

### GET /emr/patient/{patient_id}
Read a patient's EMR. Doctors require an active consultation; patients may only read their own record.

### POST /emr/encounter
Create a clinical encounter. Doctor only; requires active consultation.

**Body:**
```json
{
  "patient_id": 1,
  "appointment_id": 2,
  "subjective": "...",
  "assessment": "...",
  "plan": "...",
  "prescriptions": [
    { "drug_name": "Paracetamol", "dose": "500mg", "frequency": "Every 6 hours", "duration": "3 days" }
  ]
}
```

### POST /emr/encounter/{encounter_id}/sign
Sign an encounter, making it immutable.

## Imaging

### POST /imaging/upload
Upload a scan and run YOLOv8 inference (if vision dependencies are installed).

**Multipart form fields:**
- `file` — PNG, JPG, JPEG, or DCM
- `patient_id`
- `scan_type` — `X-Ray`, `MRI`, or `CT`

### GET /imaging/patient/{patient_id}/scans
List scans for a patient.

### GET /imaging/scan/{scan_id}
Get scan details including AI inference results.

### GET /imaging/scan/{scan_id}/file
Serve the original scan file.

## Vitals

### POST /vitals/ingest
Record a vital reading and evaluate triage thresholds.

**Body:**
```json
{
  "patient_id": 1,
  "heart_rate": 82,
  "spo2": 97,
  "temperature_f": 98.6,
  "sleep_quality": "Good"
}
```

### GET /vitals/patient/{patient_id}/latest
Get the latest vital reading.

### GET /vitals/patient/{patient_id}/trend?hours=24
Get vital trend series for the last N hours.

### GET /vitals/alerts
Doctor/Admin only. Recent CRITICAL vital alerts.

## AI Engine

### POST /ai/clinical-overview
Generate a non-diagnostic Clinical Decision Support overview for the active consultation patient.

**Body:**
```json
{ "patient_id": 1 }
```

The response always includes `disclaimer` and `mode` (`live`, `mock`, or `offline`).

### GET /ai/health
Return AI service availability: `{ qwen: "live|mock", vision: true|false }`.

## Health

### GET /api/health
Public liveness check.
