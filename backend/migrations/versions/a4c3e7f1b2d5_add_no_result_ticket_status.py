"""add NO_RESULT ticket status

Revision ID: a4c3e7f1b2d5
Revises: f3b1c9e8a2d7
Create Date: 2026-03-05 00:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "a4c3e7f1b2d5"
down_revision = "f3b1c9e8a2d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL requires a separate ALTER TYPE statement to add enum values.
    # This must run outside of a transaction (execute() is fine for DDL here).
    op.execute("ALTER TYPE ticket_status_enum ADD VALUE IF NOT EXISTS 'NO_RESULT'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values natively.
    # To truly roll back you would need to recreate the type; we skip that here.
    pass
