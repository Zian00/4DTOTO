"""
Lenient OCR output parsing helpers.

These functions normalise raw OCR data for the review draft — errors are
swallowed and replaced with safe defaults rather than raising HTTP exceptions.
"""

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import HTTPException

from utils.parsers import (
    _normalize_draw_number_token,
    _normalize_toto_bet_type,
    _parse_draw_date,
    normalize_numbers,
    parse_purchase_datetime,
)


def _parse_draw_date_options(raw: Any) -> list[date]:
    if not isinstance(raw, list):
        return []
    out: list[date] = []
    for item in raw:
        token = str(item).strip()
        if not token:
            continue
        try:
            parsed = _parse_draw_date(token)
        except (HTTPException, ValueError):
            continue
        if parsed not in out:
            out.append(parsed)
    return out


def _parse_draw_number_options(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        normalized = _normalize_draw_number_token(item)
        if normalized and normalized not in out:
            out.append(normalized)
    return out


def _normalize_amount_for_preview(raw: Any) -> str | None:
    if raw is None:
        return None
    token = str(raw).strip()
    if not token:
        return None
    try:
        return f"{Decimal(token).quantize(Decimal('0.01'))}"
    except (InvalidOperation, ValueError):
        return None


def parse_ocr_data(
    ocr_data: dict[str, Any],
) -> tuple[
    str,
    date,
    list[date],
    str | None,
    list[str],
    Any,  # datetime | None
    str,
    list[list[str]],
    str,
    str | None,
    str | None,
    str | None,
]:
    raw_game_type = str(ocr_data.get("game_type") or "4D").upper()
    game_type = "TOTO" if raw_game_type == "TOTO" else "4D"

    draw_date_token = str(ocr_data.get("draw_date") or date.today().isoformat())
    try:
        draw_date = _parse_draw_date(draw_date_token)
    except (HTTPException, ValueError):
        draw_date = date.today()

    draw_date_options = _parse_draw_date_options(ocr_data.get("draw_dates"))
    if draw_date not in draw_date_options:
        draw_date_options.insert(0, draw_date)

    draw_number = _normalize_draw_number_token(ocr_data.get("draw_number"))
    draw_number_options = _parse_draw_number_options(ocr_data.get("draw_numbers"))
    if draw_number and draw_number not in draw_number_options:
        draw_number_options.insert(0, draw_number)
    if not draw_number and draw_number_options:
        draw_number = draw_number_options[0]

    try:
        purchase_datetime = parse_purchase_datetime(
            str(ocr_data.get("purchase_datetime") or "").strip() or None
        )
    except (HTTPException, ValueError):
        purchase_datetime = None

    bet_type_raw = str(ocr_data.get("bet_type") or "").strip()
    if game_type == "TOTO":
        bet_type = _normalize_toto_bet_type(bet_type_raw, strict=False)
    elif bet_type_raw:
        bet_type = bet_type_raw
    else:
        bet_type = "ORDINARY"

    numbers = normalize_numbers(ocr_data.get("numbers"))
    raw_text = str(ocr_data.get("raw_text") or "")
    big_amount = _normalize_amount_for_preview(ocr_data.get("big_amount"))
    small_amount = _normalize_amount_for_preview(ocr_data.get("small_amount"))
    total_price = _normalize_amount_for_preview(ocr_data.get("total_price"))

    return (
        game_type,
        draw_date,
        draw_date_options,
        draw_number,
        draw_number_options,
        purchase_datetime,
        bet_type,
        numbers,
        raw_text,
        big_amount,
        small_amount,
        total_price,
    )
