"""Image upload validation helpers."""

from __future__ import annotations

from config import settings
from utils.errors import bad_request


_MAGIC_TO_MIME: tuple[tuple[bytes, str], ...] = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"RIFF", "image/webp"),  # requires WEBP marker check below
)


def _detect_mime_from_magic(image_bytes: bytes) -> str | None:
    if len(image_bytes) < 12:
        return None

    if image_bytes.startswith(_MAGIC_TO_MIME[0][0]):
        return "image/jpeg"
    if image_bytes.startswith(_MAGIC_TO_MIME[1][0]):
        return "image/png"
    if image_bytes.startswith(_MAGIC_TO_MIME[2][0]) and image_bytes[8:12] == b"WEBP":
        return "image/webp"

    # HEIC/HEIF signatures (ISO BMFF brands near bytes 8..12)
    if image_bytes[4:8] == b"ftyp":
        brand = image_bytes[8:12]
        if brand in {b"heic", b"heix"}:
            return "image/heic"
        if brand in {b"heif", b"heim", b"mif1", b"msf1"}:
            return "image/heif"

    return None


def validate_ticket_image(image_bytes: bytes, content_type: str | None) -> str:
    """
    Validate uploaded file is an allowed image type.
    Returns detected MIME type from file bytes (authoritative).
    """
    detected_mime = _detect_mime_from_magic(image_bytes)
    if not detected_mime:
        bad_request("Unsupported image format. Use JPEG, PNG, WEBP, or HEIC/HEIF.")

    allowed = settings.allowed_image_mime_types_set
    if allowed and detected_mime not in allowed:
        bad_request("This image type is not allowed by server configuration.")

    if content_type:
        declared = content_type.split(";")[0].strip().lower()
        if declared.startswith("image/") and declared != detected_mime:
            # Content-type mismatch can indicate spoofed uploads.
            bad_request("Uploaded file type does not match file content.")

    return detected_mime
