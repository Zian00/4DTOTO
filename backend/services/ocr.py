"""
Gemini OCR integration.

Sends ticket images to Gemini 2.5 Flash and returns structured data.
Sanitisation and enrichment of the raw payload is handled by services/ocr_parser.py.
"""

import base64
import json
import re
from typing import Any

import httpx

from config import settings
from services.ocr_parser import sanitize_ocr_output


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
_GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent"
)


async def extract_ticket(image_bytes: bytes, mime_type: str | None = None) -> dict[str, Any]:
    """
    Send ticket image to Gemini 2.5 Flash and return structured OCR data.
    Raises ValueError if the response cannot be parsed as valid JSON.
    """
    image_mime = mime_type or "image/jpeg"
    if not settings.gemini_api_key:
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
        resp = await client.post(_GEMINI_URL, params={"key": settings.gemini_api_key}, json=body)
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

    return sanitize_ocr_output(payload)


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
