"""Add policy table for AI / business rules

Revision ID: b7a8c9d0e1f2
Revises: e4c5d6e7f8a9
Create Date: 2026-03-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7a8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "e4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "policy",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("natural_language", sa.Text(), nullable=False),
        sa.Column("policy_type", sa.String(length=50), nullable=False),
        sa.Column("dsl", sa.JSON(), nullable=True),
        sa.Column("refined_instruction", sa.Text(), nullable=True),
        sa.Column("entity_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("execution_count", sa.Integer(), nullable=False),
        sa.Column("last_executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("creator_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["creator_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_policy_creator_id"), "policy", ["creator_id"], unique=False)
    op.create_index(op.f("ix_policy_entity_name"), "policy", ["entity_name"], unique=False)
    op.create_index(op.f("ix_policy_id"), "policy", ["id"], unique=False)
    op.create_index(op.f("ix_policy_is_active"), "policy", ["is_active"], unique=False)
    op.create_index(op.f("ix_policy_is_deleted"), "policy", ["is_deleted"], unique=False)
    op.create_index(op.f("ix_policy_name"), "policy", ["name"], unique=False)
    op.create_index(op.f("ix_policy_priority"), "policy", ["priority"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_policy_priority"), table_name="policy")
    op.drop_index(op.f("ix_policy_name"), table_name="policy")
    op.drop_index(op.f("ix_policy_is_deleted"), table_name="policy")
    op.drop_index(op.f("ix_policy_is_active"), table_name="policy")
    op.drop_index(op.f("ix_policy_id"), table_name="policy")
    op.drop_index(op.f("ix_policy_entity_name"), table_name="policy")
    op.drop_index(op.f("ix_policy_creator_id"), table_name="policy")
    op.drop_table("policy")
