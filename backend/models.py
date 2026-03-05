import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class GameType(str, enum.Enum):
    FOUR_D = "4D"
    TOTO = "TOTO"


class TicketStatus(str, enum.Enum):
    PENDING = "PENDING"
    WON = "WON"
    LOST = "LOST"
    NO_RESULT = "NO_RESULT"


class FourDBetType(str, enum.Enum):
    ORDINARY = "ORDINARY"
    IBET = "IBET"


class TotoSystemType(str, enum.Enum):
    SYSTEM_7 = "SYSTEM_7"
    SYSTEM_8 = "SYSTEM_8"
    SYSTEM_9 = "SYSTEM_9"
    SYSTEM_10 = "SYSTEM_10"
    SYSTEM_11 = "SYSTEM_11"
    SYSTEM_12 = "SYSTEM_12"


def _enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [str(member.value) for member in enum_cls]


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        Index("ix_tickets_draw_date", "draw_date"),
        Index("ix_tickets_status", "status"),
        Index("ix_tickets_purchase_group_id", "purchase_group_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    game_type: Mapped[GameType] = mapped_column(
        Enum(
            GameType,
            name="game_type_enum",
            native_enum=True,
            values_callable=_enum_values,
        ),
        nullable=False,
    )
    purchase_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    draw_date: Mapped[date] = mapped_column(Date, nullable=False)
    draw_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        server_default="0",
    )
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status_enum", native_enum=True),
        nullable=False,
        server_default=TicketStatus.PENDING.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    four_d_ticket: Mapped["FourDTicket"] = relationship(
        back_populates="ticket",
        uselist=False,
        cascade="all, delete-orphan",
    )
    toto_ticket: Mapped["TotoTicket"] = relationship(
        back_populates="ticket",
        uselist=False,
        cascade="all, delete-orphan",
    )
    toto_numbers: Mapped[list["TotoNumber"]] = relationship(
        back_populates="ticket",
        cascade="all, delete-orphan",
    )
    toto_expanded_combinations: Mapped[list["TotoExpandedCombination"]] = relationship(
        back_populates="ticket",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="ticket",
        cascade="all, delete-orphan",
    )


class FourDTicket(Base):
    __tablename__ = "four_d_tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    number: Mapped[str] = mapped_column(String(4), nullable=False)
    bet_type: Mapped[FourDBetType] = mapped_column(
        Enum(FourDBetType, name="four_d_bet_type_enum", native_enum=True),
        nullable=False,
    )
    big_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    small_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")

    ticket: Mapped["Ticket"] = relationship(back_populates="four_d_ticket")


class TotoTicket(Base):
    __tablename__ = "toto_tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    system_type: Mapped[TotoSystemType | None] = mapped_column(
        Enum(TotoSystemType, name="toto_system_type_enum", native_enum=True),
        nullable=True,
    )

    ticket: Mapped["Ticket"] = relationship(back_populates="toto_ticket")


class TotoNumber(Base):
    __tablename__ = "toto_numbers"
    __table_args__ = (
        CheckConstraint("number >= 1 AND number <= 49", name="ck_toto_numbers_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)

    ticket: Mapped["Ticket"] = relationship(back_populates="toto_numbers")


class TotoExpandedCombination(Base):
    __tablename__ = "toto_expanded_combinations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    combination: Mapped[str] = mapped_column(String(64), nullable=False)

    ticket: Mapped["Ticket"] = relationship(back_populates="toto_expanded_combinations")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    ticket: Mapped["Ticket"] = relationship(back_populates="notifications")


class DrawResult(Base):
    __tablename__ = "draw_results"
    __table_args__ = (UniqueConstraint("game_type", "draw_date", name="uq_game_draw"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    game_type: Mapped[str] = mapped_column(String(10), nullable=False)
    draw_date: Mapped[date] = mapped_column(Date, nullable=False)
    winning_numbers: Mapped[dict] = mapped_column(JSONB, nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
