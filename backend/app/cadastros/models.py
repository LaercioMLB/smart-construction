from datetime import UTC, date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def now() -> datetime:
    return datetime.now(UTC)


class Registration(Base):
    __tablename__ = "cadastros"
    __table_args__ = (
        CheckConstraint("tipo IN ('profissional','empresa')", name="tipo"),
        CheckConstraint("status IN ('pendente','aprovado','reprovado')", name="status"),
        CheckConstraint("versao >= 1", name="versao_positiva"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    protocolo: Mapped[str] = mapped_column(String(100), unique=True)
    tipo: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="pendente", index=True)
    versao: Mapped[int] = mapped_column(Integer, default=1)
    motivo_reprovacao: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now
    )
    encerrado_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Professional(Base):
    __tablename__ = "profissionais"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cadastro_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.cadastros.id"), unique=True
    )
    nome: Mapped[str] = mapped_column(String(150))
    cpf: Mapped[str] = mapped_column(String(11), unique=True)
    nascimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    whatsapp: Mapped[str] = mapped_column(String(14))
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    biografia: Mapped[str] = mapped_column(String(400))


class Company(Base):
    __tablename__ = "empresas"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cadastro_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.cadastros.id"), unique=True
    )
    razao_social: Mapped[str] = mapped_column(String(200))
    nome_fantasia: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cnpj: Mapped[str] = mapped_column(String(14), unique=True)
    responsavel: Mapped[str] = mapped_column(String(150))
    whatsapp: Mapped[str] = mapped_column(String(14))
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    segmento: Mapped[str] = mapped_column(String(150))
    descricao: Mapped[str | None] = mapped_column(String(1000), nullable=True)


class Address(Base):
    __tablename__ = "enderecos"
    cadastro_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.cadastros.id"), primary_key=True
    )
    cidade: Mapped[str] = mapped_column(String(120))
    uf: Mapped[str] = mapped_column(String(2))
    cep: Mapped[str | None] = mapped_column(String(8), nullable=True)
    rua: Mapped[str | None] = mapped_column(String(200), nullable=True)
    numero: Mapped[str | None] = mapped_column(String(30), nullable=True)
    complemento: Mapped[str | None] = mapped_column(String(150), nullable=True)
    bairro: Mapped[str | None] = mapped_column(String(120), nullable=True)


class ProfessionChoice(Base):
    __tablename__ = "profissional_profissoes"
    __table_args__ = (
        CheckConstraint(
            "(profissao_id IS NOT NULL) <> (sugestao IS NOT NULL)",
            name="oficial_ou_sugestao",
        ),
        CheckConstraint("ordem BETWEEN 0 AND 4", name="ordem"),
        Index(
            "uq_profissional_principal",
            "profissional_id",
            unique=True,
            postgresql_where=text("principal"),
        ),
        Index(
            "uq_profissional_profissao", "profissional_id", "profissao_id", unique=True
        ),
        Index(
            "uq_profissional_sugestao",
            "profissional_id",
            "sugestao_normalizada",
            unique=True,
        ),
    )
    profissional_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.profissionais.id"), primary_key=True
    )
    ordem: Mapped[int] = mapped_column(Integer, primary_key=True)
    profissao_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("smart.profissoes.id"), nullable=True
    )
    sugestao: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sugestao_normalizada: Mapped[str | None] = mapped_column(String(100), nullable=True)
    principal: Mapped[bool] = mapped_column(Boolean)


class ProfessionalCourse(Base):
    __tablename__ = "profissional_cursos"
    __table_args__ = (
        CheckConstraint("ordem BETWEEN 0 AND 9", name="ordem"),
        CheckConstraint(
            "inicio IS NULL OR conclusao IS NULL OR conclusao >= inicio", name="anos"
        ),
    )
    profissional_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.profissionais.id"), primary_key=True
    )
    ordem: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(150))
    instituicao: Mapped[str | None] = mapped_column(String(150), nullable=True)
    inicio: Mapped[int | None] = mapped_column(Integer, nullable=True)
    conclusao: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Consent(Base):
    __tablename__ = "aceites"
    cadastro_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.cadastros.id"), primary_key=True
    )
    tipo: Mapped[str] = mapped_column(String(20), primary_key=True)
    versao: Mapped[str] = mapped_column(String(80))
    aceito_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RegistrationHistory(Base):
    __tablename__ = "historico_cadastros"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cadastro_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.cadastros.id"), index=True
    )
    administrador_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("smart.administradores.id"), nullable=True
    )
    acao: Mapped[str] = mapped_column(String(40))
    ocorrido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    motivo: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    alteracoes: Mapped[list[dict[str, str | None]]] = mapped_column(JSONB, default=list)


class SubmissionKey(Base):
    __tablename__ = "idempotencias_cadastro"
    chave: Mapped[UUID] = mapped_column(primary_key=True)
    tipo: Mapped[str] = mapped_column(String(20), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    cadastro_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.cadastros.id"), unique=True
    )
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SubmissionLimit(Base):
    __tablename__ = "limites_cadastro"
    chave: Mapped[str] = mapped_column(String(40), primary_key=True)
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    tentativas: Mapped[int] = mapped_column(Integer)


class Publication(Base):
    __tablename__ = "publicacoes_profissionais"
    __table_args__ = (CheckConstraint("revisao >= 0", name="revisao"),)
    profissional_id: Mapped[UUID] = mapped_column(
        ForeignKey("smart.profissionais.id"), primary_key=True
    )
    publicado: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    revisao: Mapped[int] = mapped_column(Integer, default=0)
    atualizado_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
