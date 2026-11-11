from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

AuditValues = dict[str, str | int | bool]


class AuditEvent(Base):
    __tablename__ = "auditoria"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    administrador_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.administradores.id")
    )
    entidade: Mapped[str] = mapped_column(String(40))
    entidade_id: Mapped[UUID] = mapped_column(index=True)
    acao: Mapped[str] = mapped_column(String(40))
    antes: Mapped[AuditValues | None] = mapped_column(JSONB, nullable=True)
    depois: Mapped[AuditValues | None] = mapped_column(JSONB, nullable=True)
    ocorrido_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
