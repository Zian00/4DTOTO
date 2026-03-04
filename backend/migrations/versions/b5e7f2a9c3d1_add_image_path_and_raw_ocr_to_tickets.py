"""add image_path and raw_ocr_text to tickets

Revision ID: b5e7f2a9c3d1
Revises: f3b1c9e8a2d7
Create Date: 2026-03-04 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b5e7f2a9c3d1"
down_revision: Union[str, None] = "f3b1c9e8a2d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tickets", sa.Column("image_path", sa.String(500), nullable=True))
    op.add_column("tickets", sa.Column("raw_ocr_text", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tickets", "raw_ocr_text")
    op.drop_column("tickets", "image_path")
