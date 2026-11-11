from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Administrator(Base):
    __tablename__ = "administradores"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    nome: Mapped[str] = mapped_column(String(150))
    login: Mapped[str] = mapped_column(String(150), unique=True)
    senha_hash: Mapped[str] = mapped_column(String(256))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AdminSession(Base):
    __tablename__ = "sessoes_admin"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    administrador_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.administradores.id"), index=True
    )
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class LoginLimit(Base):
    __tablename__ = "limites_login"
    chave: Mapped[str] = mapped_column(String(64), primary_key=True)
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    tentativas: Mapped[int] = mapped_column(Integer)
