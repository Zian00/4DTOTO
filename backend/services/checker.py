"""
Win/loss comparison logic for 4D and TOTO tickets.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import Notification, Ticket, TicketStatus
from services.scraper import scrape_results


async def handle_ticket_after_ocr(ticket_id: str, db: AsyncSession) -> None:
    """
    Decides whether to check now (past draw) or schedule polling (future draw).
    """
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        return

    if ticket.draw_date > date.today():
        from services.scheduler import schedule_poll

        schedule_poll(str(ticket.id), ticket.draw_date)
    else:
        await check_ticket(ticket, db)


async def check_ticket(ticket: Ticket, db: AsyncSession) -> None:
    """
    Scrape results for the ticket's draw date and set status to WON/LOST.
    A notification row is written whenever a ticket is resolved.
    """
    if ticket.status != TicketStatus.PENDING:
        return

    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.four_d_ticket),
            selectinload(Ticket.toto_numbers),
            selectinload(Ticket.toto_expanded_combinations),
        )
        .where(Ticket.id == ticket.id)
    )
    loaded_ticket = (await db.execute(stmt)).scalar_one_or_none()
    if not loaded_ticket:
        return

    results = await scrape_results(loaded_ticket.game_type.value, str(loaded_ticket.draw_date), db)
    if not results:
        return

    prize_tier: str | None = None
    if loaded_ticket.game_type.value == "4D":
        if not loaded_ticket.four_d_ticket:
            return
        prize_tier = _check_4d(loaded_ticket.four_d_ticket.number, results)
    else:
        combinations = [row.combination for row in loaded_ticket.toto_expanded_combinations]
        if not combinations and loaded_ticket.toto_numbers:
            sorted_numbers = sorted(n.number for n in loaded_ticket.toto_numbers)
            combinations = [",".join(str(n) for n in sorted_numbers)]
        prize_tier = _check_toto(combinations, results)

    loaded_ticket.status = TicketStatus.WON if prize_tier else TicketStatus.LOST

    if prize_tier:
        message = (
            f"Ticket won ({prize_tier}) for {loaded_ticket.game_type.value} draw "
            f"{loaded_ticket.draw_date.isoformat()}."
        )
    else:
        message = (
            f"Ticket checked for {loaded_ticket.game_type.value} draw "
            f"{loaded_ticket.draw_date.isoformat()}: no prize."
        )

    db.add(Notification(ticket_id=loaded_ticket.id, message=message))
    await db.commit()


def _check_4d(number: str, results: dict) -> str | None:
    candidate = number.strip()
    if candidate == str(results.get("1st", "")).strip():
        return "1st Prize"
    if candidate == str(results.get("2nd", "")).strip():
        return "2nd Prize"
    if candidate == str(results.get("3rd", "")).strip():
        return "3rd Prize"

    starters = {str(v).strip() for v in results.get("starter", []) if str(v).strip()}
    if candidate in starters:
        return "Starter"

    consolations = {str(v).strip() for v in results.get("consolation", []) if str(v).strip()}
    if candidate in consolations:
        return "Consolation"

    return None


def _check_toto(combinations: list[str], results: dict) -> str | None:
    winning = set(_safe_int(v) for v in results.get("winning_numbers", []))
    winning.discard(None)

    additional_raw = results.get("additional_number")
    additional = _safe_int(additional_raw)

    if not winning:
        return None

    best: str | None = None
    for combination in combinations:
        values = [_safe_int(v) for v in combination.split(",")]
        selected = {v for v in values if v is not None}
        if len(selected) < 6:
            continue

        matched_winning = len(selected & winning)
        matched_additional = additional in selected if additional is not None else False
        tier = _toto_prize_tier(matched_winning, matched_additional)
        if tier is None:
            continue
        if best is None or _tier_rank(tier) < _tier_rank(best):
            best = tier

    return best


def _safe_int(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _tier_rank(tier: str) -> int:
    ranking = {
        "Group 1": 1,
        "Group 2": 2,
        "Group 3": 3,
        "Group 4": 4,
        "Group 5": 5,
        "Group 6": 6,
        "Group 7": 7,
    }
    return ranking.get(tier, 999)


def _toto_prize_tier(matched_winning: int, matched_additional: bool) -> str | None:
    if matched_winning == 6:
        return "Group 1"
    if matched_winning == 5 and matched_additional:
        return "Group 2"
    if matched_winning == 5:
        return "Group 3"
    if matched_winning == 4 and matched_additional:
        return "Group 4"
    if matched_winning == 4:
        return "Group 5"
    if matched_winning == 3 and matched_additional:
        return "Group 6"
    if matched_winning == 3:
        return "Group 7"
    return None


async def poll_and_check(ticket_id: str) -> None:
    """
    Called by APScheduler. Checks if results are available and processes the ticket.
    Removes the scheduler job once results are found.
    """
    from database import AsyncSessionLocal
    from services.scheduler import remove_poll

    async with AsyncSessionLocal() as db:
        ticket = await db.get(Ticket, ticket_id)
        if not ticket or ticket.status != TicketStatus.PENDING:
            remove_poll(ticket_id)
            return

        results = await scrape_results(ticket.game_type.value, str(ticket.draw_date), db)
        if results:
            await check_ticket(ticket, db)
            remove_poll(ticket_id)
