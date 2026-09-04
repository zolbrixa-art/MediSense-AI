# MediSense AI

A smart hospital management and non-diagnostic Clinical Decision Support System (CDSS) prototype.

## Scope

This workspace integrates the provided design documents, SQL schemas, AI service snippets, and frontend markup into a single runnable Flask backend + static SPA frontend.

**Intentionally pragmatic choices for this session:**

- **Frontend:** Vanilla ES-module SPA served by Flask. Node.js is not installed in this environment, so an Angular workspace cannot be built or verified here. The Angular cockpit template has been ported to a CSS-variable-based SPA.
- **Database:** SQLite by default. SQLAlchemy models are dialect-neutral; a commented `mssql+pyodbc` URI is provided for MS SQL Server migration.
- **AI Vision:** Optional / mock mode. `torch` and `ultralytics` are split into `requirements-vision.txt` because the full download is large. The imaging endpoint returns a structured `MODEL_UNAVAILABLE` response when vision dependencies are absent.
- **Qwen CDSS:** Live when `DASHSCOPE_API_KEY` is set; deterministic mock output otherwise.

## Quick Start

```bash
# 1. Create virtual environment and install core dependencies
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt

# 2. Configure environment (edit .env if needed)
copy .env.example .env

# 3. Initialize SQLite database and seed demo users
python run.py --init-db
python seed.py

# 4. Run the development server
python run.py
```

Open `http://127.0.0.1:5000/signup.html` to create an account, or `http://127.0.0.1:5000/login.html` to sign in.

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Patient | `patient@medisense.local` | `Patient123!` |
| Doctor | `doctor@medisense.local` | `Doctor123!` |
| Admin | `admin@medisense.com` | `MediSense AI` |
| Lab Tech | `labtech@medisense.local` | `Labtech123!` |

## Optional: Enable Real YOLOv8 Vision

```bash
pip install -r requirements-vision.txt
# Place your weights at weights/best_medical_yolo.pt
```

## Optional: Enable Live Qwen

Set a real DashScope API key in `.env`:

```env
DASHSCOPE_API_KEY=your-key-here
```

## Project Layout

```
backend/app/          Flask application factory, blueprints, models, services
backend/app/static/   SPA frontend (HTML, CSS, JS)
db/                   SQLite database + MSSQL schema reference
docs/                 Design docs and API contract
uploads/              Uploaded scan files (dev)
weights/              YOLOv8 .pt drop point
```

## Non-Diagnostic Disclaimer

All AI-generated outputs in this application are explicitly labeled as **Clinical Decision Support only** and require validation by a licensed physician. This is enforced server-side on every AI response.
