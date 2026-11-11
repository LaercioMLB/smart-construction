from collections.abc import Callable
from typing import Protocol

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, MetaData, create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase

from app.core.settings import BACKEND_DIR, Settings


class Base(DeclarativeBase):
    metadata = MetaData(
        schema="smart",
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        },
    )


def migration_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    return config


def create_database_engine(settings: Settings) -> Engine:
    return create_engine(
        settings.database_url(),
        connect_args={
            "connect_timeout": settings.db_connect_timeout,
            "options": f"-c statement_timeout={settings.db_statement_timeout_ms}",
        },
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_timeout=3,
        hide_parameters=True,
    )


class DatabaseNotReady(Exception):
    """Banco indisponivel, major incorreta ou migrations divergentes."""


class Readiness(Protocol):
    def check(self) -> None: ...

    def close(self) -> None: ...


class Database:
    def __init__(
        self,
        settings: Settings,
        *,
        engine: Engine | None = None,
        heads: Callable[[], set[str]] | None = None,
    ) -> None:
        self.engine = engine if engine is not None else create_database_engine(settings)
        self._heads = heads or self._expected_heads

    @staticmethod
    def _expected_heads() -> set[str]:
        return set(ScriptDirectory.from_config(migration_config()).get_heads())

    def check(self) -> None:
        try:
            with self.engine.connect() as connection:
                version = int(
                    connection.execute(text("SHOW server_version_num")).scalar_one()
                )
                if version // 10000 != 17:
                    raise DatabaseNotReady("postgres_major")
                current = set(
                    MigrationContext.configure(connection).get_current_heads()
                )
                expected = self._heads()
                if not expected or current != expected:
                    raise DatabaseNotReady("schema_revision")
                if (
                    connection.execute(
                        text("SELECT to_regnamespace('smart') IS NOT NULL")
                    ).scalar_one()
                    is not True
                ):
                    raise DatabaseNotReady("schema_missing")
        except SQLAlchemyError:
            raise DatabaseNotReady("database_unavailable") from None

    def close(self) -> None:
        self.engine.dispose()
