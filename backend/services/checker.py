"""
Win/loss comparison logic for 4D and TOTO tickets.

4D Prize Tiers:
  1st Prize      — exact match with the 1st prize number
  2nd Prize      — exact match with the 2nd prize number
  3rd Prize      — exact match with the 3rd prize number
  Starter Prize  — match with any of the 10 starter numbers
  Consolation    — match with any of the 10 consolation numbers

TOTO Prize Groups:
  Group 1 — 6 winning numbers matched
  Group 2 — 5 winning + additional number matched
  Group 3 — 5 winning numbers matched
  Group 4 — 4 winning + additional number matched
  Group 5 — 4 winning numbers matched
  Group 6 — 3 winning + additional number matched
  Group 7 — 3 winning numbers matched
"""

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import Ticket, TicketCombination, TicketResult
from services.scraper import scrape_results


async def handle_ticket_after_ocr(ticket_id: str, db: AsyncSession) -> None:
    """
    Called immediately after OCR succeeds.
    Decides whether to check now (past draw) or schedule polling (future draw).
    """
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        return

    if ticket.draw_date > date.today():
        # Case A: future draw — register a polling job
        from services.scheduler import schedule_poll
        schedule_poll(str(ticket.id), ticket.draw_date)
    else:
        # Case B: past draw — scrape and compare immediately
        await check_ticket(ticket, db)


async def check_ticket(ticket: Ticket, db: AsyncSession) -> None:
    """Scrape results for the ticket's draw date and compare all combinations."""
    results = await scrape_results(ticket.game_type, str(ticket.draw_date), db)
    if not results:
        return  # results not available yet — scheduler will retry

    # Load combinations
    stmt = select(TicketCombination).where(TicketCombination.ticket_id == ticket.id)
    combos = (await db.execute(stmt)).scalars().all()

    if not combos:
        return

    if ticket.game_type == "4D":
        result_rows = _check_4d(ticket, combos, results)
    else:
        result_rows = _check_toto(ticket, combos, results)

    for row in result_rows:
        db.add(row)

    ticket.status = "checked"
    await db.commit()


def _check_4d(
    ticket: Ticket,
    combos: list[TicketCombination],
    results: dict,
) -> list[TicketResult]:
    rows = []
    first = results.get("1st", "")
    second = results.get("2nd", "")
    third = results.get("3rd", "")
    starters = set(results.get("starter", []))
    consolations = set(results.get("consolation", []))

    for combo in combos:
        num = combo.combination.strip()
        prize_tier = None

        if num == first:
            prize_tier = "1st Prize"
        elif num == second:
            prize_tier = "2nd Prize"
        elif num == third:
            prize_tier = "3rd Prize"
        elif num in starters:
            prize_tier = "Starter"
        elif num in consolations:
            prize_tier = "Consolation"

        rows.append(TicketResult(
            ticket_id=ticket.id,
            combination_id=combo.id,
            is_winner=prize_tier is not None,
            prize_tier=prize_tier,
        ))
    return rows


def _check_toto(
    ticket: Ticket,
    combos: list[TicketCombination],
    results: dict,
) -> list[TicketResult]:
    rows = []
    winning = set(int(n) for n in results.get("winning_numbers", []))
    additional = int(results["additional_number"]) if results.get("additional_number") else None

    for combo in combos:
        # combination stored as "1,5,12,23,34,45"
        selected = set(int(n) for n in combo.combination.split(","))
        matched_winning = len(selected & winning)
        matched_additional = additional in selected if additional else False

        prize_tier = _toto_prize_tier(matched_winning, matched_additional)

        rows.append(TicketResult(
            ticket_id=ticket.id,
            combination_id=combo.id,
            is_winner=prize_tier is not None,
            prize_tier=prize_tier,
        ))
    return rows


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
        if not ticket or ticket.status == "checked":
            remove_poll(ticket_id)
            return

        results = await scrape_results(ticket.game_type, str(ticket.draw_date), db)
        if results:
            await check_ticket(ticket, db)
            remove_poll(ticket_id)
