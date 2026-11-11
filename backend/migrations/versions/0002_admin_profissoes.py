"""Administrador, sessões, profissões e auditoria."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_admin_profissoes"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "administradores",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("nome", sa.String(150), nullable=False),
        sa.Column("login", sa.String(150), nullable=False, unique=True),
        sa.Column("senha_hash", sa.String(256), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        schema="smart",
    )
    op.create_table(
        "sessoes_admin",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "administrador_id",
            sa.Uuid(),
            sa.ForeignKey("smart.administradores.id"),
            nullable=False,
        ),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        schema="smart",
    )
    op.create_index(
        "ix_sessoes_admin_administrador_id",
        "sessoes_admin",
        ["administrador_id"],
        schema="smart",
    )
    op.create_index(
        "ix_sessoes_admin_expira_em", "sessoes_admin", ["expira_em"], schema="smart"
    )
    op.create_table(
        "limites_login",
        sa.Column("chave", sa.String(64), primary_key=True),
        sa.Column("inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tentativas", sa.Integer(), nullable=False),
        schema="smart",
    )
    op.create_table(
        "profissoes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("nome", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("versao", sa.Integer(), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("versao >= 1", name="ck_profissoes_versao_positiva"),
        schema="smart",
    )
    op.create_table(
        "auditoria",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "administrador_id",
            sa.Uuid(),
            sa.ForeignKey("smart.administradores.id"),
            nullable=False,
        ),
        sa.Column("entidade", sa.String(40), nullable=False),
        sa.Column("entidade_id", sa.Uuid(), nullable=False),
        sa.Column("acao", sa.String(40), nullable=False),
        sa.Column("antes", postgresql.JSONB(), nullable=True),
        sa.Column("depois", postgresql.JSONB(), nullable=True),
        sa.Column("ocorrido_em", sa.DateTime(timezone=True), nullable=False),
        schema="smart",
    )
    op.create_index(
        "ix_auditoria_entidade_id", "auditoria", ["entidade_id"], schema="smart"
    )
    op.execute("REVOKE UPDATE, DELETE, TRUNCATE ON smart.auditoria FROM smart_api")


def downgrade() -> None:
    for table in (
        "auditoria",
        "profissoes",
        "limites_login",
        "sessoes_admin",
        "administradores",
    ):
        op.drop_table(table, schema="smart")
