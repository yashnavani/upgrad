from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    id: UUID
    created_at: datetime
    actor_id: str | None
    endpoint: str
    http_method: str
    status_code: int
    processing_time_ms: float
    client_ip: str | None

    model_config = ConfigDict(from_attributes=True)
