"""
OCR output sanitisation and enrichment.

Takes raw Gemini JSON payloads and normalises them into a clean,
schema-conformant dict before further processing.
"""

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import BaseModel


class TicketOcrResponse(BaseModel):
    game_type: str | None = None
    draw_date: str | None = None
    draw_dates: list[str] | None = None
    draw_number: str | None = None
    draw_numbers: list[str] | None = None
    purchase_datetime: str | None = None
    bet_type: str | None = None
    numbers: list[list[str]] | None = None
    big_amount: str | None = None
    small_amount: str | None = None
    total_price: str | None = None
    raw_text: str | None = None


def sanitize_ocr_output(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalise a raw Gemini JSON payload into a clean OCR data dict."""
    game_type_raw = payload.get("game_type")
    game_type = (
        str(game_type_raw).upper()
        if isinstance(game_type_raw, str) and game_type_raw.strip()
        else None
    )
    if game_type not in ("4D", "TOTO"):
        game_type = None

    draw_date = _normalize_date(payload.get("draw_date"))
    draw_number = _normalize_draw_number(payload.get("draw_number"))
    draw_numbers = _normalize_draw_number_list(payload.get("draw_numbers"))
    if draw_number and draw_number not in draw_numbers:
        draw_numbers.insert(0, draw_number)
    if not draw_number and draw_numbers:
        draw_number = draw_numbers[0]

    bet_type_raw = payload.get("bet_type")
    bet_type = None
    if isinstance(bet_type_raw, str) and bet_type_raw.strip():
        bet_type = str(bet_type_raw).strip().upper().replace("-", "_").replace(" ", "")
        if bet_type == "STANDARD":
            bet_type = "ORDINARY"

    raw_text_raw = payload.get("raw_text")
    raw_text = str(raw_text_raw) if isinstance(raw_text_raw, str) else ""

    normalized_numbers: list[list[str]] = []
    numbers_raw = payload.get("numbers")
    if isinstance(numbers_raw, list):
        for row in numbers_raw:
            if isinstance(row, list):
                normalized_row = [str(v).strip() for v in row if str(v).strip()]
                if normalized_row:
                    normalized_numbers.append(normalized_row)

    draw_dates = _normalize_date_list(payload.get("draw_dates"))
    if draw_date and draw_date not in draw_dates:
        draw_dates.insert(0, draw_date)
    if not draw_date and draw_dates:
        draw_date = draw_dates[0]

    result: dict[str, Any] = {
        "game_type": game_type,
        "draw_date": draw_date,
        "draw_dates": draw_dates,
        "draw_number": draw_number,
        "draw_numbers": draw_numbers,
        "purchase_datetime": _normalize_purchase_datetime(payload.get("purchase_datetime")),
        "bet_type": bet_type,
        "numbers": normalized_numbers,
        "big_amount": _normalize_money(payload.get("big_amount")),
        "small_amount": _normalize_money(payload.get("small_amount")),
        "total_price": _normalize_money(payload.get("total_price")),
        "raw_text": raw_text,
    }
    return _enrich_from_raw_text(result)


def _enrich_from_raw_text(data: dict[str, Any]) -> dict[str, Any]:
    raw_text = str(data.get("raw_text") or "")
    upper = raw_text.upper()

    if not data.get("game_type"):
        if "TOTO" in upper:
            data["game_type"] = "TOTO"
        elif re.search(r"\b4D\b", upper):
            data["game_type"] = "4D"

    if not data.get("bet_type"):
        if "IBET" in upper or "I-BET" in upper:
            data["bet_type"] = "IBET"
        elif "ORDINARY" in upper:
            data["bet_type"] = "ORDINARY"
        else:
            system_match = re.search(r"SYSTEM[\s_-]?([7-9]|1[0-2])", upper)
            if system_match:
                data["bet_type"] = f"SYSTEM_{system_match.group(1)}"
            elif "STANDARD" in upper:
                data["bet_type"] = "ORDINARY"

    if not data.get("draw_date"):
        draw_match = re.search(r"DRAW[^0-9]*(\d{2}/\d{2}/\d{2,4})", raw_text, re.IGNORECASE)
        token = draw_match.group(1) if draw_match else None
        if token is None:
            any_match = re.search(r"(?<!\d)(\d{2}/\d{2}/\d{2,4})(?!\d)", raw_text)
            token = any_match.group(1) if any_match else None
        data["draw_date"] = _normalize_date(token)

    raw_date_tokens = _extract_date_tokens(raw_text)
    existing_dates = _normalize_date_list(data.get("draw_dates"))
    for token in raw_date_tokens:
        if token not in existing_dates:
            existing_dates.append(token)
    if data.get("draw_date") and data["draw_date"] not in existing_dates:
        existing_dates.insert(0, data["draw_date"])
    data["draw_dates"] = existing_dates
    if not data.get("draw_date") and existing_dates:
        data["draw_date"] = existing_dates[0]

    existing_draw_numbers = _normalize_draw_number_list(data.get("draw_numbers"))
    pair_tokens = _extract_draw_date_number_pairs(raw_text)
    date_to_draw_number: dict[str, str] = {}
    for draw_date_token, draw_number_token in pair_tokens:
        normalized_date = _normalize_date(draw_date_token)
        normalized_draw_number = _normalize_draw_number(draw_number_token)
        if not normalized_date or not normalized_draw_number:
            continue
        date_to_draw_number[normalized_date] = normalized_draw_number

    aligned_draw_numbers: list[str] = []
    for d in existing_dates:
        mapped = date_to_draw_number.get(d)
        if mapped:
            aligned_draw_numbers.append(mapped)

    if aligned_draw_numbers:
        data["draw_numbers"] = aligned_draw_numbers
    else:
        data["draw_numbers"] = existing_draw_numbers

    if not data.get("draw_number"):
        draw_no_match = re.search(
            r"DRAW[^0-9]*(?:[A-Z]{3}\s+)?(?:\d{2}/\d{2}/\d{2,4}\s+)?(\d{3,6}(?:/\d{2,4})?)",
            raw_text,
            re.IGNORECASE,
        )
        if draw_no_match:
            data["draw_number"] = _normalize_draw_number(draw_no_match.group(1))

    if data.get("draw_number"):
        normalized_draw_number = _normalize_draw_number(data["draw_number"])
        data["draw_number"] = normalized_draw_number
        if normalized_draw_number and normalized_draw_number not in data["draw_numbers"]:
            data["draw_numbers"].insert(0, normalized_draw_number)
    elif data["draw_numbers"]:
        data["draw_number"] = data["draw_numbers"][0]

    if data.get("purchase_datetime") is None:
        purchase_match = re.search(
            r"(?<!\d)(\d{2}/\d{2}/\d{2,4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))(?!\d)",
            raw_text,
            re.IGNORECASE,
        )
        if purchase_match:
            data["purchase_datetime"] = _normalize_purchase_datetime(
                f"{purchase_match.group(1)} {purchase_match.group(2).upper()}"
            )

    if data.get("game_type") == "4D" and not data.get("numbers"):
        number_match = re.search(r"(?<![\d/])(\d{4})(?![\d/])", raw_text)
        if number_match:
            data["numbers"] = [[number_match.group(1)]]

    if data.get("big_amount") is None:
        data["big_amount"] = _extract_money(raw_text, r"\bBIG\b")
    if data.get("small_amount") is None:
        data["small_amount"] = _extract_money(raw_text, r"\b(?:SML|SMALL)\b")
    if data.get("total_price") is None:
        data["total_price"] = _extract_money(raw_text, r"\bPRICE\b")

    if data.get("total_price") is None:
        big = _to_decimal(data.get("big_amount"))
        small = _to_decimal(data.get("small_amount"))
        if big is not None or small is not None:
            total = (big or Decimal("0")) + (small or Decimal("0"))
            data["total_price"] = f"{total.quantize(Decimal('0.01'))}"

    return data


def _normalize_date(value: Any) -> str | None:
    if value is None:
        return None
    token = str(value).strip()
    if not token:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y"):
        try:
            parsed = datetime.strptime(token, fmt).date()
            return parsed.isoformat()
        except ValueError:
            continue
    return None


def _normalize_date_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        normalized = _normalize_date(item)
        if normalized and normalized not in out:
            out.append(normalized)
    return out


def _extract_date_tokens(raw_text: str) -> list[str]:
    matches = re.findall(r"(?<!\d)(\d{2}/\d{2}/\d{2,4})(?!\d)", raw_text)
    out: list[str] = []
    for token in matches:
        normalized = _normalize_date(token)
        if normalized and normalized not in out:
            out.append(normalized)
    return out


def _normalize_draw_number(value: Any) -> str | None:
    if value is None:
        return None
    token = str(value).strip()
    if not token:
        return None
    match = re.search(r"(\d{3,6})(?:/\d{2,4})?", token)
    if not match:
        return None
    return match.group(1)


def _normalize_draw_number_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        normalized = _normalize_draw_number(item)
        if normalized:
            out.append(normalized)
    return out


def _extract_draw_date_number_pairs(raw_text: str) -> list[tuple[str, str]]:
    # Captures sequences like "21/02/26 5447/26" so draw numbers can align with draw dates.
    pattern = r"(\d{2}/\d{2}/\d{2,4})\s+(\d{3,6}(?:/\d{2,4})?)"
    return re.findall(pattern, raw_text)


def _normalize_purchase_datetime(value: Any) -> str | None:
    if value is None:
        return None
    token = str(value).strip()
    if not token:
        return None
    formats = (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y %I:%M %p",
        "%d/%m/%y %I:%M %p",
        "%d/%m/%Y %H:%M",
        "%d/%m/%y %H:%M",
    )
    for fmt in formats:
        try:
            parsed = datetime.strptime(token, fmt)
            return parsed.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return None


def _extract_money(raw_text: str, label_pattern: str) -> str | None:
    match = re.search(
        rf"{label_pattern}\s*[:=]?\s*\$?\s*([0-9]+(?:\.[0-9]{{1,2}})?)",
        raw_text,
        re.IGNORECASE,
    )
    if not match:
        return None
    return _normalize_money(match.group(1))


def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _normalize_money(value: Any) -> str | None:
    if value is None:
        return None
    decimal_value = _to_decimal(value)
    if decimal_value is None:
        return None
    if decimal_value < 0:
        return None
    return f"{decimal_value.quantize(Decimal('0.01'))}"
