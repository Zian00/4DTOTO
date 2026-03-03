"""
Frequency Analysis prediction model.

How it works:
  4D  — Count how often each digit (0-9) appears in each positional slot
        (thousands, hundreds, tens, units) across all historical 4D draws.
        Assemble the most-frequent digit per position into a 4-digit number.

  TOTO — Count how often each number (1-49) has appeared across all
         historical TOTO draws. Pick the top 12 by frequency.
         First 6 → primary numbers, next 6 → supplementary numbers.

Disclaimer (must be shown prominently in the UI):
  "These predictions are for educational and entertainment purposes only.
   They are not gambling advice. Lottery draws are random — past results
   do not predict future outcomes."
"""

from collections import Counter

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import DrawResult

DISCLAIMER = (
    "These predictions are for educational and entertainment purposes only. "
    "They are not gambling advice. Lottery draws are random — "
    "past results do not predict future outcomes."
)


async def frequency_analysis(db: AsyncSession) -> dict:
    """Run frequency analysis over all stored draw results and return predictions."""
    fourd_rows = (
        await db.execute(select(DrawResult).where(DrawResult.game_type == "4D"))
    ).scalars().all()
    toto_rows = (
        await db.execute(select(DrawResult).where(DrawResult.game_type == "TOTO"))
    ).scalars().all()

    four_d_prediction = _predict_4d(fourd_rows)
    toto_prediction = _predict_toto(toto_rows)

    return {
        "model": "Frequency Analysis",
        "description": (
            "Selects numbers based on their historical draw frequency "
            "across all available past results."
        ),
        "four_d_prediction": four_d_prediction,
        "toto_prediction": toto_prediction,
        "data_points": len(fourd_rows) + len(toto_rows),
        "disclaimer": DISCLAIMER,
    }


def _predict_4d(rows: list[DrawResult]) -> str:
    """
    For each of the 4 digit positions, find the most frequently occurring digit
    across all prize numbers (1st, 2nd, 3rd, starter, consolation).
    """
    position_counters = [Counter() for _ in range(4)]

    for row in rows:
        numbers = _extract_4d_numbers(row.winning_numbers)
        for num in numbers:
            if len(num) == 4 and num.isdigit():
                for i, digit in enumerate(num):
                    position_counters[i][digit] += 1

    predicted = ""
    for i, counter in enumerate(position_counters):
        if counter:
            predicted += counter.most_common(1)[0][0]
        else:
            predicted += str(i)  # fallback digit

    return predicted


def _predict_toto(rows: list[DrawResult]) -> dict:
    """
    Count how often each number 1-49 appears in TOTO winning_numbers across all draws.
    Top 12 by frequency → first 6 primary, next 6 supplementary.
    """
    counter: Counter = Counter()

    for row in rows:
        numbers = _extract_toto_numbers(row.winning_numbers)
        for n in numbers:
            try:
                counter[int(n)] += 1
            except (ValueError, TypeError):
                pass

    # Top 12 by frequency; fill from 1-49 if we don't have enough data
    top_12 = [n for n, _ in counter.most_common(12)]
    if len(top_12) < 12:
        candidates = [n for n in range(1, 50) if n not in top_12]
        top_12 += candidates[:12 - len(top_12)]

    return {
        "primary": sorted(top_12[:6]),
        "supplementary": sorted(top_12[6:12]),
        "format": "System 12",
    }


def _extract_4d_numbers(winning_numbers: dict) -> list[str]:
    """Pull all 4-digit strings out of a draw_results winning_numbers dict."""
    nums: list[str] = []
    for key in ("1st", "2nd", "3rd"):
        val = winning_numbers.get(key)
        if isinstance(val, str):
            nums.append(val)
    for key in ("starter", "consolation"):
        val = winning_numbers.get(key, [])
        if isinstance(val, list):
            nums.extend(val)
    return nums


def _extract_toto_numbers(winning_numbers: dict) -> list:
    """Pull the 6 winning TOTO numbers (and optionally the additional number)."""
    nums = winning_numbers.get("winning_numbers", [])
    additional = winning_numbers.get("additional_number")
    if additional is not None:
        nums = list(nums) + [additional]
    return nums
