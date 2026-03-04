from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, get_db
from models import DrawResult
from schemas import DrawResultResponse, PaginatedResults
from services.scraper import scrape_all_historical, scrape_latest, scrape_results

router = APIRouter()

_SEED_THRESHOLD = 3  # scrape fresh data if fewer than this many draws are cached


# ── List (paginated) ──────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResults)
async def list_results(
    game_type: str | None = None,
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    game_types = [game_type.upper()] if game_type else ["4D", "TOTO"]

    # Seed DB if sparse — scrape latest draw for each game type
    for gt in game_types:
        count_stmt = (
            select(func.count())
            .select_from(DrawResult)
            .where(DrawResult.game_type == gt)
        )
        count = (await db.execute(count_stmt)).scalar() or 0
        if count < _SEED_THRESHOLD:
            try:
                await scrape_latest(gt, db)
            except Exception as exc:
                print(f"[results] seed scrape failed for {gt}: {exc}")

    # Query from DB
    stmt = select(DrawResult)
    if game_type:
        stmt = stmt.where(DrawResult.game_type == game_type.upper())
    stmt = stmt.order_by(DrawResult.draw_date.desc())

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar() or 0

    stmt = stmt.offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()

    return PaginatedResults(
        items=list(rows),
        total=total,
        page=page,
        limit=limit,
    )


# ── Bulk historical seed ──────────────────────────────────────────────────────

@router.post("/seed")
async def seed_historical_results(background_tasks: BackgroundTasks):
    """
    Trigger a full historical import for both 4D and TOTO draw results.
    Runs in the background — returns immediately.
    Already-cached draws are skipped automatically.
    """
    async def _run():
        async with AsyncSessionLocal() as db:
            for gt in ("4D", "TOTO"):
                try:
                    count = await scrape_all_historical(gt, db)
                    print(f"[seed] {gt}: {count} new draws cached")
                except Exception as exc:
                    print(f"[seed] {gt} failed: {exc}")

    background_tasks.add_task(_run)
    return {"message": "Historical seed started in background"}


# ── Specific draw ─────────────────────────────────────────────────────────────

@router.get("/{game_type}/{draw_date}", response_model=DrawResultResponse)
async def get_result(
    game_type: str,
    draw_date: str,
    db: AsyncSession = Depends(get_db),
):
    gt = game_type.upper()
    if gt not in ("4D", "TOTO"):
        raise HTTPException(status_code=400, detail="game_type must be '4D' or 'TOTO'")

    try:
        d = date.fromisoformat(draw_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format — use YYYY-MM-DD")

    # scrape_results handles DB caching internally
    await scrape_results(gt, draw_date, db)

    stmt = select(DrawResult).where(
        DrawResult.game_type == gt,
        DrawResult.draw_date == d,
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Draw result not found")

    return row
