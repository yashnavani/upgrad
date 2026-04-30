"""add interviewsession table

Revision ID: f9a0b1c2d3e4
Revises: e5f6a7b8c9d0
Create Date: 2026-04-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "f9a0b1c2d3e4"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "interviewsession" in inspector.get_table_names():
        return
    op.create_table(
        "interviewsession",
        sa.Column("target_role", sa.String(length=255), nullable=False),
        sa.Column("focus_area", sa.String(length=100), nullable=False),
        sa.Column("resume_snippet", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("turn_count", sa.Integer(), nullable=False),
        sa.Column("max_turns", sa.Integer(), nullable=False),
        sa.Column("transcript", sa.JSON(), nullable=False),
        sa.Column("feedback_data", sa.JSON(), nullable=True),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_interviewsession_id"), "interviewsession", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_interviewsession_is_deleted"),
        "interviewsession",
        ["is_deleted"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interviewsession_owner_id"),
        "interviewsession",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interviewsession_status"),
        "interviewsession",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "interviewsession" not in inspector.get_table_names():
        return
    op.drop_index(op.f("ix_interviewsession_status"), table_name="interviewsession")
    op.drop_index(op.f("ix_interviewsession_owner_id"), table_name="interviewsession")
    op.drop_index(op.f("ix_interviewsession_is_deleted"), table_name="interviewsession")
    op.drop_index(op.f("ix_interviewsession_id"), table_name="interviewsession")
    op.drop_table("interviewsession")
