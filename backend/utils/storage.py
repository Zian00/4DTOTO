"""
Ticket image file I/O helpers.
"""

import os

from config import settings


def save_image(image_bytes: bytes, content_type: str | None, filename_stem: str) -> str:
    """Persist image bytes to the uploads directory. Returns the filename (not full path)."""
    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = (content_type or "image/jpeg").split("/")[-1].split(";")[0].strip() or "jpg"
    filename = f"{filename_stem}.{ext}"
    with open(os.path.join(settings.upload_dir, filename), "wb") as f:
        f.write(image_bytes)
    return filename


def build_image_url(image_path: str | None) -> str | None:
    """Convert a stored filename to a public URL path."""
    if not image_path:
        return None
    return f"/uploads/{image_path}"
