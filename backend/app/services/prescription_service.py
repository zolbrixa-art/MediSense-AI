"""
Prescription Generation Service - Creates prescription images with patient/doctor data
"""
import os
from datetime import datetime
from pathlib import Path
from typing import List, Tuple

from PIL import Image, ImageDraw, ImageFont


class PrescriptionService:
    """Generates prescription images by filling the MediSense Rx template"""

    # Field coordinates (x, y) for 1414x2000 template layout
    FIELDS = {
        "patient_name": (420, 105),     # Patient's Name field
        "date": (1020, 105),             # Date field
        "doctor_name": (420, 150),      # Doctor's Name field
        "age": (1020, 150),              # Age field
        "medications": (120, 300),      # Medications area start
    }

    # Text configuration for 1414x2000 image
    FONT_SIZE_NORMAL = 24
    FONT_SIZE_TITLE = 28
    TEXT_COLOR = (15, 23, 42)  # Dark slate/black
    LINE_HEIGHT = 40
    MAX_CHARS_PER_LINE = 70

    @classmethod
    def _get_template_path(cls) -> str:
        """Find MediSense Rx.png template across standard project locations"""
        candidates = [
            r"C:\Users\DELL\OneDrive\Desktop\MediSense AI\MediSense Rx.png",
            os.path.join(os.getcwd(), "MediSense Rx.png"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "MediSense Rx.png"),
            "MediSense Rx.png"
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return "MediSense Rx.png"

    @staticmethod
    def _get_font(size: int = FONT_SIZE_NORMAL) -> ImageFont.FreeTypeFont:
        """Get a font object, fallback to default if TTF not available"""
        font_names = ["arial.ttf", "calibri.ttf", "dejavusans.ttf", "FreeSans.ttf"]
        for font_name in font_names:
            try:
                return ImageFont.truetype(font_name, size)
            except (IOError, OSError):
                continue
        return ImageFont.load_default()

    @classmethod
    def generate_prescription(
        cls,
        patient_name: str,
        patient_age: int,
        doctor_name: str,
        medications: List[dict],
        output_path: str,
    ) -> bool:
        """
        Generate a prescription image and save it to output_path

        Args:
            patient_name: Patient full name
            patient_age: Patient age
            doctor_name: Doctor full name
            medications: List of dicts with keys: drug_name, dose, frequency, duration
            output_path: Full file path where to save the prescription

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            template_path = cls._get_template_path()

            if os.path.exists(template_path):
                img = Image.open(template_path).copy().convert("RGB")
                draw = ImageDraw.Draw(img)
                font = cls._get_font(cls.FONT_SIZE_NORMAL)
                title_font = cls._get_font(cls.FONT_SIZE_TITLE)
                label_font = cls._get_font(cls.FONT_SIZE_TITLE)

                # Keep the identity details together below the header line.
                right_edge = img.width - 70
                for y_position, label, value in (
                    (132, "Patient Name:", patient_name),
                    (174, "Doctor Name:", doctor_name),
                ):
                    label_width = draw.textbbox((0, 0), label, font=label_font)[2]
                    value_text = value[:45]
                    value_width = draw.textbbox((0, 0), value_text, font=font)[2]
                    line_start = right_edge - label_width - value_width - 8
                    draw.text((line_start, y_position), label, fill=cls.TEXT_COLOR, font=label_font)
                    draw.line(
                        [(line_start, y_position + cls.FONT_SIZE_TITLE + 3),
                         (line_start + label_width, y_position + cls.FONT_SIZE_TITLE + 3)],
                        fill=cls.TEXT_COLOR,
                        width=2,
                    )
                    draw.text((line_start + label_width + 8, y_position), value_text, fill=cls.TEXT_COLOR, font=font)

                med_text = cls._format_medications(medications)
                y_offset = cls.FIELDS["medications"][1]

                for line in med_text.split("\n"):
                    if y_offset > 1750:  # Stop if exceeding page bounds
                        break
                    draw.text((cls.FIELDS["medications"][0], y_offset), line[:cls.MAX_CHARS_PER_LINE], fill=cls.TEXT_COLOR, font=font)
                    y_offset += cls.LINE_HEIGHT
            else:
                # Dynamic fallback prescription card image if template missing
                img = Image.new("RGB", (1000, 1300), (255, 255, 255))
                draw = ImageDraw.Draw(img)
                header_font = cls._get_font(26)
                sub_font = cls._get_font(18)
                body_font = cls._get_font(20)

                # Header box
                draw.rectangle([(0, 0), (1000, 140)], fill=(15, 23, 42))
                draw.text((50, 35), "MEDISENSE AI — OFFICIAL E-PRESCRIPTION", fill=(255, 255, 255), font=header_font)
                draw.text((50, 85), "Clinical Decision Support System (CDSS)", fill=(45, 212, 191), font=sub_font)

                # Patient Info Box
                draw.rectangle([(50, 180), (950, 290)], outline=(203, 213, 225), fill=(248, 250, 252), width=2)
                draw.text((70, 200), f"Patient Name: {patient_name}", fill=(15, 23, 42), font=body_font)
                draw.text((650, 200), f"Age: {patient_age} yrs", fill=(15, 23, 42), font=body_font)
                draw.text((70, 245), f"Doctor: Dr. {doctor_name}", fill=(15, 23, 42), font=body_font)
                draw.text((650, 245), f"Date: {datetime.now().strftime('%d/%m/%Y')}", fill=(15, 23, 42), font=body_font)

                # Rx section
                draw.text((50, 330), "Rx / Prescribed Medications", fill=(15, 23, 42), font=header_font)
                draw.line([(50, 370), (950, 370)], fill=(203, 213, 225), width=2)

                med_text = cls._format_medications(medications)
                y_offset = 400
                for line in med_text.split("\n"):
                    if y_offset > 1150:
                        break
                    draw.text((70, y_offset), line, fill=(30, 41, 59), font=body_font)
                    y_offset += 40

                # Footer warning
                draw.line([(50, 1200), (950, 1200)], fill=(203, 213, 225), width=1)
                draw.text((50, 1220), "Clinical Decision Support System — E-Prescription issued by physician.", fill=(100, 116, 139), font=sub_font)

            # Ensure output directory exists
            output_dir = os.path.dirname(output_path)
            if output_dir:
                Path(output_dir).mkdir(parents=True, exist_ok=True)

            # Save prescription
            img.save(output_path, "PNG")
            return True

        except Exception as e:
            print(f"ERROR generating prescription: {str(e)}")
            return False

    @staticmethod
    def _format_medications(medications: List[dict]) -> str:
        """Format medications list into readable text"""
        lines = []
        for i, med in enumerate(medications, 1):
            drug = med.get("drug_name", "").strip()
            dose = med.get("dose", "").strip()
            freq = med.get("frequency", "").strip()
            duration = med.get("duration", "").strip()

            if drug:
                line = f"{i}. {drug}"
                if dose:
                    line += f"  ·  {dose}"
                if freq:
                    line += f"  ·  {freq}"
                if duration:
                    line += f"  ·  {duration}"
                lines.append(line)

        return "\n".join(lines) if lines else "No medications prescribed"

    @staticmethod
    def get_prescription_filename(patient_id: int, encounter_id: int) -> str:
        """Generate unique prescription filename"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"prescription_{encounter_id}_{timestamp}.png"

    @staticmethod
    def get_patient_prescriptions_folder(patient_id: int) -> str:
        """Get patient prescriptions folder path"""
        return os.path.join("uploads", f"patient_{patient_id}", "prescriptions")

