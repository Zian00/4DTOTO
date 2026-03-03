import os
import uuid
from datetime import date

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, get_db
from models import Ticket, TicketCombination, TicketResult
from schemas import CombinationOut, TicketDetail, TicketListItem, TicketResultOut, TicketUploadResponse

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=TicketUploadResponse)
async def upload_ticket(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    device_id: str = Header(..., alias="X-Device-ID"),
    db: AsyncSession = Depends(get_db),
):
    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(image_bytes)

    # Create ticket with placeholder values (OCR fills them in)
    ticket = Ticket(
        device_id=device_id,
        image_path=file_path,
        game_type="4D",
        draw_date=date.today(),
        numbers={},
        status="pending",
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    background_tasks.add_task(_process_ticket, str(ticket.id), image_bytes)

    return TicketUploadResponse(
        id=ticket.id,
        status=ticket.status,
        game_type=ticket.game_type,
        draw_date=ticket.draw_date,
        bet_type=ticket.bet_type,
        numbers=ticket.numbers,
    )


async def _process_ticket(ticket_id: str, image_bytes: bytes) -> None:
    """Background task: OCR → update ticket → create combinations → check/schedule."""
    async with AsyncSessionLocal() as db:
        ticket = await db.get(Ticket, uuid.UUID(ticket_id))
        if not ticket:
            return

        # Run OCR
        try:
            from services.ocr import extract_ticket
            ocr_data = await extract_ticket(image_bytes)
        except Exception as exc:
            print(f"[tickets] OCR failed {ticket_id}: {exc}")
            ticket.status = "ocr_failed"
            ticket.raw_ocr_text = str(exc)
            await db.commit()
            return

        game_type = (ocr_data.get("game_type") or "4D").upper()
        draw_date_str = ocr_data.get("draw_date")
        bet_type = ocr_data.get("bet_type") or "Standard"
        numbers = ocr_data.get("numbers") or []
        raw_text = ocr_data.get("raw_text") or ""

        try:
            draw_date = date.fromisoformat(draw_date_str) if draw_date_str else date.today()
        except (ValueError, TypeError):
            draw_date = date.today()

        ticket.game_type = game_type
        ticket.draw_date = draw_date
        ticket.bet_type = bet_type
        ticket.numbers = numbers
        ticket.raw_ocr_text = raw_text
        ticket.status = "processing"
        await db.commit()

        _store_combinations(ticket, numbers, game_type, bet_type, db)
        await db.commit()

        # Past draw → check immediately; future draw → schedule polling
        from services.checker import check_ticket
        from services.scheduler import schedule_poll

        if draw_date > date.today():
            schedule_poll(str(ticket.id), draw_date)
        else:
            await check_ticket(ticket, db)


def _store_combinations(
    ticket: Ticket,
    numbers: list,
    game_type: str,
    bet_type: str,
    db,
) -> None:
    if game_type == "4D":
        for number_set in numbers:
            if isinstance(number_set, list) and number_set:
                combo = str(number_set[0]).strip().zfill(4)
                if combo.isdigit() and len(combo) == 4:
                    db.add(TicketCombination(ticket_id=ticket.id, combination=combo))
    elif game_type == "TOTO":
        for number_set in numbers:
            if not isinstance(number_set, list) or not number_set:
                continue
            raw = [str(n) for n in number_set]
            if bet_type and bet_type.startswith("System"):
                from services.toto_system import expand_system_bet, get_system_n
                system_n = get_system_n(bet_type)
                if system_n and len(raw) >= 6:
                    for combo_tuple in expand_system_bet(raw, system_n):
                        combo_str = ",".join(
                            str(n) for n in sorted(int(x) for x in combo_tuple)
                        )
                        db.add(TicketCombination(
                            ticket_id=ticket.id,
                            combination=combo_str,
                            is_system_expanded=True,
                        ))
            else:
                combo_str = ",".join(str(int(n)) for n in raw)
                db.add(TicketCombination(ticket_id=ticket.id, combination=combo_str))


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[TicketListItem])
async def list_tickets(
    device_id: str,
    sort: str = "newest",
    filter: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Ticket).where(Ticket.device_id == device_id)
    tickets = (await db.execute(stmt)).scalars().all()

    if not tickets:
        return []

    # Fetch all winning results for these tickets in one query
    ticket_ids = [t.id for t in tickets]
    winners_stmt = (
        select(TicketResult)
        .where(TicketResult.ticket_id.in_(ticket_ids))
        .where(TicketResult.is_winner == True)  # noqa: E712
    )
    winner_rows = (await db.execute(winners_stmt)).scalars().all()
    winner_map: dict[uuid.UUID, TicketResult] = {}
    for r in winner_rows:
        if r.ticket_id not in winner_map:
            winner_map[r.ticket_id] = r

    items: list[TicketListItem] = []
    for t in tickets:
        if filter == "4D" and t.game_type != "4D":
            continue
        if filter == "TOTO" and t.game_type != "TOTO":
            continue
        if filter == "system" and (not t.bet_type or not t.bet_type.startswith("System")):
            continue

        winner = winner_map.get(t.id)

        if filter == "winning" and winner is None:
            continue

        items.append(TicketListItem(
            id=t.id,
            game_type=t.game_type,
            draw_date=t.draw_date,
            purchase_date=t.purchase_date,
            bet_type=t.bet_type,
            status=t.status,
            image_path=t.image_path,
            is_winner=(winner is not None) if t.status == "checked" else None,
            prize_tier=winner.prize_tier if winner else None,
        ))

    if sort == "winning":
        items.sort(key=lambda x: (x.is_winner is not True, x.purchase_date), reverse=True)
    else:
        items.sort(key=lambda x: x.purchase_date, reverse=True)

    return items


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{ticket_id}", response_model=TicketDetail)
async def get_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        tid = uuid.UUID(ticket_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ticket ID")

    ticket = await db.get(Ticket, tid)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    combos_stmt = select(TicketCombination).where(TicketCombination.ticket_id == tid)
    combos = (await db.execute(combos_stmt)).scalars().all()

    results_stmt = select(TicketResult).where(TicketResult.ticket_id == tid)
    results = (await db.execute(results_stmt)).scalars().all()

    # Acknowledge results — mark as notified so toasts don't repeat
    needs_commit = False
    for r in results:
        if not r.notified:
            r.notified = True
            needs_commit = True
    if needs_commit:
        await db.commit()

    return TicketDetail(
        id=ticket.id,
        device_id=ticket.device_id,
        image_path=ticket.image_path,
        game_type=ticket.game_type,
        draw_date=ticket.draw_date,
        purchase_date=ticket.purchase_date,
        numbers=ticket.numbers,
        bet_type=ticket.bet_type,
        raw_ocr_text=ticket.raw_ocr_text,
        status=ticket.status,
        created_at=ticket.created_at,
        combinations=[CombinationOut.model_validate(c) for c in combos],
        results=[TicketResultOut.model_validate(r) for r in results],
    )


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{ticket_id}", status_code=204)
async def delete_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        tid = uuid.UUID(ticket_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ticket ID")

    ticket = await db.get(Ticket, tid)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    try:
        if os.path.exists(ticket.image_path):
            os.remove(ticket.image_path)
    except OSError:
        pass

    await db.delete(ticket)
    await db.commit()
