import json
import uuid
from datetime import date
from decimal import Decimal
from itertools import combinations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import (
    FourDTicket,
    GameType,
    Ticket,
    TicketStatus,
    TotoExpandedCombination,
    TotoNumber,
    TotoTicket,
)
from schemas import (
    TicketConfirmBatchResponse,
    TicketDetail,
    TicketListItem,
    TicketPreviewResponse,
)
from services.scheduler import remove_poll
from services.ticket_service import (
    extract_prize_tier,
    load_ticket,
    log_raw_ocr_text,
    ticket_display_data,
    winner_flag,
)
from utils.parsers import (
    extract_4d_numbers,
    extract_toto_sets,
    format_date_ddmmyyyy,
    format_purchase_datetime_for_preview,
    normalize_numbers,
    parse_4d_bet_type,
    parse_decimal,
    parse_draw_dates,
    parse_draw_numbers,
    parse_game_type,
    parse_ocr_data,
    parse_purchase_datetime,
    parse_toto_mode,
)
from utils.storage import build_image_url, save_image

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_CREATED_TICKETS = 300


@router.post("/upload", response_model=TicketPreviewResponse)
async def upload_ticket(file: UploadFile = File(...)):
    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

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
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    gt = parse_game_type(game_type)
    draw_dates = parse_draw_dates(draw_dates_json, draw_date)
    draw_numbers = parse_draw_numbers(draw_numbers_json, draw_number, draw_dates)
    purchase_group_id = uuid.uuid4()

    saved_image_filename = save_image(image_bytes, file.content_type, str(purchase_group_id))

    try:
        parsed_numbers = json.loads(numbers_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="numbers_json must be valid JSON")

    numbers = normalize_numbers(parsed_numbers)
    if not numbers:
        raise HTTPException(status_code=400, detail="At least one number set is required")

    purchase_dt = parse_purchase_datetime(purchase_datetime)
    created_tickets: list[Ticket] = []

    if gt == GameType.FOUR_D:
        four_d_numbers = extract_4d_numbers(numbers)
        if len(draw_dates) * len(four_d_numbers) > MAX_CREATED_TICKETS:
            raise HTTPException(
                status_code=400,
                detail=f"Too many ticket entries generated. Max {MAX_CREATED_TICKETS}.",
            )

        four_d_bet_type = parse_4d_bet_type(bet_type)
        big = parse_decimal(big_amount, default=Decimal("0.00"))
        small = parse_decimal(small_amount, default=Decimal("0.00"))
        if big <= 0 and small <= 0:
            small = Decimal("1.00")

        for idx, d in enumerate(draw_dates):
            draw_no = draw_numbers[idx] if idx < len(draw_numbers) else None
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
            raise HTTPException(
                status_code=400,
                detail=f"Too many ticket entries generated. Max {MAX_CREATED_TICKETS}.",
            )

        for idx, d in enumerate(draw_dates):
            draw_no = draw_numbers[idx] if idx < len(draw_numbers) else None
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
        raise HTTPException(status_code=400, detail="No ticket entries could be generated")

    for ticket in created_tickets:
        ticket.image_path = saved_image_filename
        ticket.raw_ocr_text = raw_ocr_text

    log_raw_ocr_text(raw_ocr_text, context="confirm")
    db.add_all(created_tickets)
    await db.commit()
    for ticket in created_tickets:
        await db.refresh(ticket)

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

        bet_label, _ = ticket_display_data(ticket)
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
        raise HTTPException(status_code=404, detail="Ticket not found")

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
        raise HTTPException(status_code=404, detail="Ticket not found")

    await db.delete(ticket)
    await db.commit()
    remove_poll(str(ticket.id))
