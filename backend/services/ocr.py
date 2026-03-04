import base64
import json
import os
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from dotenv import load_dotenv
import httpx
from pydantic import BaseModel

load_dotenv()


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

PROMPT = """
Analyze this Singapore lottery ticket image and return ONLY a JSON object with no markdown:
{
  "game_type": "4D" or "TOTO",
  "draw_date": "YYYY-MM-DD",
  "draw_dates": ["YYYY-MM-DD", "YYYY-MM-DD"],
  "draw_number": "5447",
  "draw_numbers": ["5447", "5448"],
  "purchase_datetime": "YYYY-MM-DD HH:MM:SS",
  "bet_type": "ORDINARY" or "IBET" or "SYSTEM_7" to "SYSTEM_12",
  "numbers": [["1234"], ["5678"]],
  "big_amount": "2.00",
  "small_amount": "0.00",
  "total_price": "4.00",
  "raw_text": "<all visible text on ticket>"
}

Rules:
- For 4D: numbers is an array of 4-digit string arrays e.g. [["1234"], ["5678"]]
- For TOTO Ordinary: numbers is one array of 6 number strings e.g. [["01","07","12","23","34","45"]]
- For TOTO System bets: numbers is one array with N number strings e.g. [["01","07","12","23","34","45","49"]]
- draw_dates can include multiple candidate draw dates if the ticket shows more than one
- draw_numbers can include multiple candidate draw numbers if the ticket shows more than one (front numeric part only)
- purchase_datetime MUST be the printed purchase timestamp (transaction time), not draw date/time
- For 4D amounts, fill big_amount/small_amount/total_price if visible
- draw_date must be in YYYY-MM-DD format
- If any field cannot be determined, use null
- Return ONLY valid JSON, no markdown, no explanation

TOTO date and draw-number disambiguation (important):
- Text after "DRAW:" with weekday + date is draw schedule info, not purchase time.
- A token like "3014/15", "0049/14", "0051/14" is a draw-number/year token.
- For output, use ONLY the front draw number part:
  - "3014/15" -> "3014"
  - "0049/14" -> "0049"
  - "0051/14" -> "0051"
- Convert draw dates from DD/MM/YY or DD/MM/YYYY to YYYY-MM-DD.
- purchase_datetime usually appears as a standalone date + time like "16/02/15 08:40am" or "06/10/14 11:37am".

Examples:
- "DRAW: FRI 27/02/15 ... 3014/15 ... 16/02/15 08:40am"
  -> draw_date: "2015-02-27", draw_number: "3014", purchase_datetime: "2015-02-16 08:40:00"
- "DRAW: MON 06/10/14 0049/14 ... 13/10/14 0051/14 ... 06/10/14 11:37am"
  -> draw_dates includes "2014-10-06" and "2014-10-13"
  -> draw_numbers includes "0049" and "0051"
  -> purchase_datetime: "2014-10-06 11:37:00"
"""


MODEL_NAME = "gemini-2.5-flash"
_API_KEY = os.getenv("GEMINI_API_KEY")
_GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent"


def _sanitize_output(payload: dict[str, Any]) -> dict[str, Any]:
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
    raw_text = (
        str(raw_text_raw)
        if isinstance(raw_text_raw, str)
        else ""
    )

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

    result = {
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


async def extract_ticket(image_bytes: bytes, mime_type: str | None = None) -> dict:
    """
    Send ticket image to Gemini 2.5 Flash and return structured OCR data.
    Raises ValueError if the response cannot be parsed as valid JSON.
    """
    image_mime = mime_type or "image/jpeg"
    if not _API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    body = {
        "contents": [
            {
                "parts": [
                    {"text": PROMPT},
                    {
                        "inlineData": {
                            "mimeType": image_mime,
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
        },
    }

    # Ignore broken proxy/SSL env vars (e.g. invalid SSL_CERT_FILE) from host env.
    async with httpx.AsyncClient(timeout=45, trust_env=False) as client:
        resp = await client.post(_GEMINI_URL, params={"key": _API_KEY}, json=body)
        resp.raise_for_status()
        data = resp.json()

    text = _extract_response_text(data)
    if not text:
        raise ValueError("Gemini OCR response was empty")

    cleaned = _clean_json_response(text)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Gemini OCR returned non-JSON response: {cleaned[:300]}") from exc

    if not isinstance(payload, dict):
        raise ValueError("Gemini OCR JSON payload is not an object")

    return _sanitize_output(payload)


def _extract_response_text(response_json: dict[str, Any]) -> str:
    candidates = response_json.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return ""
    first = candidates[0] if isinstance(candidates[0], dict) else {}
    content = first.get("content") if isinstance(first, dict) else {}
    parts = content.get("parts") if isinstance(content, dict) else []
    if not isinstance(parts, list):
        return ""
    chunks: list[str] = []
    for part in parts:
        if isinstance(part, dict) and isinstance(part.get("text"), str):
            chunks.append(part["text"])
    return "\n".join(chunks).strip()


def _clean_json_response(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()
