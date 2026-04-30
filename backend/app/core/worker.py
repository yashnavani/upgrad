# backend/app/core/worker.py
from procrastinate import App, PsycopgConnector

from app.core.config import settings


def _procrastinate_conninfo() -> str:
    """Psycopg uses a standard libpq URL; strip SQLAlchemy's asyncpg driver suffix."""
    return str(settings.SQLALCHEMY_DATABASE_URI).replace(
        "postgresql+asyncpg", "postgresql", 1
    )


# CLI: procrastinate --app=app.core.worker.app …  (module app.core.worker, attribute app)
app = App(
    connector=PsycopgConnector(conninfo=_procrastinate_conninfo()),
    import_paths=["app.tasks.ai_tasks"],
)
