from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from dotenv import load_dotenv
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.scheduler import start_scheduler
    start_scheduler()
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
