"""add draw_number to tickets

Revision ID: f3b1c9e8a2d7
Revises: c1f2e6d9a4b1
Create Date: 2026-03-03 23:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f3b1c9e8a2d7"
down_revision: Union[str, None] = "c1f2e6d9a4b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tickets", sa.Column("draw_number", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("tickets", "draw_number")
