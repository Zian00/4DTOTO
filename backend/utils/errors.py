"""Centralised HTTP exception helpers for consistent error responses."""

from typing import NoReturn

from fastapi import HTTPException


def bad_request(detail: str) -> NoReturn:
    """Raise HTTP 400 Bad Request."""
    raise HTTPException(status_code=400, detail=detail)


def not_found(detail: str) -> NoReturn:
    """Raise HTTP 404 Not Found."""
    raise HTTPException(status_code=404, detail=detail)


def payload_too_large(detail: str) -> NoReturn:
    """Raise HTTP 413 Payload Too Large."""
    raise HTTPException(status_code=413, detail=detail)
