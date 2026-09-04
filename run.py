import os
import sys
import argparse

# Ensure project root is on Python path so `backend.app` imports work
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from dotenv import load_dotenv
load_dotenv(os.path.join(project_root, ".env"))

from backend.app import create_app
from backend.app.extensions import db
from backend.app.models import User, DoctorSchedule, Appointment, DiagnosticScan, AuditLog
from backend.app.models import EncounterNote, VitalReading, Prescription


def main():
    parser = argparse.ArgumentParser(description="MediSense AI Flask server")
    parser.add_argument("--init-db", action="store_true", help="Create all database tables")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=5000, help="Port to bind")
    args = parser.parse_args()

    app = create_app()

    if args.init_db:
        with app.app_context():
            db.create_all()
        print("Database initialized.")
        return

    app.run(host=args.host, port=args.port, debug=True, use_reloader=False)


if __name__ == "__main__":
    main()
