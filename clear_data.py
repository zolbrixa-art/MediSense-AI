import os
import sys

# Ensure project root is on Python path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from dotenv import load_dotenv
load_dotenv(os.path.join(project_root, ".env"))

from backend.app import create_app
from backend.app.extensions import db
from backend.app.models import (
    User, DoctorSchedule, Appointment, DiagnosticScan, AuditLog,
    EncounterNote, VitalReading, Prescription
)

def clear_all_data():
    """Clear all data from database tables while keeping the schema."""
    app = create_app()
    
    with app.app_context():
        print("Clearing all database entries...")
        
        # Delete all records except Admin accounts, which must remain available for login.
        tables = [
            ("Appointments", Appointment),
            ("Vital Readings", VitalReading),
            ("Prescriptions", Prescription),
            ("Encounter Notes", EncounterNote),
            ("Diagnostic Scans", DiagnosticScan),
            ("Doctor Schedules", DoctorSchedule),
            ("Audit Logs", AuditLog),
            ("Users", User),
        ]
        
        for table_name, model in tables:
            if model is User:
                count = model.query.filter(User.role != "Admin").delete(synchronize_session=False)
                preserved_count = model.query.filter_by(role="Admin").count()
                print(f"  ✓ Deleted {count} records from {table_name} ({preserved_count} Admin account(s) preserved)")
                continue

            count = model.query.delete(synchronize_session=False)
            print(f"  ✓ Deleted {count} records from {table_name}")
        
        db.session.commit()
        print("\n✓ All data cleared successfully! Table structure preserved.")

if __name__ == "__main__":
    clear_all_data()
