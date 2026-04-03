"""Add agenticdecision table for HITL journal

Revision ID: d4e5f6a7b8c9
Revises: c2d3e4f5a6b7
Create Date: 2026-04-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agenticdecision",
        sa.Column("action_type", sa.String(length=100), nullable=False),
        sa.Column("input_context", sa.JSON(), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("feedback_notes", sa.Text(), nullable=True),
        sa.Column("approver_id", sa.UUID(), nullable=True),
        sa.Column("proposed_payload", sa.JSON(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["approver_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agenticdecision_action_type"),
        "agenticdecision",
        ["action_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agenticdecision_id"), "agenticdecision", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_agenticdecision_is_deleted"),
        "agenticdecision",
        ["is_deleted"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agenticdecision_status"),
        "agenticdecision",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_agenticdecision_status"), table_name="agenticdecision")
    op.drop_index(op.f("ix_agenticdecision_is_deleted"), table_name="agenticdecision")
    op.drop_index(op.f("ix_agenticdecision_id"), table_name="agenticdecision")
    op.drop_index(op.f("ix_agenticdecision_action_type"), table_name="agenticdecision")
    op.drop_table("agenticdecision")
