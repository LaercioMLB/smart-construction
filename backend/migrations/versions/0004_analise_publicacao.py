"""Análise administrativa e visibilidade dos profissionais."""

import sqlalchemy as sa
from alembic import op

revision = "0004_analise_publicacao"
down_revision = "0003_cadastros_arquivos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cadastros",
        sa.Column("motivo_reprovacao", sa.String(1000), nullable=True),
        schema="smart",
    )
    op.create_table(
        "publicacoes_profissionais",
        sa.Column(
            "profissional_id",
            sa.Uuid(),
            sa.ForeignKey("smart.profissionais.id"),
            primary_key=True,
        ),
        sa.Column("publicado", sa.Boolean(), nullable=False),
        sa.Column("revisao", sa.Integer(), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("revisao >= 0", name="ck_publicacoes_profissionais_revisao"),
        schema="smart",
    )
    op.create_index(
        "ix_publicacoes_profissionais_publicado",
        "publicacoes_profissionais",
        ["publicado"],
        schema="smart",
    )


def downgrade() -> None:
    op.drop_table("publicacoes_profissionais", schema="smart")
    op.drop_column("cadastros", "motivo_reprovacao", schema="smart")
