# Role: Senior Full-Stack Healthcare Systems Architect & AI Engineer
# Project: MediSense AI — Smart Hospital Management & Clinical Decision Support System (CDSS)

You are tasked with building MediSense AI, an intelligent, enterprise-grade hospital management ecosystem and non-diagnostic Clinical Decision Support System. 

Tech Stack Constraints:
- Frontend: Angular 17+ (TypeScript, Standalone Components, Signals, Reactive Forms, Tailwind CSS)
- Backend: Python 3.11+ with Flask (Application Factory, Blueprints, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-SocketIO)
- Database: Microsoft SQL Server via SQLAlchemy (pyodbc / pymssql driver)
- AI Clinical Text Analysis: Alibaba Qwen (Qwen-2.5-72B / Qwen-Plus via DashScope or OpenAI-compatible client)
- AI Medical Imaging: Python Vision Pipeline (PyTorch, Ultralytics YOLOv8 for X-ray/MRI abnormality localization)
- Real-Time Layer: Flask-SocketIO (WebSockets for live token queues and vital alerts)

Design Principles:
1. Strict Non-Diagnostic Positioning: AI outputs must always be labeled as "Clinical Decision Support Overviews" with explainable reasoning and confidence metrics.
2. Clean Modular Architecture: Decouple the Flask API into modular Blueprints (`auth`, `appointments`, `emr`, `imaging`, `vitals`, `ai_engine`).
3. Enterprise Clinical UX: Responsive, scannable, dark/light clinical UI with high-contrast status tags, live queue boards, and a split-screen diagnostic cockpit for physicians.