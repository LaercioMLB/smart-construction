from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RetainedProof(Base):
    """Sem FK ao cadastro excluído; não contém documento ou valores antigos."""

    __tablename__ = "comprovantes_encerramento"
    cadastro_id: Mapped[UUID] = mapped_column(primary_key=True)
    encerrado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    minimo: Mapped[dict[str, object]] = mapped_column(JSONB)


class Preservation(Base):
    """Escopo por UUID; referência é um código de processo, nunca texto pessoal."""

    __tablename__ = "preservacoes"
    entidade_id: Mapped[UUID] = mapped_column(primary_key=True)
    referencia: Mapped[str] = mapped_column(String(80))
    responsavel_id: Mapped[UUID] = mapped_column()
    registrado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ate: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
