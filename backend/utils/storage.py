"""
Ticket image file I/O helpers.
"""

import os
from pathlib import Path

from config import settings

_MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}


def save_image(image_bytes: bytes, detected_mime: str, filename_stem: str) -> str:
    """Persist image bytes to the uploads directory. Returns the filename (not full path)."""
    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = _MIME_TO_EXT.get(detected_mime, "jpg")
    filename = f"{filename_stem}.{ext}"
    with open(os.path.join(settings.upload_dir, filename), "wb") as f:
        f.write(image_bytes)
    return filename


def build_image_url(image_path: str | None) -> str | None:
    """Convert a stored filename to a public URL path."""
    if not image_path:
        return None
    return f"/uploads/{image_path}"


def delete_image(image_path: str | None) -> None:
    """Delete a stored image file if it exists inside the uploads directory."""
    if not image_path:
        return

    uploads_dir = Path(settings.upload_dir).resolve()
    target = (uploads_dir / image_path).resolve()
    # Ensure we never delete outside the configured uploads folder.
    if uploads_dir not in target.parents and target != uploads_dir:
        return
    if target.is_file():
        target.unlink(missing_ok=True)
