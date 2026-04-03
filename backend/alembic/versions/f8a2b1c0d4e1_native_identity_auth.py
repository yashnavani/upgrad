"""Native identity: hashed_password, nullable supabase_id

Revision ID: f8a2b1c0d4e1
Revises: cc089fc9d3b9
Create Date: 2026-03-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f8a2b1c0d4e1"
down_revision: Union[str, Sequence[str], None] = "cc089fc9d3b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
    )
    op.alter_column(
        "user",
        "supabase_id",
        existing_type=sa.String(length=255),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "user",
        "supabase_id",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.drop_column("user", "hashed_password")
