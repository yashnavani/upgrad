"""Add systemsetting and item tables

Revision ID: c2d3e4f5a6b7
Revises: b7a8c9d0e1f2
Create Date: 2026-03-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "b7a8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "systemsetting",
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("updated_by_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["updated_by_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_systemsetting_id"), "systemsetting", ["id"], unique=False)
    op.create_index(
        op.f("ix_systemsetting_is_deleted"), "systemsetting", ["is_deleted"], unique=False
    )
    op.create_index(op.f("ix_systemsetting_key"), "systemsetting", ["key"], unique=True)

    op.create_table(
        "item",
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_item_id"), "item", ["id"], unique=False)
    op.create_index(op.f("ix_item_is_deleted"), "item", ["is_deleted"], unique=False)
    op.create_index(op.f("ix_item_owner_id"), "item", ["owner_id"], unique=False)
    op.create_index(op.f("ix_item_status"), "item", ["status"], unique=False)
    op.create_index(op.f("ix_item_title"), "item", ["title"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_item_title"), table_name="item")
    op.drop_index(op.f("ix_item_status"), table_name="item")
    op.drop_index(op.f("ix_item_owner_id"), table_name="item")
    op.drop_index(op.f("ix_item_is_deleted"), table_name="item")
    op.drop_index(op.f("ix_item_id"), table_name="item")
    op.drop_table("item")

    op.drop_index(op.f("ix_systemsetting_key"), table_name="systemsetting")
    op.drop_index(op.f("ix_systemsetting_is_deleted"), table_name="systemsetting")
    op.drop_index(op.f("ix_systemsetting_id"), table_name="systemsetting")
    op.drop_table("systemsetting")
