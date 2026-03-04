"""
Ticket query and response-building helpers.

Functions here encapsulate DB access and presentation logic that is shared
between multiple route handlers.
"""

import re
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import GameType, Notification, Ticket, TicketStatus

_RAW_LOG_MAX = 1200


async def load_ticket(ticket_id: str, db: AsyncSession) -> Ticket | None:
    """
    Fetch a single ticket with all relationships loaded.
    Raises HTTP 400 for a malformed UUID; returns None when not found.
    """
    try:
        ticket_uuid = uuid.UUID(ticket_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ticket ID")

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
