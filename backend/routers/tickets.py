import json
import re
import traceback
import uuid
from datetime import date, datetime
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
from schemas import (
    TicketConfirmBatchResponse,
    TicketDetail,
    TicketListItem,
    TicketPreviewResponse,
)

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
RAW_LOG_MAX = 1200
MAX_CREATED_TICKETS = 300


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
    ) = _parse_ocr_data(ocr_data)
    _log_raw_ocr_text(raw_text, context="preview")
    return TicketPreviewResponse(
        game_type=game_type,
        draw_date=_format_date_ddmmyyyy(draw_date),
        draw_date_options=[_format_date_ddmmyyyy(d) for d in draw_date_options],
        draw_number=draw_number,
        draw_number_options=draw_number_options,
        purchase_datetime=_format_purchase_datetime_for_preview(purchase_datetime),
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

    gt = _parse_game_type(game_type)
    draw_dates = _parse_draw_dates(draw_dates_json, draw_date)
    draw_numbers = _parse_draw_numbers(draw_numbers_json, draw_number, draw_dates)
    purchase_group_id = uuid.uuid4()

    try:
        parsed_numbers = json.loads(numbers_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="numbers_json must be valid JSON")

    numbers = _normalize_numbers(parsed_numbers)
    if not numbers:
        raise HTTPException(status_code=400, detail="At least one number set is required")

    purchase_dt = _parse_purchase_datetime(purchase_datetime)
    created_tickets: list[Ticket] = []

    if gt == GameType.FOUR_D:
        four_d_numbers = _extract_4d_numbers(numbers)
        if len(draw_dates) * len(four_d_numbers) > MAX_CREATED_TICKETS:
            raise HTTPException(
                status_code=400,
                detail=f"Too many ticket entries generated. Max {MAX_CREATED_TICKETS}.",
            )

        four_d_bet_type = _parse_4d_bet_type(bet_type)
        big = _parse_decimal(big_amount, default=Decimal("0.00"))
        small = _parse_decimal(small_amount, default=Decimal("0.00"))
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
        toto_sets = _extract_toto_sets(numbers)
        if len(draw_dates) * len(toto_sets) > MAX_CREATED_TICKETS:
            raise HTTPException(
                status_code=400,
                detail=f"Too many ticket entries generated. Max {MAX_CREATED_TICKETS}.",
            )

        for idx, d in enumerate(draw_dates):
            draw_no = draw_numbers[idx] if idx < len(draw_numbers) else None
            for selected in toto_sets:
                is_system, system_type = _parse_toto_mode(selected, bet_type)
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

    _log_raw_ocr_text(raw_ocr_text, context="confirm")
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

        bet_label, _ = _ticket_display_data(ticket)
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
    stmt = select(Ticket).where(Ticket.purchase_group_id == ticket.purchase_group_id)
    group_rows = (await db.execute(stmt)).scalars().all()
    for row in group_rows:
        await db.delete(row)
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


def _parse_ocr_data(
    ocr_data: dict[str, Any],
) -> tuple[
    str,
    date,
    list[date],
    str | None,
    list[str],
    datetime | None,
    str,
    list[list[str]],
    str,
    str | None,
    str | None,
    str | None,
]:
    raw_game_type = str(ocr_data.get("game_type") or "4D").upper()
    game_type = "TOTO" if raw_game_type == "TOTO" else "4D"

    draw_date_token = str(ocr_data.get("draw_date") or date.today().isoformat())
    try:
        draw_date = _parse_draw_date(draw_date_token)
    except HTTPException:
        draw_date = date.today()

    draw_date_options = _parse_draw_date_options(ocr_data.get("draw_dates"))
    if draw_date not in draw_date_options:
        draw_date_options.insert(0, draw_date)
    draw_number = _normalize_draw_number_token(ocr_data.get("draw_number"))
    draw_number_options = _parse_draw_number_options(ocr_data.get("draw_numbers"))
    if draw_number and draw_number not in draw_number_options:
        draw_number_options.insert(0, draw_number)
    if not draw_number and draw_number_options:
        draw_number = draw_number_options[0]
    try:
        purchase_datetime = _parse_purchase_datetime(
            str(ocr_data.get("purchase_datetime") or "").strip() or None
        )
    except HTTPException:
        purchase_datetime = None

    bet_type_raw = str(ocr_data.get("bet_type") or "").strip()
    if bet_type_raw:
        bet_type = bet_type_raw
    else:
        bet_type = "STANDARD" if game_type == "TOTO" else "ORDINARY"
    numbers = _normalize_numbers(ocr_data.get("numbers"))
    raw_text = str(ocr_data.get("raw_text") or "")
    big_amount = _normalize_amount_for_preview(ocr_data.get("big_amount"))
    small_amount = _normalize_amount_for_preview(ocr_data.get("small_amount"))
    total_price = _normalize_amount_for_preview(ocr_data.get("total_price"))
    return (
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
    )


def _parse_game_type(value: str) -> GameType:
    token = value.strip().upper()
    if token == "4D":
        return GameType.FOUR_D
    if token == "TOTO":
        return GameType.TOTO
    raise HTTPException(status_code=400, detail="game_type must be '4D' or 'TOTO'")


def _parse_draw_date(value: str) -> date:
    token = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(token, fmt).date()
        except ValueError:
            continue
    raise HTTPException(status_code=400, detail="draw_date must be DD/MM/YYYY")


def _parse_draw_dates(draw_dates_json: str | None, draw_date: str | None) -> list[date]:
    tokens: list[str] = []
    if draw_dates_json:
        try:
            parsed = json.loads(draw_dates_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="draw_dates_json must be valid JSON")
        if isinstance(parsed, list):
            tokens.extend(str(v).strip() for v in parsed if str(v).strip())
        elif isinstance(parsed, str) and parsed.strip():
            tokens.append(parsed.strip())
        else:
            raise HTTPException(status_code=400, detail="draw_dates_json must be an array of dates")

    if draw_date and draw_date.strip():
        tokens.append(draw_date.strip())

    if not tokens:
        raise HTTPException(status_code=400, detail="At least one draw date is required")

    out: list[date] = []
    for token in tokens:
        parsed = _parse_draw_date(token)
        if parsed not in out:
            out.append(parsed)
    return out


def _parse_draw_date_options(raw: Any) -> list[date]:
    if not isinstance(raw, list):
        return []
    out: list[date] = []
    for item in raw:
        token = str(item).strip()
        if not token:
            continue
        try:
            parsed = _parse_draw_date(token)
        except HTTPException:
            continue
        if parsed not in out:
            out.append(parsed)
    return out


def _parse_draw_number_options(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        normalized = _normalize_draw_number_token(item)
        if normalized and normalized not in out:
            out.append(normalized)
    return out


def _parse_draw_numbers(
    draw_numbers_json: str | None,
    draw_number: str | None,
    draw_dates: list[date],
) -> list[str | None]:
    tokens: list[str] = []
    if draw_numbers_json:
        try:
            parsed = json.loads(draw_numbers_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="draw_numbers_json must be valid JSON")
        if isinstance(parsed, list):
            tokens.extend(str(v).strip() for v in parsed if str(v).strip())
        elif isinstance(parsed, str) and parsed.strip():
            tokens.append(parsed.strip())
        else:
            raise HTTPException(
                status_code=400,
                detail="draw_numbers_json must be an array of draw numbers",
            )

    if draw_number and draw_number.strip():
        tokens.append(draw_number.strip())

    normalized: list[str] = []
    for token in tokens:
        normalized_token = _normalize_draw_number_token(token)
        if normalized_token:
            normalized.append(normalized_token)

    if not normalized:
        return [None] * len(draw_dates)

    if len(normalized) > len(draw_dates):
        raise HTTPException(
            status_code=400,
            detail="draw numbers cannot exceed draw dates count",
        )

    if len(normalized) == 1 and len(draw_dates) > 1:
        return [normalized[0]] * len(draw_dates)

    if len(normalized) < len(draw_dates):
        return normalized + [None] * (len(draw_dates) - len(normalized))

    return normalized


def _normalize_draw_number_token(raw: Any) -> str | None:
    if raw is None:
        return None
    token = str(raw).strip()
    if not token:
        return None
    match = re.search(r"(\d{3,6})(?:/\d{2,4})?", token)
    if not match:
        return None
    return match.group(1)


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


def _extract_4d_numbers(numbers: list[list[str]]) -> list[str]:
    tokens: list[str] = []
    for row in numbers:
        for raw in row:
            token = raw.strip()
            if token.isdigit() and len(token) == 4:
                if token not in tokens:
                    tokens.append(token)
    if not tokens:
        raise HTTPException(status_code=400, detail="At least one valid 4-digit number is required")
    return tokens


def _extract_toto_sets(numbers: list[list[str]]) -> list[list[int]]:
    if not numbers:
        raise HTTPException(status_code=400, detail="TOTO requires at least one number set")

    sets: list[list[int]] = []
    for idx, row in enumerate(numbers, start=1):
        selected: list[int] = []
        for raw in row:
            token = raw.strip()
            if not token.isdigit():
                continue
            value = int(token)
            if 1 <= value <= 49:
                selected.append(value)

        dedup_sorted = sorted(set(selected))
        if len(dedup_sorted) < 6:
            raise HTTPException(
                status_code=400,
                detail=f"TOTO row {idx} must include at least 6 unique numbers (1-49)",
            )
        if len(dedup_sorted) > 12:
            raise HTTPException(
                status_code=400,
                detail=f"TOTO row {idx} supports at most 12 unique numbers",
            )
        sets.append(dedup_sorted)

    if not sets:
        raise HTTPException(status_code=400, detail="No valid TOTO number set found")
    return sets


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


def _parse_purchase_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    token = value.strip()
    if not token:
        return None

    formats = (
        "%d/%m/%Y %I:%M %p",
        "%d/%m/%Y %H:%M",
        "%d/%m/%y %I:%M %p",
        "%d/%m/%y %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
    )
    for fmt in formats:
        try:
            return datetime.strptime(token, fmt)
        except ValueError:
            continue
    raise HTTPException(
        status_code=400,
        detail="purchase_datetime must be DD/MM/YYYY HH:MM AM/PM",
    )


def _normalize_amount_for_preview(raw: Any) -> str | None:
    if raw is None:
        return None
    token = str(raw).strip()
    if not token:
        return None
    try:
        return f"{Decimal(token).quantize(Decimal('0.01'))}"
    except (InvalidOperation, ValueError):
        return None


def _format_date_ddmmyyyy(value: date) -> str:
    return value.strftime("%d/%m/%Y")


def _format_purchase_datetime_for_preview(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%d/%m/%Y %I:%M %p")


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
