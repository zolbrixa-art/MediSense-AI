from flask import Flask


def register_blueprints(app: Flask) -> None:
    # Imported here to avoid circular imports with models/extensions.
    from .auth import auth_bp
    from .appointments import appointments_bp
    from .emr import emr_bp
    from .imaging import imaging_bp
    from .vitals import vitals_bp
    from .ai_engine import ai_engine_bp
    from .admin import admin_bp
    from .patient import patient_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(appointments_bp, url_prefix="/api/appointments")
    app.register_blueprint(emr_bp, url_prefix="/api/emr")
    app.register_blueprint(imaging_bp, url_prefix="/api/imaging")
    app.register_blueprint(vitals_bp, url_prefix="/api/vitals")
    app.register_blueprint(ai_engine_bp, url_prefix="/api/ai")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(patient_bp, url_prefix="/api/patient")
