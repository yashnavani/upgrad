"""interviewsession: default max_turns 6

Revision ID: g0h1i2j3k4l5
Revises: f9a0b1c2d3e4
Create Date: 2026-04-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "g0h1i2j3k4l5"
down_revision: Union[str, Sequence[str], None] = "f9a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "interviewsession" not in inspector.get_table_names():
        return
    op.alter_column(
        "interviewsession",
        "max_turns",
        server_default=sa.text("6"),
        existing_type=sa.Integer(),
        existing_nullable=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "interviewsession" not in inspector.get_table_names():
        return
    op.alter_column(
        "interviewsession",
        "max_turns",
        server_default=sa.text("5"),
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
