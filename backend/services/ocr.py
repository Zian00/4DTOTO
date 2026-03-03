import base64
import json
import os
import re
from typing import Any

from dotenv import load_dotenv
import httpx
from pydantic import BaseModel

load_dotenv()


class TicketOcrResponse(BaseModel):
    game_type: str | None = None
    draw_date: str | None = None
    bet_type: str | None = None
    numbers: list[list[str]] | None = None
    raw_text: str | None = None

PROMPT = """
Analyze this Singapore lottery ticket image and return ONLY a JSON object with no markdown:
{
  "game_type": "4D" or "TOTO",
  "draw_date": "YYYY-MM-DD",
  "bet_type": "ORDINARY" or "IBET" or "STANDARD" or "SYSTEM_7" to "SYSTEM_12",
  "numbers": [["1234"], ["5678"]],
  "raw_text": "<all visible text on ticket>"
}

Rules:
- For 4D: numbers is an array of 4-digit string arrays e.g. [["1234"], ["5678"]]
- For TOTO Standard: numbers is one array of 6 number strings e.g. [["01","07","12","23","34","45"]]
- For TOTO System bets: numbers is one array with N number strings e.g. [["01","07","12","23","34","45","49"]]
- draw_date must be in YYYY-MM-DD format
- If any field cannot be determined, use null
- Return ONLY valid JSON, no markdown, no explanation
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

    draw_date_raw = payload.get("draw_date")
    draw_date = (
        str(draw_date_raw).strip()
        if isinstance(draw_date_raw, str) and draw_date_raw.strip()
        else None
    )

    bet_type_raw = payload.get("bet_type")
    bet_type = None
    if isinstance(bet_type_raw, str) and bet_type_raw.strip():
        bet_type = str(bet_type_raw).strip().upper().replace("-", "_").replace(" ", "")

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

    return {
        "game_type": game_type,
        "draw_date": draw_date,
        "bet_type": bet_type,
        "numbers": normalized_numbers,
        "raw_text": raw_text,
    }


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
