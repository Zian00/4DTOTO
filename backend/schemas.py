from pydantic import BaseModel
from uuid import UUID
from datetime import date, datetime
from typing import Any


# ---------- Ticket ----------

class TicketUploadResponse(BaseModel):
    id: UUID
    status: str
    game_type: str | None
    draw_date: date | None
    bet_type: str | None
    numbers: Any

    model_config = {"from_attributes": True}


class CombinationOut(BaseModel):
    id: UUID
    combination: str
    is_system_expanded: bool

    model_config = {"from_attributes": True}


class TicketResultOut(BaseModel):
    id: UUID
    combination_id: UUID | None
    is_winner: bool
    prize_tier: str | None
    notified: bool
    checked_at: datetime

    model_config = {"from_attributes": True}


class TicketListItem(BaseModel):
    id: UUID
    game_type: str
    draw_date: date
    purchase_date: datetime
    bet_type: str | None
    status: str
    image_path: str
    is_winner: bool | None = None
    prize_tier: str | None = None

    model_config = {"from_attributes": True}


class TicketDetail(BaseModel):
    id: UUID
    device_id: str
    image_path: str
    game_type: str
    draw_date: date
    purchase_date: datetime
    numbers: Any
    bet_type: str | None
    raw_ocr_text: str | None
    status: str
    created_at: datetime
    combinations: list[CombinationOut] = []
    results: list[TicketResultOut] = []

    model_config = {"from_attributes": True}


# ---------- Draw Results ----------

class DrawResultResponse(BaseModel):
    id: UUID
    game_type: str
    draw_date: date
    winning_numbers: dict
    scraped_at: datetime

    model_config = {"from_attributes": True}


class PaginatedResults(BaseModel):
    items: list[DrawResultResponse]
    total: int
    page: int
    limit: int


# ---------- Predictions ----------

class TotoPrediction(BaseModel):
    primary: list[int]
    supplementary: list[int]
    format: str


class PredictionResponse(BaseModel):
    model: str
    description: str
    four_d_prediction: str
    toto_prediction: TotoPrediction
    data_points: int
    disclaimer: str


# ---------- Errors ----------

class ErrorResponse(BaseModel):
    error: str
    detail: str
