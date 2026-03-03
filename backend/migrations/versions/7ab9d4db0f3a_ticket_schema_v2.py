"""ticket schema v2

Revision ID: 7ab9d4db0f3a
Revises: 4224110d1703
Create Date: 2026-03-03 20:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "7ab9d4db0f3a"
down_revision: Union[str, None] = "4224110d1703"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    op.drop_table("ticket_results")
    op.drop_table("ticket_combinations")
    op.drop_table("tickets")

    game_type_enum = postgresql.ENUM("4D", "TOTO", name="game_type_enum")
    ticket_status_enum = postgresql.ENUM("PENDING", "WON", "LOST", name="ticket_status_enum")
    four_d_bet_type_enum = postgresql.ENUM("ORDINARY", "IBET", name="four_d_bet_type_enum")
    toto_system_type_enum = postgresql.ENUM(
        "SYSTEM_7",
        "SYSTEM_8",
        "SYSTEM_9",
        "SYSTEM_10",
        "SYSTEM_11",
        "SYSTEM_12",
        name="toto_system_type_enum",
    )

    game_type_enum.create(bind, checkfirst=True)
    ticket_status_enum.create(bind, checkfirst=True)
    four_d_bet_type_enum.create(bind, checkfirst=True)
    toto_system_type_enum.create(bind, checkfirst=True)

    game_type_col_enum = postgresql.ENUM("4D", "TOTO", name="game_type_enum", create_type=False)
    ticket_status_col_enum = postgresql.ENUM("PENDING", "WON", "LOST", name="ticket_status_enum", create_type=False)
    four_d_bet_col_enum = postgresql.ENUM("ORDINARY", "IBET", name="four_d_bet_type_enum", create_type=False)
    toto_system_col_enum = postgresql.ENUM(
        "SYSTEM_7",
        "SYSTEM_8",
        "SYSTEM_9",
        "SYSTEM_10",
        "SYSTEM_11",
        "SYSTEM_12",
        name="toto_system_type_enum",
        create_type=False,
    )

    op.create_table(
        "tickets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("game_type", game_type_col_enum, nullable=False),
        sa.Column("purchase_datetime", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("draw_date", sa.Date(), nullable=False),
        sa.Column("total_price", sa.Numeric(12, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("status", ticket_status_col_enum, server_default=sa.text("'PENDING'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tickets_draw_date", "tickets", ["draw_date"], unique=False)
    op.create_index("ix_tickets_status", "tickets", ["status"], unique=False)

    op.create_table(
        "four_d_tickets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("number", sa.String(length=4), nullable=False),
        sa.Column("bet_type", four_d_bet_col_enum, nullable=False),
        sa.Column("big_amount", sa.Numeric(12, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("small_amount", sa.Numeric(12, 2), server_default=sa.text("0"), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticket_id"),
    )

    op.create_table(
        "toto_tickets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("is_system", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("system_type", toto_system_col_enum, nullable=True),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticket_id"),
    )

    op.create_table(
        "toto_numbers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.CheckConstraint("number >= 1 AND number <= 49", name="ck_toto_numbers_range"),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "toto_expanded_combinations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("combination", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_table("notifications")
    op.drop_table("toto_expanded_combinations")
    op.drop_table("toto_numbers")
    op.drop_table("toto_tickets")
    op.drop_table("four_d_tickets")
    op.drop_index("ix_tickets_status", table_name="tickets")
    op.drop_index("ix_tickets_draw_date", table_name="tickets")
    op.drop_table("tickets")

    toto_system_type_enum = postgresql.ENUM(
        "SYSTEM_7",
        "SYSTEM_8",
        "SYSTEM_9",
        "SYSTEM_10",
        "SYSTEM_11",
        "SYSTEM_12",
        name="toto_system_type_enum",
    )
    four_d_bet_type_enum = postgresql.ENUM("ORDINARY", "IBET", name="four_d_bet_type_enum")
    ticket_status_enum = postgresql.ENUM("PENDING", "WON", "LOST", name="ticket_status_enum")
    game_type_enum = postgresql.ENUM("4D", "TOTO", name="game_type_enum")

    toto_system_type_enum.drop(bind, checkfirst=True)
    four_d_bet_type_enum.drop(bind, checkfirst=True)
    ticket_status_enum.drop(bind, checkfirst=True)
    game_type_enum.drop(bind, checkfirst=True)

    op.create_table(
        "tickets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("device_id", sa.String(length=64), nullable=False),
        sa.Column("image_path", sa.Text(), nullable=False),
        sa.Column("game_type", sa.String(length=10), nullable=False),
        sa.Column("draw_date", sa.Date(), nullable=False),
        sa.Column("purchase_date", sa.DateTime(), nullable=False),
        sa.Column("numbers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("bet_type", sa.String(length=20), nullable=True),
        sa.Column("raw_ocr_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "ticket_combinations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("combination", sa.String(length=30), nullable=False),
        sa.Column("is_system_expanded", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "ticket_results",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("combination_id", sa.UUID(), nullable=True),
        sa.Column("is_winner", sa.Boolean(), nullable=False),
        sa.Column("prize_tier", sa.String(length=50), nullable=True),
        sa.Column("notified", sa.Boolean(), nullable=False),
        sa.Column("checked_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["combination_id"], ["ticket_combinations.id"]),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
