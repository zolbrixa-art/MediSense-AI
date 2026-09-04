import os
from flask import Flask, jsonify, redirect, request, send_from_directory

from backend.app.config import config_by_name
from backend.app.extensions import db, jwt, cors, bcrypt
from backend.app.blueprints import register_blueprints


def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "default")

    app = Flask(__name__, static_folder="static", static_url_path="")
    app.config.from_object(config_by_name[config_name])

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    bcrypt.init_app(app)

    with app.app_context():
        db.create_all()

    # Ensure upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Register blueprints
    register_blueprints(app)

    # Public health check
    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"ok": True, "service": "MediSense AI"}), 200

    # Explicit static page routes so these pages are never caught by the SPA fallback.
    @app.route("/signup.html", methods=["GET"])
    def serve_signup_page():
        return app.send_static_file("signup.html")

    @app.route("/login.html", methods=["GET"])
    def serve_login_page():
        return app.send_static_file("login.html")

    # Serve actual static assets before falling back to the SPA shell.
    @app.route("/<path:path>", methods=["GET"])
    def spa(path):
        if path.startswith("api/"):
            return jsonify({"ok": False, "error": {"code": "NOT_FOUND", "message": "API route not found"}}), 404

        static_file = os.path.join(app.static_folder, path)
        if os.path.isfile(static_file):
            return send_from_directory(app.static_folder, path)

        return send_from_directory(app.static_folder, "index.html")

    @app.route("/", methods=["GET"])
    def index():
        return redirect("/login.html", code=302)

    @app.route("/index.html", methods=["GET"])
    def index_html():
        return app.send_static_file("index.html")

    # Global error handlers: return JSON only for API routes; serve the SPA for everything else.
    def _is_api_request():
        return request.path.startswith("/api/")

    @app.errorhandler(400)
    def bad_request(error):
        if _is_api_request():
            return jsonify({"ok": False, "error": {"code": "BAD_REQUEST", "message": str(error.description)}}), 400
        return send_from_directory(app.static_folder, "index.html")

    @app.errorhandler(401)
    def unauthorized(error):
        if _is_api_request():
            return jsonify({"ok": False, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}), 401
        return send_from_directory(app.static_folder, "index.html")

    @app.errorhandler(403)
    def forbidden(error):
        if _is_api_request():
            return jsonify({"ok": False, "error": {"code": "FORBIDDEN", "message": str(error.description) or "Forbidden"}}), 403
        return send_from_directory(app.static_folder, "index.html")

    @app.errorhandler(404)
    def not_found(error):
        if _is_api_request():
            return jsonify({"ok": False, "error": {"code": "NOT_FOUND", "message": "Resource not found"}}), 404
        return send_from_directory(app.static_folder, "index.html")

    @app.errorhandler(413)
    def too_large(error):
        if _is_api_request():
            return jsonify({"ok": False, "error": {"code": "PAYLOAD_TOO_LARGE", "message": "File too large"}}), 413
        return send_from_directory(app.static_folder, "index.html")

    @app.errorhandler(500)
    def internal_error(error):
        if _is_api_request():
            return jsonify({"ok": False, "error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}}), 500
        return send_from_directory(app.static_folder, "index.html")

    return app
