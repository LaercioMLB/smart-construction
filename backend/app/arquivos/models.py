from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.cadastros.models import now
from app.core.database import Base


class PrivateFile(Base):
    __tablename__ = "arquivos"
    __table_args__ = (
        CheckConstraint(
            "finalidade IN ('foto_perfil','foto_trabalho','logo')", name="finalidade"
        ),
        CheckConstraint("tamanho_bytes BETWEEN 1 AND 5242880", name="tamanho"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cadastro_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.cadastros.id"), index=True
    )
    finalidade: Mapped[str] = mapped_column(String(20))
    bucket: Mapped[str] = mapped_column(String(100))
    chave: Mapped[str] = mapped_column(String(200), unique=True)
    content_type: Mapped[str] = mapped_column(String(20))
    tamanho_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    largura: Mapped[int] = mapped_column(Integer)
    altura: Mapped[int] = mapped_column(Integer)
    ordem: Mapped[int] = mapped_column(Integer)
    estado: Mapped[str] = mapped_column(String(20), default="pronto")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    revogado_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class UploadJournal(Base):
    """Intenções persistidas antes do PUT; sobrevivem ao rollback do cadastro."""

    __tablename__ = "uploads_journal"
    __table_args__ = (
        CheckConstraint("estado IN ('reservado','vinculado','limpo')", name="estado"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    chave: Mapped[str] = mapped_column(String(200), unique=True)
    bucket: Mapped[str] = mapped_column(String(100))
    lock_key: Mapped[int] = mapped_column(BigInteger)
    estado: Mapped[str] = mapped_column(String(20), default="reservado", index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
