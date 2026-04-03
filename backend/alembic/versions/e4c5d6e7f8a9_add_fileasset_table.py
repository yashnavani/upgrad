"""Add fileasset table for upload metadata

Revision ID: e4c5d6e7f8a9
Revises: f8a2b1c0d4e1
Create Date: 2026-04-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e4c5d6e7f8a9"
down_revision: Union[str, Sequence[str], None] = "f8a2b1c0d4e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fileasset",
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_fileasset_id"), "fileasset", ["id"], unique=False)
    op.create_index(
        op.f("ix_fileasset_is_deleted"), "fileasset", ["is_deleted"], unique=False
    )
    op.create_index(op.f("ix_fileasset_owner_id"), "fileasset", ["owner_id"], unique=False)
    op.create_index(
        op.f("ix_fileasset_storage_path"), "fileasset", ["storage_path"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_fileasset_storage_path"), table_name="fileasset")
    op.drop_index(op.f("ix_fileasset_owner_id"), table_name="fileasset")
    op.drop_index(op.f("ix_fileasset_is_deleted"), table_name="fileasset")
    op.drop_index(op.f("ix_fileasset_id"), table_name="fileasset")
    op.drop_table("fileasset")
