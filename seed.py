import os
import sys

project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from dotenv import load_dotenv
load_dotenv(os.path.join(project_root, ".env"))

from backend.app import create_app
from backend.app.extensions import db
from backend.app.models import User


ADMIN_EMAIL = "admin@medisense.com"
ADMIN_PASSWORD = "MediSense AI"


def seed():
    app = create_app()
    with app.app_context():
        # Clear existing data for a clean database
        db.drop_all()
        db.create_all()

        print("Seeding single admin account...")

        admin = User(
            email=ADMIN_EMAIL,
            full_name="MediSense Admin",
            role="Admin"
        )
        admin.set_password(ADMIN_PASSWORD)

        db.session.add(admin)
        db.session.commit()

        print("\n=== Database Cleaned & Seed Completed ===")
        print("Admin Account Created:")
        print(f"  Email:    {ADMIN_EMAIL}")
        print(f"  Password: {ADMIN_PASSWORD}")


if __name__ == "__main__":
    seed()
