"""add purchase_group_id

Revision ID: c1f2e6d9a4b1
Revises: 7ab9d4db0f3a
Create Date: 2026-03-03 22:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1f2e6d9a4b1"
down_revision: Union[str, None] = "7ab9d4db0f3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tickets", sa.Column("purchase_group_id", sa.UUID(), nullable=True))
    op.execute("UPDATE tickets SET purchase_group_id = id WHERE purchase_group_id IS NULL")
    op.alter_column("tickets", "purchase_group_id", nullable=False)
    op.create_index("ix_tickets_purchase_group_id", "tickets", ["purchase_group_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tickets_purchase_group_id", table_name="tickets")
    op.drop_column("tickets", "purchase_group_id")
