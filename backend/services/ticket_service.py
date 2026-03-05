"""
Ticket query, response-building, and creation helpers.

Functions here encapsulate DB access and business logic shared between
route handlers, or moved out of route handlers to keep them thin.
"""

import re
import uuid
from datetime import date, datetime
from decimal import Decimal
from itertools import combinations
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings
from models import (
    DrawResult,
    FourDTicket,
    GameType,
    Notification,
    Ticket,
    TicketStatus,
    TotoExpandedCombination,
    TotoNumber,
    TotoTicket,
)
from schemas import TicketConfirmBatchResponse
from utils.errors import bad_request
from utils.parsers import (
    _normalize_draw_number_token,
    extract_4d_numbers,
    extract_toto_sets,
    parse_4d_bet_type,
    parse_decimal,
    parse_toto_mode,
)
from utils.storage import save_image

_RAW_LOG_MAX = 1200
MAX_CREATED_TICKETS = 300


async def load_ticket(ticket_id: str, db: AsyncSession) -> Ticket | None:
    """
    Fetch a single ticket with all relationships loaded.
    Raises HTTP 400 for a malformed UUID; returns None when not found.
    """
    try:
        ticket_uuid = uuid.UUID(ticket_id)
    except ValueError:
        bad_request("Invalid ticket ID")

    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.four_d_ticket),
            selectinload(Ticket.toto_ticket),
            selectinload(Ticket.toto_numbers),
            selectinload(Ticket.toto_expanded_combinations),
            selectinload(Ticket.notifications),
        )
        .where(Ticket.id == ticket_uuid)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


def ticket_display_data(ticket: Ticket) -> tuple[str | None, list[str]]:
    """Return (bet_label, number_strings) for display in list and detail views."""
    if ticket.game_type == GameType.FOUR_D and ticket.four_d_ticket:
        return ticket.four_d_ticket.bet_type.value, [ticket.four_d_ticket.number]

    if ticket.game_type == GameType.TOTO:
        numbers = [str(row.number) for row in sorted(ticket.toto_numbers, key=lambda n: n.number)]
        if ticket.toto_ticket and ticket.toto_ticket.is_system:
            label = ticket.toto_ticket.system_type.value if ticket.toto_ticket.system_type else "SYSTEM"
        else:
            label = "ORDINARY"
        return label, numbers

    return None, []


def winner_flag(status: TicketStatus) -> bool | None:
    """Convert ticket status to a nullable winner boolean."""
    if status == TicketStatus.WON:
        return True
    if status == TicketStatus.LOST:
        return False
    return None


def extract_prize_tier(notifications: list[Notification]) -> str | None:
    """Extract prize tier string from the most recent notification message, if present."""
    for notification in sorted(notifications, key=lambda row: row.created_at, reverse=True):
        match = re.search(r"\(([^()]+)\)", notification.message)
        if match:
            return match.group(1)
    return None


def log_raw_ocr_text(raw_text: object, context: str) -> None:
    """Log OCR raw text to stdout, truncating if necessary."""
    if not settings.log_ocr_raw_text:
        print(f"[tickets] OCR raw text ({context}): <suppressed>")
        return
    if raw_text is None:
        print(f"[tickets] OCR raw text ({context}): <empty>")
        return
    text = str(raw_text).strip()
    if not text:
        print(f"[tickets] OCR raw text ({context}): <empty>")
        return
    if len(text) > _RAW_LOG_MAX:
        print(f"[tickets] OCR raw text ({context}): {text[:_RAW_LOG_MAX]}...[truncated]")
        return
    print(f"[tickets] OCR raw text ({context}): {text}")


async def create_ticket_batch(
    gt: GameType,
    draw_dates: list[date],
    draw_numbers: list[str | None],
    numbers: list[list[str]],
    bet_type: str | None,
    big_amount: str | None,
    small_amount: str | None,
    purchase_dt: datetime | None,
    image_bytes: bytes,
    detected_mime: str,
    raw_ocr_text: str | None,
    db: AsyncSession,
) -> TicketConfirmBatchResponse:
    """Create all ticket ORM objects for a batch, persist them and trigger checking."""
    purchase_group_id = uuid.uuid4()
    saved_image_filename = save_image(image_bytes, detected_mime, str(purchase_group_id))
    resolved_draw_numbers = list(draw_numbers)
    if len(resolved_draw_numbers) < len(draw_dates):
        resolved_draw_numbers.extend([None] * (len(draw_dates) - len(resolved_draw_numbers)))

    # If draw number is missing, backfill from cached official results for that date.
    for idx, d in enumerate(draw_dates):
        if resolved_draw_numbers[idx]:
            continue
        winning_numbers = (
            await db.execute(
                select(DrawResult.winning_numbers).where(
                    DrawResult.game_type == gt.value,
                    DrawResult.draw_date == d,
                )
            )
        ).scalar_one_or_none()
        if not isinstance(winning_numbers, dict):
            continue
        normalized = _normalize_draw_number_token(winning_numbers.get("draw_no"))
        if normalized:
            resolved_draw_numbers[idx] = normalized

    created_tickets: list[Ticket] = []

    if gt == GameType.FOUR_D:
        four_d_numbers = extract_4d_numbers(numbers)
        if len(draw_dates) * len(four_d_numbers) > MAX_CREATED_TICKETS:
            bad_request(f"Too many ticket entries generated. Max {MAX_CREATED_TICKETS}.")

        four_d_bet_type = parse_4d_bet_type(bet_type)
        big = parse_decimal(big_amount, default=Decimal("0.00"))
        small = parse_decimal(small_amount, default=Decimal("0.00"))
        if big <= 0 and small <= 0:
            small = Decimal("1.00")

        for idx, d in enumerate(draw_dates):
            draw_no = resolved_draw_numbers[idx] if idx < len(resolved_draw_numbers) else None
            for number in four_d_numbers:
                ticket = Ticket(
                    purchase_group_id=purchase_group_id,
                    game_type=gt,
                    draw_date=d,
                    draw_number=draw_no,
                    status=TicketStatus.PENDING,
                    total_price=big + small,
                )
                if purchase_dt is not None:
                    ticket.purchase_datetime = purchase_dt
                ticket.four_d_ticket = FourDTicket(
                    number=number,
                    bet_type=four_d_bet_type,
                    big_amount=big,
                    small_amount=small,
                )
                created_tickets.append(ticket)
    else:
        toto_sets = extract_toto_sets(numbers)
        if len(draw_dates) * len(toto_sets) > MAX_CREATED_TICKETS:
            bad_request(f"Too many ticket entries generated. Max {MAX_CREATED_TICKETS}.")

        for idx, d in enumerate(draw_dates):
            draw_no = resolved_draw_numbers[idx] if idx < len(resolved_draw_numbers) else None
            for selected in toto_sets:
                is_system, system_type = parse_toto_mode(selected, bet_type)
                total_price = Decimal(str(len(list(combinations(sorted(selected), 6)))))

                ticket = Ticket(
                    purchase_group_id=purchase_group_id,
                    game_type=gt,
                    draw_date=d,
                    draw_number=draw_no,
                    status=TicketStatus.PENDING,
                    total_price=total_price,
                )
                if purchase_dt is not None:
                    ticket.purchase_datetime = purchase_dt
                ticket.toto_ticket = TotoTicket(is_system=is_system, system_type=system_type)
                ticket.toto_numbers = [TotoNumber(number=n) for n in selected]
                for combo in combinations(sorted(selected), 6):
                    combo_str = ",".join(str(n) for n in combo)
                    ticket.toto_expanded_combinations.append(
                        TotoExpandedCombination(combination=combo_str)
                    )
                created_tickets.append(ticket)

    if not created_tickets:
        bad_request("No ticket entries could be generated")

    for ticket in created_tickets:
        ticket.image_path = saved_image_filename
        ticket.raw_ocr_text = raw_ocr_text

    log_raw_ocr_text(raw_ocr_text, context="confirm")
    db.add_all(created_tickets)
    await db.commit()
    for ticket in created_tickets:
        await db.refresh(ticket)

    # Inline imports to avoid circular dependency (checker ↔ scheduler).
    from services.checker import check_ticket
    from services.scheduler import schedule_poll

    today = date.today()
    for ticket in created_tickets:
        if ticket.draw_date > today:
            schedule_poll(str(ticket.id), ticket.draw_date)
        else:
            await check_ticket(ticket, db)

    ticket_ids = [ticket.id for ticket in created_tickets]
    status_stmt = select(Ticket.status).where(Ticket.id.in_(ticket_ids))
    statuses = (await db.execute(status_stmt)).scalars().all()
    pending_count = sum(1 for s in statuses if s == TicketStatus.PENDING)
    won_count = sum(1 for s in statuses if s == TicketStatus.WON)
    lost_count = sum(1 for s in statuses if s == TicketStatus.LOST)

    return TicketConfirmBatchResponse(
        purchase_group_id=purchase_group_id,
        created_count=len(ticket_ids),
        ticket_ids=ticket_ids,
        pending_count=pending_count,
        won_count=won_count,
        lost_count=lost_count,
        message=f"Created {len(ticket_ids)} ticket entries.",
    )
