import base64
import json
import os
import re

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

PROMPT = """
Analyze this Singapore lottery ticket image and return ONLY a JSON object with no markdown:
{
  "game_type": "4D" or "TOTO",
  "draw_date": "YYYY-MM-DD",
  "bet_type": "Standard" or "System7" or "System8" or "System9" or "System10" or "System11" or "System12",
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


def _clean_json_response(text: str) -> str:
    """Strip markdown code fences if Gemini wraps the response."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


async def extract_ticket(image_bytes: bytes) -> dict:
    """
    Send ticket image to Gemini Flash and return structured OCR data.
    Raises ValueError if the response cannot be parsed as valid JSON.
    """
    model = genai.GenerativeModel("gemini-2.0-flash")
    img_part = {
        "mime_type": "image/jpeg",
        "data": base64.b64encode(image_bytes).decode(),
    }
    response = model.generate_content([PROMPT, img_part])
    cleaned = _clean_json_response(response.text)
    return json.loads(cleaned)
