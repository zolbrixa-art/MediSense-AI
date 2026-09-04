# Healthcare Security, Compliance & Data Governance

## 1. Role-Based Access Control (RBAC)
Endpoint authorization enforced through standard Python decorators:

```python
# app/utils/security.py
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt

def role_required(*allowed_roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if claims.get("role") not in allowed_roles:
                return jsonify({"error": "Forbidden: Insufficient privileges for this clinical resource"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator