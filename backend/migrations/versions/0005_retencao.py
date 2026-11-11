"""Marcos explícitos e comprovantes mínimos; manutenção fora do runtime."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005_retencao"
down_revision = "0004_analise_publicacao"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cadastros",
        sa.Column("encerrado_em", sa.DateTime(timezone=True)),
        schema="smart",
    )
    op.add_column(
        "arquivos", sa.Column("revogado_em", sa.DateTime(timezone=True)), schema="smart"
    )
    # Legados removidos sem marco confiável não são expirados automaticamente.
    op.create_table(
        "comprovantes_encerramento",
        sa.Column("cadastro_id", sa.Uuid(), primary_key=True),
        sa.Column("encerrado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("minimo", JSONB(), nullable=False),
        schema="smart",
    )
    op.create_index(
        "ix_comprovantes_encerramento_expira_em",
        "comprovantes_encerramento",
        ["expira_em"],
        schema="smart",
    )
    op.create_table(
        "preservacoes",
        sa.Column("entidade_id", sa.Uuid(), primary_key=True),
        sa.Column("referencia", sa.String(80), nullable=False),
        sa.Column("responsavel_id", sa.Uuid(), nullable=False),
        sa.Column("registrado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ate", sa.DateTime(timezone=True), nullable=False),
        schema="smart",
    )
    op.create_index("ix_preservacoes_ate", "preservacoes", ["ate"], schema="smart")
    op.execute(
        "REVOKE ALL ON smart.comprovantes_encerramento, "
        "smart.preservacoes FROM smart_api"
    )
    # Mesmo um cliente HTTP comprometido não pode encerrar/reabrir diretamente.
    op.execute("""
        CREATE FUNCTION smart.guard_closure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF current_user = 'smart_api' AND
             (NEW.encerrado_em IS DISTINCT FROM OLD.encerrado_em
              OR OLD.encerrado_em IS NOT NULL)
          THEN RAISE EXCEPTION 'maintenance required' USING ERRCODE = '42501'; END IF;
          RETURN NEW;
        END $$;
        REVOKE EXECUTE ON FUNCTION smart.guard_closure() FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION smart.guard_closure() TO smart_api;
        CREATE TRIGGER guard_closure BEFORE UPDATE ON smart.cadastros
        FOR EACH ROW EXECUTE FUNCTION smart.guard_closure();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER guard_closure ON smart.cadastros")
    op.execute("DROP FUNCTION smart.guard_closure()")
    op.drop_table("preservacoes", schema="smart")
    op.drop_table("comprovantes_encerramento", schema="smart")
    op.drop_column("arquivos", "revogado_em", schema="smart")
    op.drop_column("cadastros", "encerrado_em", schema="smart")
