"""
Notification routes — list and mark individual notifications as read.
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Notification, Ticket
from schemas import NotificationListItem
from utils.errors import not_found

router = APIRouter()


@router.get("", response_model=list[NotificationListItem])
async def list_notifications(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Notification, Ticket.game_type, Ticket.draw_date)
        .join(Ticket, Notification.ticket_id == Ticket.id)
        .order_by(desc(Notification.created_at))
        .limit(50)
    )
    rows = (await db.execute(stmt)).all()
    return [
        NotificationListItem(
            id=row.Notification.id,
            ticket_id=row.Notification.ticket_id,
            message=row.Notification.message,
            is_read=row.Notification.is_read,
            created_at=row.Notification.created_at,
            game_type=row.game_type,
            draw_date=row.draw_date,
        )
        for row in rows
    ]


@router.patch("/{notification_id}/read", response_model=NotificationListItem)
async def mark_notification_read(notification_id: str, db: AsyncSession = Depends(get_db)):
    try:
        notif_uuid = uuid.UUID(notification_id)
    except ValueError:
        not_found("Notification not found")

    notif = await db.get(Notification, notif_uuid)
    if not notif:
        not_found("Notification not found")

    ticket = await db.get(Ticket, notif.ticket_id)
    if not ticket:
        not_found("Ticket not found")

    if not notif.is_read:
        notif.is_read = True
        await db.commit()
        await db.refresh(notif)

    return NotificationListItem(
        id=notif.id,
        ticket_id=notif.ticket_id,
        message=notif.message,
        is_read=notif.is_read,
        created_at=notif.created_at,
        game_type=ticket.game_type,
        draw_date=ticket.draw_date,
    )
