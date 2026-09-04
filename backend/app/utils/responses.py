from flask import jsonify


def ok(data=None, message=None):
    payload = {"ok": True}
    if data is not None:
        payload["data"] = data
    if message is not None:
        payload["message"] = message
    return jsonify(payload)


def fail(code: str, message: str, status_code: int = 400):
    return jsonify({"ok": False, "error": {"code": code, "message": message}}), status_code
