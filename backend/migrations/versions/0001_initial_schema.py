"""Namespace da aplicacao e permissoes do usuario de runtime."""

from alembic import op

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA smart")
    op.execute("GRANT USAGE ON SCHEMA smart TO smart_api")
    op.execute("GRANT SELECT ON TABLE public.alembic_version TO smart_api")
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA smart "
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO smart_api"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA smart "
        "GRANT USAGE, SELECT ON SEQUENCES TO smart_api"
    )


def downgrade() -> None:
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA smart "
        "REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM smart_api"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA smart "
        "REVOKE USAGE, SELECT ON SEQUENCES FROM smart_api"
    )
    op.execute("REVOKE SELECT ON TABLE public.alembic_version FROM smart_api")
    op.execute("DROP SCHEMA smart")
