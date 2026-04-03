"""Enable pgvector and add agenticdecision.embedding

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import VECTOR

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
    op.add_column(
        "agenticdecision",
        sa.Column("embedding", VECTOR(768), nullable=True),
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_agenticdecision_embedding_hnsw "
            "ON agenticdecision USING hnsw (embedding vector_l2_ops) "
            "WHERE (embedding IS NOT NULL)"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_agenticdecision_embedding_hnsw"))
    op.drop_column("agenticdecision", "embedding")
