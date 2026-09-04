# MediSense Prescription System - Implementation Guide

## What's Been Built

### 1. **Prescription Service** (`backend/app/services/prescription_service.py`)
   - Generates prescription images from the MediSense Rx.png template
   - Uses PIL (Pillow) to overlay patient/doctor data
   - Automatically saves prescriptions to `uploads/patient_{id}/prescriptions/` folder
   - Formats medications with dose, frequency, duration

### 2. **Backend Changes**

#### Models (`backend/app/models/clinical.py`)
   - Updated `Prescription` model with new `file_path` field
   - Stores the path to generated prescription image

#### EMR Blueprint (`backend/app/blueprints/emr.py`)
   - **`POST /api/emr/encounter`** - Now auto-generates prescription images when encounter is created
   - **`GET /api/emr/prescription/<id>/download`** - Downloads prescription image
   - **`GET /api/emr/encounter/<id>/prescriptions`** - Gets prescriptions with download URLs

#### Patient Blueprint (`backend/app/blueprints/patient.py`)
   - **`GET /api/patient/records`** - Updated to include `download_url` for each prescription

### 3. **Frontend Changes**

#### Patient Health Records (`backend/app/static/js/views/patientRecords.js`)
   - Shows " Download" button for each prescription with file
   - Clicking download triggers `downloadPrescription()` function
   - Downloads prescription image as PNG file

## How It Works (End-to-End)

### When Doctor Issues Prescription:
1. Doctor fills in encounter notes + prescriptions
2. Calls `POST /api/emr/encounter` with prescription data
3. Backend creates EncounterNote and Prescription records
4. **Automatically generates prescription image:**
   - Opens template (MediSense Rx.png)
   - Fills in: Patient Name, Doctor Name, Date, Age
   - Lists medications with dose/frequency/duration
   - Saves as: `uploads/patient_{id}/prescriptions/prescription_{encounter_id}_{timestamp}.png`
5. Stores file path in Prescription.file_path

### When Patient Views Records:
1. Calls `GET /api/patient/records`
2. Returns encounters with prescriptions including `download_url`
3. Frontend renders " Download" button for each prescription
4. Clicking button calls: `GET /api/emr/prescription/{id}/download`
5. Browser downloads prescription image as PNG

## File Paths

- **Template:** `MediSense Rx.png` (in root, has placeholders for patient/doctor data)
- **Prescriptions saved to:** `uploads/patient_1/prescriptions/prescription_123_20260901_125000.png`
- **API routes:** `/api/emr/prescription/{id}/download`

## Testing the System

### Prerequisites:
1. ✅ Doctor and Patient accounts exist
2. ✅ Active appointment in IN_CONSULTATION status
3. ✅ MediSense Rx.png template in project root

### Test Flow:

#### Step 1: Create Encounter with Prescriptions (As Doctor)
```
POST http://127.0.0.1:5000/api/emr/encounter
Authorization: Bearer {doctor_token}

{
  "patient_id": 2,
  "appointment_id": 1,
  "subjective": "Patient complains of headache",
  "assessment": "Tension headache",
  "plan": "Rest and hydration",
  "prescriptions": [
    {
      "drug_name": "Paracetamol",
      "dose": "500mg",
      "frequency": "Every 6 hours",
      "duration": "5 days"
    },
    {
      "drug_name": "Ibuprofen",
      "dose": "400mg",
      "frequency": "Every 8 hours",
      "duration": "3 days"
    }
  ]
}
```

**Expected Response:** 
- ✅ Encounter created
- ✅ Prescriptions created
- ✅ Prescription image generated and saved
- ✅ file_path stored in database

#### Step 2: View Patient Records (As Patient)
```
GET http://127.0.0.1:5000/api/patient/records
Authorization: Bearer {patient_token}
```

**Expected Response:**
```json
{
  "ok": true,
  "data": [
    {
      "encounter_id": 1,
      "created_at": "2026-09-01T...",
      "doctor_name": "Dr. Ahmed",
      "prescriptions": [
        {
          "id": 1,
          "drug_name": "Paracetamol",
          "dose": "500mg",
          "download_url": "/api/emr/prescription/1/download"
        }
      ]
    }
  ]
}
```

#### Step 3: Download Prescription (As Patient)
```
GET http://127.0.0.1:5000/api/emr/prescription/1/download
Authorization: Bearer {patient_token}
```

**Expected Result:**
- ✅ Prescription image downloads as `prescription_1.png`
- ✅ Opens in browser or downloads to device
- ✅ Contains patient name, doctor name, date, medications

#### Step 4: Verify in Patient Portal
1. Login as Patient
2. Navigate to "Health Records & Prescriptions"
3. View encounters and prescriptions
4. Click " Download" button on any prescription
5. PNG file downloads to device

## Features

✅ **Automatic Generation:** Prescriptions auto-generated when encounter created
✅ **Template-Based:** Uses professional MediSense Rx template
✅ **Patient Access:** Patients can view and download their prescriptions
✅ **Organized Storage:** Prescriptions saved in patient-specific folders
✅ **Security:** Patient can only access their own, Doctor only their own
✅ **Download:** Click and download as PNG image

## Next Steps (Optional Enhancements)

1. **PDF Conversion:** Convert PNG to PDF for printing
2. **Email Delivery:** Email prescriptions to patient
3. **Digital Signature:** Add doctor digital signature to prescription image
4. **Print Preview:** Show print preview before printing
5. **Prescription History:** Archive all prescriptions per patient
6. **Medicine Reminders:** Auto-create reminders from prescriptions
7. **Insurance Integration:** Add insurance information to prescription

## Troubleshooting

### Issue: Prescription image not generating
- Check if `MediSense Rx.png` exists in project root
- Check if `uploads/patient_X/prescriptions/` directory is writable
- Check Flask logs for PrescriptionService errors

### Issue: Download not working
- Verify `file_path` is stored in database
- Check if file exists at the path
- Verify user is authenticated and authorized

### Issue: Download button not showing
- Ensure encounter has prescriptions with `file_path` set
- Check browser console for JavaScript errors
- Verify API returns `download_url` field

## Files Modified/Created

**New Files:**
- `backend/app/services/prescription_service.py` - Prescription generation service

**Modified Files:**
- `backend/app/models/clinical.py` - Added file_path to Prescription model
- `backend/app/blueprints/emr.py` - Added prescription generation & download
- `backend/app/blueprints/patient.py` - Added download_url to records
- `backend/app/services/__init__.py` - Exported PrescriptionService
- `backend/app/static/js/views/patientRecords.js` - Added download UI

**Database Migration:**
- Run `python run.py` to create new `file_path` column in Prescriptions table
