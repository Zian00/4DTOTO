"""
Ticket routes — thin handlers that delegate business logic to ticket_service.
"""

import json
from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import GameType, Ticket, TicketStatus
from schemas import (
    TicketConfirmBatchResponse,
    TicketDetail,
    TicketListItem,
    TicketPreviewResponse,
)
from services import ticket_service
from services.scheduler import remove_poll
from services.ticket_service import (
    extract_prize_tier,
    load_ticket,
    log_raw_ocr_text,
    ticket_display_data,
    winner_flag,
)
from utils.errors import bad_request, not_found, payload_too_large
from utils.ocr_parsers import parse_ocr_data
from utils.parsers import (
    format_date_ddmmyyyy,
    format_purchase_datetime_for_preview,
    normalize_numbers,
    parse_draw_dates,
    parse_draw_numbers,
    parse_game_type,
    parse_purchase_datetime,
)
from utils.storage import build_image_url

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload", response_model=TicketPreviewResponse)
async def upload_ticket(file: UploadFile = File(...)):
    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        payload_too_large("File too large (max 10 MB)")

    try:
        import traceback

        from services.ocr import extract_ticket

        ocr_data = await extract_ticket(image_bytes, mime_type=file.content_type)
    except Exception as exc:
        traceback.print_exc()
        print(f"[tickets] OCR failed preview: {exc}")
        ocr_data = {
            "game_type": "4D",
            "draw_date": str(date.today()),
            "draw_dates": [str(date.today())],
            "draw_number": None,
            "draw_numbers": [],
            "purchase_datetime": None,
            "bet_type": "ORDINARY",
            "numbers": [],
            "big_amount": None,
            "small_amount": None,
            "total_price": None,
            "raw_text": f"OCR failed: {exc}",
        }

    (
        game_type,
        draw_date,
        draw_date_options,
        draw_number,
        draw_number_options,
        purchase_datetime,
        bet_type,
        numbers,
        raw_text,
        big_amount,
        small_amount,
        total_price,
    ) = parse_ocr_data(ocr_data)

    log_raw_ocr_text(raw_text, context="preview")
    return TicketPreviewResponse(
        game_type=game_type,
        draw_date=format_date_ddmmyyyy(draw_date),
        draw_date_options=[format_date_ddmmyyyy(d) for d in draw_date_options],
        draw_number=draw_number,
        draw_number_options=draw_number_options,
        purchase_datetime=format_purchase_datetime_for_preview(purchase_datetime),
        bet_type=bet_type,
        numbers=numbers,
        big_amount=big_amount,
        small_amount=small_amount,
        total_price=total_price,
        raw_ocr_text=raw_text,
    )


@router.post("/confirm", response_model=TicketConfirmBatchResponse)
async def confirm_ticket(
    file: UploadFile = File(...),
    game_type: str = Form(...),
    draw_date: str | None = Form(None),
    draw_dates_json: str | None = Form(None),
    draw_number: str | None = Form(None),
    draw_numbers_json: str | None = Form(None),
    numbers_json: str = Form(...),
    bet_type: str | None = Form(None),
    big_amount: str | None = Form(None),
    small_amount: str | None = Form(None),
    purchase_datetime: str | None = Form(None),
    raw_ocr_text: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        payload_too_large("File too large (max 10 MB)")

    gt = parse_game_type(game_type)
    draw_dates = parse_draw_dates(draw_dates_json, draw_date)
    draw_numbers = parse_draw_numbers(draw_numbers_json, draw_number, draw_dates)

    try:
        parsed_numbers = json.loads(numbers_json)
    except json.JSONDecodeError:
        bad_request("numbers_json must be valid JSON")

    numbers = normalize_numbers(parsed_numbers)
    purchase_dt = parse_purchase_datetime(purchase_datetime)

    return await ticket_service.create_ticket_batch(
        gt=gt,
        draw_dates=draw_dates,
        draw_numbers=draw_numbers,
        numbers=numbers,
        bet_type=bet_type,
        big_amount=big_amount,
        small_amount=small_amount,
        purchase_dt=purchase_dt,
        image_bytes=image_bytes,
        content_type=file.content_type,
        raw_ocr_text=raw_ocr_text,
        db=db,
    )


@router.get("", response_model=list[TicketListItem])
async def list_tickets(
    sort: str = "newest",
    filter: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.four_d_ticket),
            selectinload(Ticket.toto_ticket),
            selectinload(Ticket.toto_numbers),
            selectinload(Ticket.notifications),
        )
    )
    rows = (await db.execute(stmt)).scalars().all()

    items: list[TicketListItem] = []
    for ticket in rows:
        if filter == "4D" and ticket.game_type != GameType.FOUR_D:
            continue
        if filter == "TOTO" and ticket.game_type != GameType.TOTO:
            continue
        if filter == "system" and not (ticket.toto_ticket and ticket.toto_ticket.is_system):
            continue
        if filter == "winning" and ticket.status != TicketStatus.WON:
            continue

        bet_label, number_strings = ticket_display_data(ticket)
        items.append(
            TicketListItem(
                id=ticket.id,
                purchase_group_id=ticket.purchase_group_id,
                game_type=ticket.game_type,
                draw_date=ticket.draw_date,
                draw_number=ticket.draw_number,
                purchase_datetime=ticket.purchase_datetime,
                total_price=ticket.total_price,
                status=ticket.status,
                bet_label=bet_label,
                numbers=number_strings,
                is_winner=winner_flag(ticket.status),
                prize_tier=extract_prize_tier(ticket.notifications),
                image_url=build_image_url(ticket.image_path),
            )
        )

    if sort == "winning":
        items.sort(key=lambda x: (x.is_winner is not True, x.purchase_datetime), reverse=True)
    else:
        items.sort(key=lambda x: x.purchase_datetime, reverse=True)
    return items


@router.get("/{ticket_id}", response_model=TicketDetail)
async def get_ticket(ticket_id: str, db: AsyncSession = Depends(get_db)):
    ticket = await load_ticket(ticket_id, db)
    if not ticket:
        not_found("Ticket not found")

    needs_commit = False
    for n in ticket.notifications:
        if not n.is_read:
            n.is_read = True
            needs_commit = True
    if needs_commit:
        await db.commit()
        await db.refresh(ticket)

    bet_label, number_strings = ticket_display_data(ticket)
    prize_tier = extract_prize_tier(ticket.notifications)
    return TicketDetail(
        id=ticket.id,
        purchase_group_id=ticket.purchase_group_id,
        game_type=ticket.game_type,
        purchase_datetime=ticket.purchase_datetime,
        draw_date=ticket.draw_date,
        draw_number=ticket.draw_number,
        total_price=ticket.total_price,
        status=ticket.status,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        bet_label=bet_label,
        prize_tier=prize_tier,
        numbers=number_strings,
        four_d_ticket=ticket.four_d_ticket,
        toto_ticket=ticket.toto_ticket,
        toto_numbers=[n.number for n in sorted(ticket.toto_numbers, key=lambda row: row.number)],
        toto_expanded_combinations=[row.combination for row in ticket.toto_expanded_combinations],
        notifications=ticket.notifications,
        image_url=build_image_url(ticket.image_path),
        raw_ocr_text=ticket.raw_ocr_text,
    )


@router.delete("/{ticket_id}", status_code=204)
async def delete_ticket(ticket_id: str, db: AsyncSession = Depends(get_db)):
    ticket = await load_ticket(ticket_id, db)
    if not ticket:
        not_found("Ticket not found")

    await db.delete(ticket)
    await db.commit()
    remove_poll(str(ticket.id))
