import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from dotenv import load_dotenv
load_dotenv()

# Minimum cached draws before startup auto-seed is skipped
_SEED_THRESHOLDS = {"4D": 50, "TOTO": 30}


async def _auto_seed_historical() -> None:
    """
    Background task: import all available historical draw results if the DB
    doesn't yet have enough data. Safe to run concurrently with serving traffic.
    Already-cached draws are skipped; idempotent if re-run.
    """
    from database import AsyncSessionLocal
    from models import DrawResult
    from services.scraper import scrape_all_historical
    from sqlalchemy import func, select

    async with AsyncSessionLocal() as db:
        for gt, threshold in _SEED_THRESHOLDS.items():
            count_stmt = (
                select(func.count())
                .select_from(DrawResult)
                .where(DrawResult.game_type == gt)
            )
            count = (await db.execute(count_stmt)).scalar() or 0
            if count >= threshold:
                print(f"[startup] {gt}: {count} draws cached — skipping bulk seed")
                continue
            print(f"[startup] {gt}: only {count} draws — starting historical import…")
            try:
                new = await scrape_all_historical(gt, db)
                print(f"[startup] {gt}: bulk seed complete — {new} new draws cached")
            except Exception as exc:
                print(f"[startup] {gt}: bulk seed failed: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.scheduler import start_scheduler
    start_scheduler()
    asyncio.create_task(_auto_seed_historical())
    yield


app = FastAPI(title="4D/TOTO API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

from routers import tickets, results, predictions

app.include_router(tickets.router, prefix="/api/tickets", tags=["tickets"])
app.include_router(results.router, prefix="/api/results", tags=["results"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["predictions"])


@app.get("/health")
async def health():
    return {"status": "ok"}
