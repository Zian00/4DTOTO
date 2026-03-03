"""
Singapore Pools results scraper.

Strategy (confirmed via Chrome DevTools network inspection, 2026-03-03):
  No JSON API exists. Singapore Pools serves pre-rendered HTML fragments from
  DataFileArchive URLs that can be fetched directly with httpx — no JavaScript
  or Playwright required.

Discovered fragment URLs:
  4D latest:      https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_top_draws_en.html
  4D draw list:   https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_draw_list_en.html
  TOTO latest:    https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_result_top_draws_en.html
  TOTO draw list: https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_result_draw_list_en.html

  Historical draw: fetch the fragment URL with ?sppl=<queryString>, where
  queryString is a base64-encoded "DrawNumber=XXXX" value taken from the
  draw list <select>'s <option querystring="..."> attributes.

Confirmed CSS selectors (4D):
  .tdFirstPrize, .tdSecondPrize, .tdThirdPrize
  .tbodyStarterPrizes td  — 10 starter numbers
  .tbodyConsolationPrizes td  — 10 consolation numbers
  .drawDate, .drawNumber

Confirmed CSS selectors (TOTO):
  .win1, .win2, .win3, .win4, .win5, .win6  — 6 winning numbers
  .additional  — additional number
  .drawDate, .drawNumber
"""

import asyncio
import json
import os
import re
from datetime import date, datetime

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import DrawResult

load_dotenv()

SCRAPE_DELAY = int(os.getenv("SCRAPE_DELAY_SECONDS", 2))
USE_MOCK = os.getenv("USE_MOCK_DATA", "false").lower() == "true"
MOCK_DIR = os.path.join(os.path.dirname(__file__), "..", "mock_data")

_BASE = "https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output"

FRAGMENT_URLS: dict[str, dict[str, str]] = {
    "4D": {
        "latest":    f"{_BASE}/fourd_result_top_draws_en.html",
        "draw_list": f"{_BASE}/fourd_result_draw_list_en.html",
    },
    "TOTO": {
        "latest":    f"{_BASE}/toto_result_top_draws_en.html",
        "draw_list": f"{_BASE}/toto_result_draw_list_en.html",
    },
}

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.singaporepools.com.sg/",
}


# ── Public entry points ───────────────────────────────────────────────────────

async def scrape_results(game_type: str, draw_date_str: str, db: AsyncSession) -> dict | None:
    """
    Return winning numbers dict for the given game_type and draw_date_str (YYYY-MM-DD).
    Checks DB cache first, then scrapes DataFileArchive fragments, then falls back to mock.
    """
    if USE_MOCK:
        return _load_mock(game_type, draw_date_str)

    cached = await _get_cached(game_type, draw_date_str, db)
    if cached:
        return cached

    result = await _fetch_by_date(game_type, draw_date_str)

    if result is None:
        result = _load_mock(game_type, draw_date_str)

    if result and result.get("draw_date"):
        await _cache_result(game_type, result["draw_date"], result, db)

    return result


async def scrape_latest(game_type: str, db: AsyncSession) -> dict | None:
    """
    Fetch and return the most recent draw result for the given game type.
    Also caches the result to the DB.
    """
    if USE_MOCK:
        return _load_mock_latest(game_type)

    result = await _fetch_latest_fragment(game_type)

    if result is None:
        return _load_mock_latest(game_type)

    if result and result.get("draw_date"):
        await _cache_result(game_type, result["draw_date"], result, db)

    return result


# ── Scraping helpers ──────────────────────────────────────────────────────────

async def _fetch_latest_fragment(game_type: str) -> dict | None:
    """Fetch and parse the latest draw HTML fragment directly."""
    url = FRAGMENT_URLS[game_type]["latest"]
    html = await _http_get(url)
    if html is None:
        return None
    soup = BeautifulSoup(html, "html.parser")
    return _parse_4d(soup) if game_type == "4D" else _parse_toto(soup)


async def _fetch_by_date(game_type: str, draw_date_str: str) -> dict | None:
    """
    Fetch a specific draw by date.
    1. Parse the draw list to find the queryString for that date.
    2. Fetch the fragment with ?sppl=<queryString>.
    3. Fall back to the plain latest fragment (may not match the date).
    """
    draw_list_html = await _http_get(FRAGMENT_URLS[game_type]["draw_list"])
    if draw_list_html is None:
        return await _fetch_latest_fragment(game_type)

    query_string = _find_draw_query_string(draw_list_html, draw_date_str)
    if query_string is None:
        # Date not found in draw list — return latest and let caller verify the date
        return await _fetch_latest_fragment(game_type)

    await asyncio.sleep(SCRAPE_DELAY)

    url = f"{FRAGMENT_URLS[game_type]['latest']}?sppl={query_string}"
    html = await _http_get(url)
    if html is None:
        return None

    soup = BeautifulSoup(html, "html.parser")
    return _parse_4d(soup) if game_type == "4D" else _parse_toto(soup)


def _find_draw_query_string(draw_list_html: str, draw_date_str: str) -> str | None:
    """
    Parse the draw list <select> HTML to find the queryString attribute for the
    given date.

    The <option> elements have a `querystring` attribute containing the base64
    value used to request a specific historical draw fragment.
    Option text format varies — may include draw number and/or date.
    """
    soup = BeautifulSoup(draw_list_html, "html.parser")
    select_el = soup.find("select")
    if not select_el:
        return None

    try:
        dt = datetime.strptime(draw_date_str, "%Y-%m-%d")
    except ValueError:
        return None

    # Build a set of date strings we'll look for in the option text
    # Singapore Pools uses formats like "Mon, 2 Mar 2026" or "02 Mar 2026"
    day = str(dt.day)                              # "2"  (no zero padding)
    day_padded = f"{dt.day:02d}"                   # "02"
    month_abbr = dt.strftime("%b")                 # "Mar"
    year = dt.strftime("%Y")                       # "2026"
    weekday_abbr = dt.strftime("%a")               # "Mon"

    target_variants = {
        f"{weekday_abbr}, {day} {month_abbr} {year}",
        f"{weekday_abbr}, {day_padded} {month_abbr} {year}",
        f"{day} {month_abbr} {year}",
        f"{day_padded} {month_abbr} {year}",
        draw_date_str,                             # "2026-03-02" — unlikely but safe
    }

    for option in select_el.find_all("option"):
        option_text = option.get_text(strip=True)
        # BeautifulSoup lowercases HTML attribute names
        qs = option.get("querystring") or option.get("value", "")
        for variant in target_variants:
            if variant in option_text:
                return qs if qs else None

    return None


async def _http_get(url: str) -> str | None:
    """Perform a GET request and return the response text, or None on error."""
    try:
        async with httpx.AsyncClient(
            timeout=15, headers=_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text
    except Exception as exc:
        print(f"[scraper] GET failed {url}: {exc}")
        return None


# ── HTML parsers using confirmed CSS selectors ────────────────────────────────

def _parse_4d(soup: BeautifulSoup) -> dict | None:
    """
    Parse 4D results HTML fragment.
    Confirmed selectors: .tdFirstPrize, .tdSecondPrize, .tdThirdPrize,
                         .tbodyStarterPrizes td, .tbodyConsolationPrizes td,
                         .drawDate, .drawNumber
    """
    try:
        first = soup.find(class_="tdFirstPrize")
        second = soup.find(class_="tdSecondPrize")
        third = soup.find(class_="tdThirdPrize")

        if not (first and second and third):
            return None

        starter_tbody = soup.find("tbody", class_="tbodyStarterPrizes")
        consolation_tbody = soup.find("tbody", class_="tbodyConsolationPrizes")

        starters = (
            [td.get_text(strip=True) for td in starter_tbody.find_all("td")]
            if starter_tbody else []
        )
        consolations = (
            [td.get_text(strip=True) for td in consolation_tbody.find_all("td")]
            if consolation_tbody else []
        )

        draw_date_el = soup.find(class_="drawDate")
        draw_no_el = soup.find(class_="drawNumber")

        return {
            "draw_date": _parse_draw_date(draw_date_el.get_text(strip=True) if draw_date_el else ""),
            "draw_no": _extract_draw_number(draw_no_el.get_text(strip=True) if draw_no_el else ""),
            "1st": first.get_text(strip=True),
            "2nd": second.get_text(strip=True),
            "3rd": third.get_text(strip=True),
            "starter": starters[:10],
            "consolation": consolations[:10],
        }
    except Exception as exc:
        print(f"[scraper] 4D parse error: {exc}")
        return None


def _parse_toto(soup: BeautifulSoup) -> dict | None:
    """
    Parse TOTO results HTML fragment.
    Confirmed selectors: .win1-.win6, .additional, .drawDate, .drawNumber
    """
    try:
        winning = []
        for i in range(1, 7):
            el = soup.find(class_=f"win{i}")
            if el:
                winning.append(int(el.get_text(strip=True)))

        if len(winning) < 6:
            return None

        additional_el = soup.find(class_="additional")
        draw_date_el = soup.find(class_="drawDate")
        draw_no_el = soup.find(class_="drawNumber")

        return {
            "draw_date": _parse_draw_date(draw_date_el.get_text(strip=True) if draw_date_el else ""),
            "draw_no": _extract_draw_number(draw_no_el.get_text(strip=True) if draw_no_el else ""),
            "winning_numbers": winning,
            "additional_number": (
                int(additional_el.get_text(strip=True)) if additional_el else None
            ),
        }
    except Exception as exc:
        print(f"[scraper] TOTO parse error: {exc}")
        return None


# ── Date / number helpers ─────────────────────────────────────────────────────

def _parse_draw_date(text: str) -> str:
    """
    Convert draw date text like "Sun, 01 Mar 2026" → "2026-03-01".
    Returns the original text unchanged if parsing fails.
    """
    text = text.strip()
    for fmt in ("%a, %d %b %Y", "%d %b %Y", "%A, %d %B %Y", "%a, %#d %b %Y"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Regex fallback: "1 Mar 2026" or "01 Mar 2026"
    m = re.search(r"(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})", text)
    if m:
        try:
            return datetime.strptime(
                f"{m.group(1)} {m.group(2)[:3]} {m.group(3)}", "%d %b %Y"
            ).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return text


def _extract_draw_number(text: str) -> str:
    """Extract numeric draw number from text like "Draw No. 5451" → "5451"."""
    m = re.search(r"\d+", text)
    return m.group(0) if m else text.strip()


# ── DB cache ──────────────────────────────────────────────────────────────────

async def _get_cached(game_type: str, draw_date_str: str, db: AsyncSession) -> dict | None:
    try:
        draw_date = date.fromisoformat(draw_date_str)
    except ValueError:
        return None
    stmt = select(DrawResult).where(
        DrawResult.game_type == game_type,
        DrawResult.draw_date == draw_date,
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    return row.winning_numbers if row else None


async def _cache_result(
    game_type: str, draw_date_str: str, winning_numbers: dict, db: AsyncSession
) -> None:
    try:
        draw_date = date.fromisoformat(draw_date_str)
    except ValueError:
        return
    if await _get_cached(game_type, draw_date_str, db):
        return
    db.add(DrawResult(
        game_type=game_type,
        draw_date=draw_date,
        winning_numbers=winning_numbers,
    ))
    await db.commit()


# ── Mock data fallback ────────────────────────────────────────────────────────

def _load_mock(game_type: str, draw_date_str: str) -> dict | None:
    """Load fallback data from mock_data/{game_type}_results.json."""
    path = os.path.join(MOCK_DIR, f"{game_type.lower()}_results.json")
    try:
        with open(path) as f:
            data: dict = json.load(f)
        if draw_date_str in data:
            return data[draw_date_str]
        return data[sorted(data.keys())[-1]]
    except Exception as exc:
        print(f"[scraper] Mock load failed for {game_type}: {exc}")
        return None


def _load_mock_latest(game_type: str) -> dict | None:
    """Load the most recent entry from mock data."""
    path = os.path.join(MOCK_DIR, f"{game_type.lower()}_results.json")
    try:
        with open(path) as f:
            data: dict = json.load(f)
        return data[sorted(data.keys())[-1]]
    except Exception as exc:
        print(f"[scraper] Mock load failed for {game_type}: {exc}")
        return None
