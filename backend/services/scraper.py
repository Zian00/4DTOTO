"""
Singapore Pools results scraper.

Strategy (confirmed via Chrome DevTools network inspection, 2026-03-03):
- No JSON API exists.
- Latest draws can be read from DataFileArchive HTML fragments.
- Historical draws must be fetched from the server-rendered single-result pages.
"""

import asyncio
import re
from datetime import date, datetime, timezone

import certifi
import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import DrawResult

SCRAPE_DELAY = settings.scrape_delay_seconds

_BASE = "https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output"

FRAGMENT_URLS: dict[str, dict[str, str]] = {
    "4D": {
        "latest": f"{_BASE}/fourd_result_top_draws_en.html",
        "draw_list": f"{_BASE}/fourd_result_draw_list_en.html",
    },
    "TOTO": {
        "latest": f"{_BASE}/toto_result_top_draws_en.html",
        "draw_list": f"{_BASE}/toto_result_draw_list_en.html",
    },
}

SINGLE_RESULT_URLS: dict[str, str] = {
    "4D": "https://www.singaporepools.com.sg/en/product/pages/4d_results.aspx",
    "TOTO": "https://www.singaporepools.com.sg/en/product/sr/Pages/toto_results.aspx",
}

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.singaporepools.com.sg/",
}


async def scrape_results(game_type: str, draw_date_str: str, db: AsyncSession) -> dict | None:
    """
    Return winning numbers for game_type and draw_date_str (YYYY-MM-DD).
    Reads DB cache first, then scrapes live source, then caches on success.
    """
    cached = await _get_cached(game_type, draw_date_str, db)
    if cached:
        return cached

    result = await _fetch_by_date(game_type, draw_date_str)
    if result and result.get("draw_date"):
        await _cache_result(game_type, result["draw_date"], result, db)
    return result


async def scrape_latest(game_type: str, db: AsyncSession) -> dict | None:
    """
    Fetch and return the latest draw for game_type, then cache it.
    """
    result = await _fetch_latest_fragment(game_type)
    if result and result.get("draw_date"):
        await _cache_result(game_type, result["draw_date"], result, db)
    return result


async def _fetch_latest_fragment(game_type: str) -> dict | None:
    url = FRAGMENT_URLS[game_type]["latest"]
    html = await _http_get(url)
    if html is None:
        return None
    soup = BeautifulSoup(html, "html.parser")
    return _parse_4d(soup) if game_type == "4D" else _parse_toto(soup)


async def _fetch_by_date(game_type: str, draw_date_str: str) -> dict | None:
    """
    Fetch a specific draw by date:
    1) read draw list and locate queryString for draw_date_str
    2) request single-result page with that queryString
    3) parse .divSingleDraw and verify date matches
    """
    draw_list_html = await _http_get(FRAGMENT_URLS[game_type]["draw_list"])
    if draw_list_html is None:
        return None

    query_string = _find_draw_query_string(draw_list_html, draw_date_str)
    if query_string is None:
        return None

    await asyncio.sleep(SCRAPE_DELAY)

    url = _build_single_result_url(game_type, query_string)
    html = await _http_get(url)
    if html is None:
        return None

    result = _parse_single_result_page(game_type, html)
    if not result:
        return None

    if result.get("draw_date") != draw_date_str:
        print(
            f"[scraper] date mismatch for {game_type}: requested {draw_date_str}, got {result.get('draw_date')}"
        )
        return None

    return result


def _build_single_result_url(game_type: str, query_string: str) -> str:
    qs = query_string.strip().lstrip("?")
    return f"{SINGLE_RESULT_URLS[game_type]}?{qs}"


def _parse_single_result_page(game_type: str, html: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    single_draw = soup.select_one(".divSingleDraw")
    target = single_draw if single_draw else soup
    return _parse_4d(target) if game_type == "4D" else _parse_toto(target)


def _find_draw_query_string(draw_list_html: str, draw_date_str: str) -> str | None:
    """
    Extract queryString from draw-list <option> matching the requested date.
    """
    soup = BeautifulSoup(draw_list_html, "html.parser")
    select_el = soup.find("select")
    if not select_el:
        return None

    try:
        dt = datetime.strptime(draw_date_str, "%Y-%m-%d")
    except ValueError:
        return None

    day = str(dt.day)
    day_padded = f"{dt.day:02d}"
    month_abbr = dt.strftime("%b")
    year = dt.strftime("%Y")
    weekday_abbr = dt.strftime("%a")

    target_variants = {
        f"{weekday_abbr}, {day} {month_abbr} {year}",
        f"{weekday_abbr}, {day_padded} {month_abbr} {year}",
        f"{day} {month_abbr} {year}",
        f"{day_padded} {month_abbr} {year}",
        draw_date_str,
    }

    for option in select_el.find_all("option"):
        option_text = option.get_text(strip=True)
        qs = option.get("querystring") or option.get("value", "")
        for variant in target_variants:
            if variant in option_text:
                return qs if qs else None

    return None


async def _http_get(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(
            timeout=15, headers=_HEADERS, follow_redirects=True, verify=certifi.where()
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text
    except Exception as exc:
        print(f"[scraper] GET failed {url}: {exc}")
        return None


def _parse_4d(soup: BeautifulSoup) -> dict | None:
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


def _parse_draw_date(text: str) -> str:
    text = text.strip()
    for fmt in ("%a, %d %b %Y", "%d %b %Y", "%A, %d %B %Y", "%a, %#d %b %Y"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

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
    m = re.search(r"\d+", text)
    return m.group(0) if m else text.strip()


async def scrape_all_historical(game_type: str, db: AsyncSession) -> int:
    """
    Fetch every draw found in the draw-list HTML for game_type and cache
    any that are not already stored in the database.
    Returns the number of newly cached draws.
    """
    draw_list_html = await _http_get(FRAGMENT_URLS[game_type]["draw_list"])
    if not draw_list_html:
        return 0

    options = _parse_all_draw_options(draw_list_html)
    if not options:
        print(f"[scraper] no draw options parsed for {game_type}")
        return 0

    existing = await _get_all_cached_dates(game_type, db)
    new_count = 0

    for draw_date_str, query_string in options:
        if draw_date_str in existing:
            continue

        await asyncio.sleep(SCRAPE_DELAY)

        url = _build_single_result_url(game_type, query_string)
        html = await _http_get(url)
        if not html:
            continue

        result = _parse_single_result_page(game_type, html)
        if not result or not result.get("draw_date"):
            continue

        await _cache_result(game_type, result["draw_date"], result, db)
        existing.add(result["draw_date"])
        new_count += 1
        print(f"[scraper] cached {game_type} {result['draw_date']}")

    return new_count


def _parse_all_draw_options(draw_list_html: str) -> list[tuple[str, str]]:
    """
    Parse the draw-list HTML and return [(draw_date_str, query_string), ...]
    for every option whose text can be parsed as a YYYY-MM-DD date.
    """
    soup = BeautifulSoup(draw_list_html, "html.parser")
    select_el = soup.find("select")
    if not select_el:
        return []

    results: list[tuple[str, str]] = []
    for option in select_el.find_all("option"):
        qs = option.get("querystring") or option.get("value", "")
        if not qs:
            continue
        date_str = _parse_draw_date(option.get_text(strip=True))
        # _parse_draw_date returns the original text on failure; validate shape
        if re.match(r"\d{4}-\d{2}-\d{2}$", date_str):
            results.append((date_str, qs))

    return results


async def _get_all_cached_dates(game_type: str, db: AsyncSession) -> set[str]:
    """Return all draw date strings already stored in the database."""
    stmt = select(DrawResult.draw_date).where(DrawResult.game_type == game_type)
    rows = (await db.execute(stmt)).scalars().all()
    return {d.isoformat() for d in rows}


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
        scraped_at=datetime.now(timezone.utc),
    ))
    await db.commit()
