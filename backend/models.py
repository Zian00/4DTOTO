import uuid
from datetime import datetime, date
from sqlalchemy import String, Boolean, Text, DateTime, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[str] = mapped_column(String(64), nullable=False)
    image_path: Mapped[str] = mapped_column(Text, nullable=False)
    game_type: Mapped[str] = mapped_column(String(10), nullable=False)
    draw_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    numbers: Mapped[dict] = mapped_column(JSONB, nullable=False)
    bet_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    raw_ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    combinations: Mapped[list["TicketCombination"]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan"
    )
    results: Mapped[list["TicketResult"]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan"
    )


class TicketCombination(Base):
    __tablename__ = "ticket_combinations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    combination: Mapped[str] = mapped_column(String(30), nullable=False)
    is_system_expanded: Mapped[bool] = mapped_column(Boolean, default=False)

    ticket: Mapped["Ticket"] = relationship(back_populates="combinations")


class DrawResult(Base):
    __tablename__ = "draw_results"
    __table_args__ = (UniqueConstraint("game_type", "draw_date", name="uq_game_draw"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    game_type: Mapped[str] = mapped_column(String(10), nullable=False)
    draw_date: Mapped[date] = mapped_column(Date, nullable=False)
    winning_numbers: Mapped[dict] = mapped_column(JSONB, nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TicketResult(Base):
    __tablename__ = "ticket_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    combination_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ticket_combinations.id"), nullable=True
    )
    is_winner: Mapped[bool] = mapped_column(Boolean, default=False)
    prize_tier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notified: Mapped[bool] = mapped_column(Boolean, default=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ticket: Mapped["Ticket"] = relationship(back_populates="results")
