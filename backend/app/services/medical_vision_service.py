import os
import traceback
from typing import Optional

from backend.app.config import PROJECT_ROOT

# Lazy import flags. torch/ultralytics are optional dependencies.
try:
    import torch  # noqa: F401
    TORCH_AVAILABLE = True
except Exception:
    TORCH_AVAILABLE = False

VISION_AVAILABLE = False
YOLO = None
LAST_ERROR = None


def _load_yolo(weights_path: str):
    global VISION_AVAILABLE, YOLO, LAST_ERROR
    if YOLO is not None:
        return YOLO
    try:
        from ultralytics import YOLO as _YOLO

        # Make path absolute if relative
        if not os.path.isabs(weights_path):
            weights_path = os.path.join(PROJECT_ROOT, weights_path)

        if os.path.exists(weights_path):
            model = _YOLO(weights_path)
        else:
            # Fallback to default model
            model = _YOLO("yolov8n.pt")

        YOLO = _YOLO
        VISION_AVAILABLE = True
        LAST_ERROR = None
        return model
    except Exception as e:
        VISION_AVAILABLE = False
        LAST_ERROR = f"{type(e).__name__}: {str(e)}"
        traceback.print_exc()
        return None


class MedicalVisionService:
    def __init__(self, weights_path: str = None):
        if weights_path is None:
            weights_path = os.path.join(PROJECT_ROOT, "weights", "best_medical_yolo.pt")
        self.weights_path = weights_path
        self._model = None

    @property
    def model(self):
        if self._model is None:
            self._model = _load_yolo(self.weights_path)
        return self._model

    @property
    def available(self) -> bool:
        # Try to load the model if not already loaded
        if self._model is None:
            self._model = _load_yolo(self.weights_path)
        return VISION_AVAILABLE and self._model is not None

    def analyze_scan(self, image_path: str) -> dict:
        """Runs bounding-box anomaly localization on X-Ray or MRI scans."""
        if not self.available:
            detail = LAST_ERROR or "Unknown error during model loading."
            return {
                "status": "MODEL_UNAVAILABLE",
                "message": detail,
                "detections_count": 0,
                "detections": [],
                "model_version": "YOLOv8-Medical-Triage-v1",
                "max_confidence": None,
            }

        try:
            results = self.model(image_path, conf=0.4)
            detections = []

            for result in results:
                for box in result.boxes:
                    coords = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    label = self.model.names[cls_id]

                    detections.append({
                        "label": label,
                        "confidence": round(conf * 100, 2),
                        "box": [round(c, 2) for c in coords],
                    })

            max_confidence = max((d["confidence"] for d in detections), default=None)

            return {
                "status": "SUCCESS",
                "detections_count": len(detections),
                "detections": detections,
                "model_version": "YOLOv8-Medical-Triage-v1",
                "max_confidence": max_confidence,
            }
        except Exception as e:
            return {
                "status": "ERROR",
                "message": str(e),
                "detections_count": 0,
                "detections": [],
                "model_version": "YOLOv8-Medical-Triage-v1",
                "max_confidence": None,
            }
