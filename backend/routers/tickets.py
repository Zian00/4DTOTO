import json
import re
import traceback
from datetime import date
from decimal import Decimal, InvalidOperation
from itertools import combinations
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import (
    FourDBetType,
    FourDTicket,
    GameType,
    Notification,
    Ticket,
    TicketStatus,
    TotoExpandedCombination,
    TotoNumber,
    TotoSystemType,
    TotoTicket,
)
from schemas import TicketDetail, TicketListItem, TicketPreviewResponse, TicketUploadResponse

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
RAW_LOG_MAX = 1200


@router.post("/upload", response_model=TicketPreviewResponse)
async def upload_ticket(file: UploadFile = File(...)):
    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    try:
        from services.ocr import extract_ticket

        ocr_data = await extract_ticket(image_bytes, mime_type=file.content_type)
    except Exception as exc:
        print(f"[tickets] OCR failed preview: {exc}")
        traceback.print_exc()
        ocr_data = {
            "game_type": "4D",
            "draw_date": str(date.today()),
            "bet_type": "ORDINARY",
            "numbers": [],
            "raw_text": f"OCR failed: {exc}",
        }

    game_type, draw_date, bet_type, numbers, raw_text = _parse_ocr_data(ocr_data)
    _log_raw_ocr_text(raw_text, context="preview")
    return TicketPreviewResponse(
        game_type=game_type,
        draw_date=draw_date,
        bet_type=bet_type,
        numbers=numbers,
        raw_ocr_text=raw_text,
    )


@router.post("/confirm", response_model=TicketUploadResponse)
async def confirm_ticket(
    file: UploadFile = File(...),
    game_type: str = Form(...),
    draw_date: str = Form(...),
    numbers_json: str = Form(...),
    bet_type: str | None = Form(None),
    big_amount: str | None = Form(None),
    small_amount: str | None = Form(None),
    raw_ocr_text: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    gt = _parse_game_type(game_type)
    draw_date_value = _parse_draw_date(draw_date)

    try:
        parsed_numbers = json.loads(numbers_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="numbers_json must be valid JSON")

    numbers = _normalize_numbers(parsed_numbers)
    if not numbers:
        raise HTTPException(status_code=400, detail="At least one number set is required")

    ticket = Ticket(
        game_type=gt,
        draw_date=draw_date_value,
        status=TicketStatus.PENDING,
    )

    if gt == GameType.FOUR_D:
        number = _extract_single_4d_number(numbers)
        four_d_bet_type = _parse_4d_bet_type(bet_type)
        big = _parse_decimal(big_amount, default=Decimal("0.00"))
        small = _parse_decimal(small_amount, default=Decimal("0.00"))
        if big <= 0 and small <= 0:
            small = Decimal("1.00")
        ticket.total_price = big + small
        ticket.four_d_ticket = FourDTicket(
            number=number,
            bet_type=four_d_bet_type,
            big_amount=big,
            small_amount=small,
        )
    else:
        selected = _extract_single_toto_set(numbers)
        is_system, system_type = _parse_toto_mode(selected, bet_type)
        ticket.total_price = Decimal(str(len(list(combinations(sorted(selected), 6)))))
        ticket.toto_ticket = TotoTicket(is_system=is_system, system_type=system_type)
        ticket.toto_numbers = [TotoNumber(number=n) for n in selected]
        for combo in combinations(sorted(selected), 6):
            combo_str = ",".join(str(n) for n in combo)
            ticket.toto_expanded_combinations.append(TotoExpandedCombination(combination=combo_str))

    _log_raw_ocr_text(raw_ocr_text, context="confirm")
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    from services.checker import check_ticket
    from services.scheduler import schedule_poll

    if draw_date_value > date.today():
        schedule_poll(str(ticket.id), ticket.draw_date)
    else:
        await check_ticket(ticket, db)

    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.four_d_ticket),
            selectinload(Ticket.toto_ticket),
            selectinload(Ticket.toto_numbers),
        )
        .where(Ticket.id == ticket.id)
    )
    ticket_row = (await db.execute(stmt)).scalar_one()
    bet_label, number_strings = _ticket_display_data(ticket_row)

    return TicketUploadResponse(
        id=ticket_row.id,
        status=ticket_row.status,
        game_type=ticket_row.game_type,
        draw_date=ticket_row.draw_date,
        purchase_datetime=ticket_row.purchase_datetime,
        total_price=ticket_row.total_price,
        bet_label=bet_label,
        numbers=number_strings,
        raw_ocr_text=raw_ocr_text,
    )


@router.get("/", response_model=list[TicketListItem])
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

        bet_label, _ = _ticket_display_data(ticket)
        items.append(
            TicketListItem(
                id=ticket.id,
                game_type=ticket.game_type,
                draw_date=ticket.draw_date,
                purchase_datetime=ticket.purchase_datetime,
                total_price=ticket.total_price,
                status=ticket.status,
                bet_label=bet_label,
                is_winner=_winner_flag(ticket.status),
                prize_tier=_extract_prize_tier(ticket.notifications),
            )
        )

    if sort == "winning":
        items.sort(key=lambda x: (x.is_winner is not True, x.purchase_datetime), reverse=True)
    else:
        items.sort(key=lambda x: x.purchase_datetime, reverse=True)
    return items


@router.get("/{ticket_id}", response_model=TicketDetail)
async def get_ticket(ticket_id: str, db: AsyncSession = Depends(get_db)):
    ticket = await _load_ticket(ticket_id, db)
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

    bet_label, number_strings = _ticket_display_data(ticket)
    return TicketDetail(
        id=ticket.id,
        game_type=ticket.game_type,
        purchase_datetime=ticket.purchase_datetime,
        draw_date=ticket.draw_date,
        total_price=ticket.total_price,
        status=ticket.status,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        bet_label=bet_label,
        numbers=number_strings,
        four_d_ticket=ticket.four_d_ticket,
        toto_ticket=ticket.toto_ticket,
        toto_numbers=[n.number for n in sorted(ticket.toto_numbers, key=lambda row: row.number)],
        toto_expanded_combinations=[row.combination for row in ticket.toto_expanded_combinations],
        notifications=ticket.notifications,
    )


@router.delete("/{ticket_id}", status_code=204)
async def delete_ticket(ticket_id: str, db: AsyncSession = Depends(get_db)):
    ticket = await _load_ticket(ticket_id, db)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.delete(ticket)
    await db.commit()


async def _load_ticket(ticket_id: str, db: AsyncSession) -> Ticket | None:
    try:
        ticket_uuid = _parse_ticket_uuid(ticket_id)
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


def _parse_ticket_uuid(ticket_id: str):
    import uuid

    return uuid.UUID(ticket_id)


def _parse_ocr_data(ocr_data: dict[str, Any]) -> tuple[str, date, str, list[list[str]], str]:
    raw_game_type = str(ocr_data.get("game_type") or "4D").upper()
    game_type = "TOTO" if raw_game_type == "TOTO" else "4D"

    draw_date_raw = ocr_data.get("draw_date")
    try:
        draw_date = date.fromisoformat(str(draw_date_raw)) if draw_date_raw else date.today()
    except (TypeError, ValueError):
        draw_date = date.today()

    bet_type = str(ocr_data.get("bet_type") or "").strip() or "ORDINARY"
    numbers = _normalize_numbers(ocr_data.get("numbers"))
    raw_text = str(ocr_data.get("raw_text") or "")
    return game_type, draw_date, bet_type, numbers, raw_text


def _parse_game_type(value: str) -> GameType:
    token = value.strip().upper()
    if token == "4D":
        return GameType.FOUR_D
    if token == "TOTO":
        return GameType.TOTO
    raise HTTPException(status_code=400, detail="game_type must be '4D' or 'TOTO'")


def _parse_draw_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="draw_date must be YYYY-MM-DD")


def _normalize_numbers(raw_numbers: Any) -> list[list[str]]:
    normalized: list[list[str]] = []
    if not isinstance(raw_numbers, list):
        return normalized

    for row in raw_numbers:
        if not isinstance(row, list):
            continue
        clean_row = [str(v).strip() for v in row if str(v).strip()]
        if clean_row:
            normalized.append(clean_row)
    return normalized


def _extract_single_4d_number(numbers: list[list[str]]) -> str:
    tokens = []
    for row in numbers:
        for raw in row:
            token = raw.strip()
            if token.isdigit() and len(token) == 4:
                tokens.append(token)
    if not tokens:
        raise HTTPException(status_code=400, detail="4D ticket requires one 4-digit number")
    return tokens[0]


def _extract_single_toto_set(numbers: list[list[str]]) -> list[int]:
    if not numbers:
        raise HTTPException(status_code=400, detail="TOTO ticket requires one number set")
    first_row = numbers[0]
    selected: list[int] = []
    for raw in first_row:
        if not raw.strip().isdigit():
            continue
        value = int(raw)
        if 1 <= value <= 49:
            selected.append(value)
    dedup_sorted = sorted(set(selected))
    if len(dedup_sorted) < 6:
        raise HTTPException(status_code=400, detail="TOTO must include at least 6 unique numbers (1-49)")
    if len(dedup_sorted) > 12:
        raise HTTPException(status_code=400, detail="TOTO system bet supports up to 12 unique numbers")
    return dedup_sorted


def _parse_4d_bet_type(raw: str | None) -> FourDBetType:
    token = (raw or "").strip().upper().replace("-", "")
    if token == "IBET":
        return FourDBetType.IBET
    return FourDBetType.ORDINARY


def _parse_toto_mode(
    selected_numbers: list[int],
    raw_bet_type: str | None,
) -> tuple[bool, TotoSystemType | None]:
    explicit_system = _parse_system_type(raw_bet_type)
    if len(selected_numbers) == 6 and explicit_system is None:
        return False, None

    system_n = len(selected_numbers)
    inferred = _system_enum_from_n(system_n)
    system_type = explicit_system or inferred
    if not system_type:
        raise HTTPException(status_code=400, detail="System bet must have 7 to 12 unique numbers")

    if explicit_system is not None:
        explicit_n = int(explicit_system.value.split("_")[1])
        if explicit_n != system_n:
            raise HTTPException(
                status_code=400,
                detail=f"system_type {explicit_system.value} requires exactly {explicit_n} numbers",
            )
    return True, system_type


def _parse_system_type(raw: str | None) -> TotoSystemType | None:
    if not raw:
        return None

    token = raw.strip().upper().replace(" ", "").replace("-", "_")
    token = token.replace("SYSTEM", "SYSTEM_")
    token = re.sub(r"_+", "_", token)
    if token.endswith("_"):
        token = token[:-1]

    for value in TotoSystemType:
        if token == value.value:
            return value
    return None


def _system_enum_from_n(n: int) -> TotoSystemType | None:
    mapping = {
        7: TotoSystemType.SYSTEM_7,
        8: TotoSystemType.SYSTEM_8,
        9: TotoSystemType.SYSTEM_9,
        10: TotoSystemType.SYSTEM_10,
        11: TotoSystemType.SYSTEM_11,
        12: TotoSystemType.SYSTEM_12,
    }
    return mapping.get(n)


def _parse_decimal(raw: str | None, default: Decimal) -> Decimal:
    token = (raw or "").strip()
    if not token:
        return default
    try:
        value = Decimal(token)
    except InvalidOperation:
        raise HTTPException(status_code=400, detail=f"Invalid decimal value: {raw}")
    if value < 0:
        raise HTTPException(status_code=400, detail=f"Decimal value cannot be negative: {raw}")
    return value.quantize(Decimal("0.01"))


def _log_raw_ocr_text(raw_text: Any, context: str) -> None:
    if raw_text is None:
        print(f"[tickets] OCR raw text ({context}): <empty>")
        return
    text = str(raw_text).strip()
    if not text:
        print(f"[tickets] OCR raw text ({context}): <empty>")
        return
    if len(text) > RAW_LOG_MAX:
        print(f"[tickets] OCR raw text ({context}): {text[:RAW_LOG_MAX]}...[truncated]")
        return
    print(f"[tickets] OCR raw text ({context}): {text}")


def _winner_flag(status: TicketStatus) -> bool | None:
    if status == TicketStatus.WON:
        return True
    if status == TicketStatus.LOST:
        return False
    return None


def _extract_prize_tier(notifications: list[Notification]) -> str | None:
    for notification in sorted(notifications, key=lambda row: row.created_at, reverse=True):
        match = re.search(r"\(([^()]+)\)", notification.message)
        if match:
            return match.group(1)
    return None


def _ticket_display_data(ticket: Ticket) -> tuple[str | None, list[str]]:
    if ticket.game_type == GameType.FOUR_D and ticket.four_d_ticket:
        return ticket.four_d_ticket.bet_type.value, [ticket.four_d_ticket.number]

    if ticket.game_type == GameType.TOTO:
        numbers = [str(row.number) for row in sorted(ticket.toto_numbers, key=lambda n: n.number)]
        if ticket.toto_ticket and ticket.toto_ticket.is_system:
            label = ticket.toto_ticket.system_type.value if ticket.toto_ticket.system_type else "SYSTEM"
        else:
            label = "STANDARD"
        return label, numbers

    return None, []
