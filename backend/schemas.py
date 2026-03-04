from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from models import FourDBetType, GameType, TicketStatus, TotoSystemType


class TicketPreviewResponse(BaseModel):
    game_type: str | None
    draw_date: str | None
    draw_date_options: list[str] = Field(default_factory=list)
    draw_number: str | None = None
    draw_number_options: list[str] = Field(default_factory=list)
    purchase_datetime: str | None = None
    bet_type: str | None
    numbers: Any
    big_amount: str | None = None
    small_amount: str | None = None
    total_price: str | None = None
    raw_ocr_text: str | None = None


class TicketUploadResponse(BaseModel):
    id: UUID
    purchase_group_id: UUID
    status: TicketStatus
    game_type: GameType
    draw_date: date
    draw_number: str | None = None
    purchase_datetime: datetime
    total_price: Decimal
    bet_label: str | None
    numbers: list[str]
    raw_ocr_text: str | None = None

    model_config = {"from_attributes": True}


class TicketConfirmBatchResponse(BaseModel):
    purchase_group_id: UUID
    created_count: int
    ticket_ids: list[UUID] = Field(default_factory=list)
    pending_count: int = 0
    won_count: int = 0
    lost_count: int = 0
    message: str


class TicketListItem(BaseModel):
    id: UUID
    purchase_group_id: UUID
    game_type: GameType
    draw_date: date
    draw_number: str | None = None
    purchase_datetime: datetime
    total_price: Decimal
    status: TicketStatus
    bet_label: str | None = None
    is_winner: bool | None = None
    prize_tier: str | None = None
    image_url: str | None = None

    model_config = {"from_attributes": True}


class FourDTicketOut(BaseModel):
    number: str
    bet_type: FourDBetType
    big_amount: Decimal
    small_amount: Decimal

    model_config = {"from_attributes": True}


class TotoTicketOut(BaseModel):
    is_system: bool
    system_type: TotoSystemType | None

    model_config = {"from_attributes": True}


class NotificationOut(BaseModel):
    id: UUID
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketDetail(BaseModel):
    id: UUID
    purchase_group_id: UUID
    game_type: GameType
    purchase_datetime: datetime
    draw_date: date
    draw_number: str | None = None
    total_price: Decimal
    status: TicketStatus
    created_at: datetime
    updated_at: datetime
    bet_label: str | None = None
    prize_tier: str | None = None
    numbers: list[str] = Field(default_factory=list)
    four_d_ticket: FourDTicketOut | None = None
    toto_ticket: TotoTicketOut | None = None
    toto_numbers: list[int] = Field(default_factory=list)
    toto_expanded_combinations: list[str] = Field(default_factory=list)
    notifications: list[NotificationOut] = Field(default_factory=list)
    image_url: str | None = None
    raw_ocr_text: str | None = None

    model_config = {"from_attributes": True}


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


class ErrorResponse(BaseModel):
    error: str
    detail: str
