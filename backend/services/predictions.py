"""Three statistical prediction models for 4D and TOTO lottery numbers.

All models operate on historical draw data stored in the database.
None of these models have predictive power — lottery draws are random.
They are provided for educational and entertainment purposes only.

Models
------
1. Frequency Analysis
   Count how often each digit/number has appeared across all history.
   Pick the most-frequent digit per position (4D) or top 12 numbers (TOTO).

2. Hot/Cold Analysis
   Hot  = digits/numbers drawn most often in the last 10 draws.
   Cold = digits/numbers absent from the last 30 draws.
   4D primary → hottest digits; TOTO primary → hottest 6, supplementary → coldest 6.

3. Recency-Weighted Frequency
   Apply exponential decay (weight = DECAY^age) so recent draws contribute
   more to the accumulated score than older ones.

Disclaimer (must be shown prominently in the UI):
  "These predictions are for educational and entertainment purposes only.
   They are not gambling advice. Lottery draws are random — past results
   do not predict future outcomes."
"""

from collections import Counter

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import DrawResult

DISCLAIMER = (
    "These predictions are for educational and entertainment purposes only. "
    "They are not gambling advice. Lottery draws are random — "
    "past results do not predict future outcomes."
)

_DECAY = 0.93  # exponential decay factor; weight = _DECAY ** draw_age


# ── Model 1: Frequency Analysis ─────────────────────────────────────────────

async def frequency_analysis(db: AsyncSession) -> dict:
    """Count digit/number frequency across all historical draws."""
    fourd_rows = (
        await db.execute(select(DrawResult).where(DrawResult.game_type == "4D"))
    ).scalars().all()
    toto_rows = (
        await db.execute(select(DrawResult).where(DrawResult.game_type == "TOTO"))
    ).scalars().all()

    return {
        "model": "Frequency Analysis",
        "description": (
            "Selects numbers based on their historical draw frequency "
            "across all available past results."
        ),
        "four_d_prediction": _freq_4d(fourd_rows),
        "toto_prediction": _freq_toto(toto_rows),
        "data_points": len(fourd_rows) + len(toto_rows),
        "disclaimer": DISCLAIMER,
    }


# ── Model 2: Hot / Cold Analysis ─────────────────────────────────────────────

async def hot_cold_analysis(db: AsyncSession) -> dict:
    """
    Hot numbers: drawn most often within the last 10 draws.
    Cold numbers: not appeared in the last 30 draws.
    4D  — hot digit per position from the last-10-draw window.
    TOTO — primary = 6 hottest numbers; supplementary = 6 coldest numbers.
    """
    fourd_rows = (
        await db.execute(
            select(DrawResult)
            .where(DrawResult.game_type == "4D")
            .order_by(desc(DrawResult.draw_date))
        )
    ).scalars().all()
    toto_rows = (
        await db.execute(
            select(DrawResult)
            .where(DrawResult.game_type == "TOTO")
            .order_by(desc(DrawResult.draw_date))
        )
    ).scalars().all()

    return {
        "model": "Hot/Cold Analysis",
        "description": (
            "Hot numbers come from the most recent draws; "
            "cold numbers have not appeared for the longest time."
        ),
        "four_d_prediction": _hot_cold_4d(fourd_rows),
        "toto_prediction": _hot_cold_toto(toto_rows),
        "data_points": len(fourd_rows) + len(toto_rows),
        "disclaimer": DISCLAIMER,
    }


# ── Model 3: Recency-Weighted Frequency ──────────────────────────────────────

async def recency_weighted_frequency(db: AsyncSession) -> dict:
    """
    Exponential decay weighting: weight = DECAY^age where age=0 for the
    most recent draw. Ensures recent draws contribute more than older ones.
    """
    fourd_rows = (
        await db.execute(
            select(DrawResult)
            .where(DrawResult.game_type == "4D")
            .order_by(desc(DrawResult.draw_date))
        )
    ).scalars().all()
    toto_rows = (
        await db.execute(
            select(DrawResult)
            .where(DrawResult.game_type == "TOTO")
            .order_by(desc(DrawResult.draw_date))
        )
    ).scalars().all()

    return {
        "model": "Recency-Weighted Frequency",
        "description": (
            f"Applies exponential decay (factor={_DECAY}) so that recent draws "
            "contribute more to the prediction than older ones."
        ),
        "four_d_prediction": _weighted_4d(fourd_rows),
        "toto_prediction": _weighted_toto(toto_rows),
        "data_points": len(fourd_rows) + len(toto_rows),
        "disclaimer": DISCLAIMER,
    }


# ── 4D helpers ───────────────────────────────────────────────────────────────

def _freq_4d(rows) -> str:
    position_counters = [Counter() for _ in range(4)]
    for row in rows:
        for num in _extract_4d_numbers(row.winning_numbers):
            if len(num) == 4 and num.isdigit():
                for i, digit in enumerate(num):
                    position_counters[i][digit] += 1
    return "".join(
        c.most_common(1)[0][0] if c else str(i)
        for i, c in enumerate(position_counters)
    )


def _hot_cold_4d(rows) -> str:
    """Most-frequent digit per position using only the last 10 draws."""
    window = rows[:10]
    if not window:
        return _freq_4d(rows)
    position_counters = [Counter() for _ in range(4)]
    for row in window:
        for num in _extract_4d_numbers(row.winning_numbers):
            if len(num) == 4 and num.isdigit():
                for i, digit in enumerate(num):
                    position_counters[i][digit] += 1
    return "".join(
        c.most_common(1)[0][0] if c else str(i)
        for i, c in enumerate(position_counters)
    )


def _weighted_4d(rows) -> str:
    """Exponential-decay weighted digit frequency per position."""
    position_weights: list[dict[str, float]] = [{} for _ in range(4)]
    for age, row in enumerate(rows):
        w = _DECAY ** age
        for num in _extract_4d_numbers(row.winning_numbers):
            if len(num) == 4 and num.isdigit():
                for i, digit in enumerate(num):
                    position_weights[i][digit] = position_weights[i].get(digit, 0.0) + w
    return "".join(
        max(pw, key=pw.__getitem__) if pw else str(i)
        for i, pw in enumerate(position_weights)
    )


# ── TOTO helpers ─────────────────────────────────────────────────────────────

def _freq_toto(rows) -> dict:
    counter: Counter = Counter()
    for row in rows:
        for n in _extract_toto_numbers(row.winning_numbers):
            try:
                counter[int(n)] += 1
            except (ValueError, TypeError):
                pass
    top_12 = [n for n, _ in counter.most_common(12)]
    if len(top_12) < 12:
        extras = [n for n in range(1, 50) if n not in top_12]
        top_12 += extras[:12 - len(top_12)]
    return {"primary": sorted(top_12[:6]), "supplementary": sorted(top_12[6:12]), "format": "System 12"}


def _hot_cold_toto(rows) -> dict:
    """
    Hot (primary 6)        — top 6 by occurrence in last 10 draws.
    Cold (supplementary 6) — 6 numbers absent from last 30 draws.
    Falls back gracefully when data is insufficient.
    """
    hot_counter: Counter = Counter()
    for row in rows[:10]:
        for n in _extract_toto_numbers(row.winning_numbers):
            try:
                hot_counter[int(n)] += 1
            except (ValueError, TypeError):
                pass

    recent_set: set[int] = set()
    for row in rows[:30]:
        for n in _extract_toto_numbers(row.winning_numbers):
            try:
                recent_set.add(int(n))
            except (ValueError, TypeError):
                pass

    hot_numbers: list[int] = [n for n, _ in hot_counter.most_common(6)]

    # Fill hot shortfall from full-history frequency
    if len(hot_numbers) < 6:
        full_counter: Counter = Counter()
        for row in rows:
            for n in _extract_toto_numbers(row.winning_numbers):
                try:
                    full_counter[int(n)] += 1
                except (ValueError, TypeError):
                    pass
        for n, _ in full_counter.most_common():
            if n not in hot_numbers:
                hot_numbers.append(n)
            if len(hot_numbers) == 6:
                break

    # Cold: absent from last 30 draws, excluding already-chosen hot numbers
    cold_numbers = [n for n in range(1, 50) if n not in recent_set and n not in hot_numbers][:6]

    # Fill cold shortfall: least-frequent numbers in full history
    if len(cold_numbers) < 6:
        full_counter2: Counter = Counter({n: 0 for n in range(1, 50)})
        for row in rows:
            for n in _extract_toto_numbers(row.winning_numbers):
                try:
                    full_counter2[int(n)] += 1
                except (ValueError, TypeError):
                    pass
        for n, _ in sorted(full_counter2.items(), key=lambda x: x[1]):
            if n not in hot_numbers and n not in cold_numbers:
                cold_numbers.append(n)
            if len(cold_numbers) == 6:
                break

    return {"primary": sorted(hot_numbers[:6]), "supplementary": sorted(cold_numbers[:6]), "format": "System 12"}


def _weighted_toto(rows) -> dict:
    """Exponential-decay weighted TOTO number frequency."""
    weights: dict[int, float] = {}
    for age, row in enumerate(rows):
        w = _DECAY ** age
        for n in _extract_toto_numbers(row.winning_numbers):
            try:
                num = int(n)
                weights[num] = weights.get(num, 0.0) + w
            except (ValueError, TypeError):
                pass
    top_12 = sorted(weights, key=weights.__getitem__, reverse=True)[:12]
    if len(top_12) < 12:
        extras = [n for n in range(1, 50) if n not in top_12]
        top_12 += extras[:12 - len(top_12)]
    return {"primary": sorted(top_12[:6]), "supplementary": sorted(top_12[6:12]), "format": "System 12"}


# ── Shared extractors ─────────────────────────────────────────────────────────

def _extract_4d_numbers(winning_numbers: dict) -> list[str]:
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
    nums = winning_numbers.get("winning_numbers", [])
    additional = winning_numbers.get("additional_number")
    if additional is not None:
        nums = list(nums) + [additional]
    return nums
