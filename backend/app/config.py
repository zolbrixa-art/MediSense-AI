import os
from datetime import timedelta


# Project root is two levels above this file: backend/app/config.py -> project root
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


class BaseConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", "24"))
    )
    JWT_TOKEN_LOCATION = ["headers", "query_string"]
    JWT_QUERY_STRING_NAME = "jwt"
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Default to an absolute SQLite path so the database file is found regardless
    # of the current working directory.
    _default_sqlite_path = os.path.join(PROJECT_ROOT, "db", "medisense.db")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{_default_sqlite_path}",
    )

    UPLOAD_FOLDER = os.path.abspath(
        os.getenv("UPLOAD_FOLDER", os.path.join(PROJECT_ROOT, "uploads"))
    )
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH_MB", "25")) * 1024 * 1024
    ALLOWED_SCAN_EXTENSIONS = {"png", "jpg", "jpeg", "dcm"}

    AI_DISCLAIMER = (
        "Clinical Decision Support only. All clinical evaluations and diagnoses "
        "remain the responsibility of a licensed physician."
    )


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class ProductionConfig(BaseConfig):
    DEBUG = False


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
