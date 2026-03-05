"""
Input parsing and normalisation helpers for lottery ticket data.

Public functions are called by route handlers in routers/tickets.py.
Private helpers (_prefix) may also be imported by utils/ocr_parsers.py.
"""

import json
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from models import FourDBetType, GameType, TotoSystemType
from utils.errors import bad_request


# ── Game type ─────────────────────────────────────────────────────────────────

def parse_game_type(value: str) -> GameType:
    token = value.strip().upper()
    if token == "4D":
        return GameType.FOUR_D
    if token == "TOTO":
        return GameType.TOTO
    bad_request("game_type must be '4D' or 'TOTO'")


# ── Draw dates ────────────────────────────────────────────────────────────────

def _parse_draw_date(value: str) -> date:
    token = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(token, fmt).date()
        except ValueError:
            continue
    bad_request("draw_date must be DD/MM/YYYY")


def parse_draw_dates(draw_dates_json: str | None, draw_date: str | None) -> list[date]:
    tokens: list[str] = []
    if draw_dates_json:
        try:
            parsed = json.loads(draw_dates_json)
        except json.JSONDecodeError:
            bad_request("draw_dates_json must be valid JSON")
        if isinstance(parsed, list):
            tokens.extend(str(v).strip() for v in parsed if str(v).strip())
        elif isinstance(parsed, str) and parsed.strip():
            tokens.append(parsed.strip())
        else:
            bad_request("draw_dates_json must be an array of dates")

    if draw_date and draw_date.strip():
        tokens.append(draw_date.strip())

    if not tokens:
        bad_request("At least one draw date is required")

    out: list[date] = []
    for token in tokens:
        parsed = _parse_draw_date(token)
        if parsed not in out:
            out.append(parsed)
    return out


# ── Draw numbers ──────────────────────────────────────────────────────────────

def _normalize_draw_number_token(raw: Any) -> str | None:
    if raw is None:
        return None
    token = str(raw).strip()
    if not token:
        return None
    match = re.search(r"(\d{3,6})(?:/\d{2,4})?", token)
    if not match:
        return None
    return match.group(1)


def parse_draw_numbers(
    draw_numbers_json: str | None,
    draw_number: str | None,
    draw_dates: list[date],
) -> list[str | None]:
    if draw_numbers_json:
        try:
            parsed = json.loads(draw_numbers_json)
        except json.JSONDecodeError:
            bad_request("draw_numbers_json must be valid JSON")

        if isinstance(parsed, list):
            if len(parsed) > len(draw_dates):
                bad_request("draw numbers cannot exceed draw dates count")

            aligned: list[str | None] = []
            for item in parsed:
                aligned.append(_normalize_draw_number_token(item))

            if len(aligned) < len(draw_dates):
                aligned.extend([None] * (len(draw_dates) - len(aligned)))

            if any(v is not None for v in aligned):
                return aligned
        elif isinstance(parsed, str) and parsed.strip():
            # Backward-compat: single draw number string payload.
            token = _normalize_draw_number_token(parsed.strip())
            if token:
                if len(draw_dates) > 1:
                    return [token] * len(draw_dates)
                return [token]
            return [None] * len(draw_dates)
        else:
            bad_request("draw_numbers_json must be an array of draw numbers")

    tokens: list[str] = []
    if draw_numbers_json:
        try:
            parsed = json.loads(draw_numbers_json)
        except json.JSONDecodeError:
            bad_request("draw_numbers_json must be valid JSON")
        if isinstance(parsed, list):
            tokens.extend(str(v).strip() for v in parsed if str(v).strip())

    if draw_number and draw_number.strip():
        tokens.append(draw_number.strip())

    normalized: list[str] = []
    for token in tokens:
        normalized_token = _normalize_draw_number_token(token)
        if normalized_token:
            normalized.append(normalized_token)

    if not normalized:
        return [None] * len(draw_dates)

    if len(normalized) > len(draw_dates):
        bad_request("draw numbers cannot exceed draw dates count")

    if len(normalized) == 1 and len(draw_dates) > 1:
        return [normalized[0]] * len(draw_dates)

    if len(normalized) < len(draw_dates):
        return normalized + [None] * (len(draw_dates) - len(normalized))

    return normalized


# ── Number sets ───────────────────────────────────────────────────────────────

def normalize_numbers(raw_numbers: Any) -> list[list[str]]:
    normalized: list[list[str]] = []
    if not isinstance(raw_numbers, list):
        return normalized
    for row in raw_numbers:
        if not isinstance(row, list):
            continue
        clean_row = [str(v).strip() for v in row if str(v).strip()]
        if clean_row:
            normalized.append(clean_row)
    return normalized


def extract_4d_numbers(numbers: list[list[str]]) -> list[str]:
    tokens: list[str] = []
    for row in numbers:
        for raw in row:
            token = raw.strip()
            if token.isdigit() and len(token) == 4:
                if token not in tokens:
                    tokens.append(token)
    if not tokens:
        bad_request("At least one valid 4-digit number is required")
    return tokens


def extract_toto_sets(numbers: list[list[str]]) -> list[list[int]]:
    if not numbers:
        bad_request("TOTO requires at least one number set")

    sets: list[list[int]] = []
    for idx, row in enumerate(numbers, start=1):
        selected: list[int] = []
        for raw in row:
            token = raw.strip()
            if not token.isdigit():
                continue
            value = int(token)
            if 1 <= value <= 49:
                selected.append(value)

        dedup_sorted = sorted(set(selected))
        if len(dedup_sorted) < 6:
            bad_request(f"TOTO row {idx} must include at least 6 unique numbers (1-49)")
        if len(dedup_sorted) > 12:
            bad_request(f"TOTO row {idx} supports at most 12 unique numbers")
        sets.append(dedup_sorted)

    if not sets:
        bad_request("No valid TOTO number set found")
    return sets


# ── Bet types ─────────────────────────────────────────────────────────────────

def parse_4d_bet_type(raw: str | None) -> FourDBetType:
    token = (raw or "").strip().upper().replace("-", "")
    if token == "IBET":
        return FourDBetType.IBET
    return FourDBetType.ORDINARY


def _parse_system_type(raw: str | None) -> TotoSystemType | None:
    if not raw:
        return None
    token = raw.strip().upper().replace(" ", "").replace("-", "_")
    token = token.replace("SYSTEM", "SYSTEM_")
    token = re.sub(r"_+", "_", token)
    if token.endswith("_"):
        token = token[:-1]
    for value in TotoSystemType:
        if token == value.value:
            return value
    return None


def _system_enum_from_n(n: int) -> TotoSystemType | None:
    mapping = {
        7: TotoSystemType.SYSTEM_7,
        8: TotoSystemType.SYSTEM_8,
        9: TotoSystemType.SYSTEM_9,
        10: TotoSystemType.SYSTEM_10,
        11: TotoSystemType.SYSTEM_11,
        12: TotoSystemType.SYSTEM_12,
    }
    return mapping.get(n)


def _normalize_toto_bet_type(raw: str | None, *, strict: bool) -> str:
    token = (raw or "").strip().upper().replace(" ", "").replace("-", "_")
    token = token.replace("SYSTEM", "SYSTEM_")
    token = re.sub(r"_+", "_", token)
    token = token.strip("_")

    if token in ("", "STANDARD", "ORDINARY"):
        return "ORDINARY"

    system_type = _parse_system_type(token)
    if system_type is not None:
        return system_type.value

    if strict:
        bad_request("TOTO bet_type must be ORDINARY or SYSTEM_7 to SYSTEM_12")
    return "ORDINARY"


def parse_toto_mode(
    selected_numbers: list[int],
    raw_bet_type: str | None,
) -> tuple[bool, TotoSystemType | None]:
    token = (raw_bet_type or "").strip()
    if not token:
        if len(selected_numbers) == 6:
            return False, None
        inferred = _system_enum_from_n(len(selected_numbers))
        if not inferred:
            bad_request("System bet must have 7 to 12 unique numbers")
        return True, inferred

    normalized = _normalize_toto_bet_type(token, strict=True)
    if normalized == "ORDINARY":
        if len(selected_numbers) != 6:
            bad_request("ORDINARY requires exactly 6 unique numbers")
        return False, None

    explicit_system = _parse_system_type(normalized)
    if explicit_system is None:
        bad_request("TOTO bet_type must be ORDINARY or SYSTEM_7 to SYSTEM_12")

    system_n = len(selected_numbers)
    explicit_n = int(explicit_system.value.split("_")[1])
    if explicit_n != system_n:
        bad_request(f"system_type {explicit_system.value} requires exactly {explicit_n} numbers")
    return True, explicit_system


# ── Decimal / money ───────────────────────────────────────────────────────────

def parse_decimal(raw: str | None, default: Decimal) -> Decimal:
    token = (raw or "").strip()
    if not token:
        return default
    try:
        value = Decimal(token)
    except InvalidOperation:
        bad_request(f"Invalid decimal value: {raw}")
    if value < 0:
        bad_request(f"Decimal value cannot be negative: {raw}")
    return value.quantize(Decimal("0.01"))


# ── Datetime ──────────────────────────────────────────────────────────────────

def parse_purchase_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    token = value.strip()
    if not token:
        return None

    formats = (
        "%d/%m/%Y %I:%M %p",
        "%d/%m/%Y %H:%M",
        "%d/%m/%y %I:%M %p",
        "%d/%m/%y %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
    )
    for fmt in formats:
        try:
            return datetime.strptime(token, fmt)
        except ValueError:
            continue
    bad_request("purchase_datetime must be DD/MM/YYYY HH:MM AM/PM")


# ── Formatting ────────────────────────────────────────────────────────────────

def format_date_ddmmyyyy(value: date) -> str:
    return value.strftime("%d/%m/%Y")


def format_purchase_datetime_for_preview(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%d/%m/%Y %I:%M %p")
