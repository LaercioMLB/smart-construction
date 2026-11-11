import os
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, pool, text

from app.core.database import migration_config
from app.core.settings import Settings


@dataclass(frozen=True)
class DatabaseFixture:
    migration: Settings
    runtime: Settings

    def config(self) -> Config:
        config = migration_config()
        config.attributes["database_url"] = self.migration.database_url()
        return config


@contextmanager
def temporary_database() -> Iterator[DatabaseFixture]:
    host = os.environ.get("SMART_TEST_DB_HOST")
    if not host:
        pytest.skip("PostgreSQL 17 de testes nao configurado; use api-test no Compose.")
    migration_secret = Path(os.environ["SMART_TEST_DB_PASSWORD_FILE"])
    runtime_secret = Path(os.environ["SMART_TEST_API_PASSWORD_FILE"])
    name = "smart_test_" + uuid4().hex
    admin = Settings(
        db_host=host,
        db_user="smart_migrator",
        db_name="postgres",
        db_password_file=migration_secret,
    )
    bootstrap = create_engine(
        admin.database_url(), isolation_level="AUTOCOMMIT", poolclass=pool.NullPool
    )
    created = False
    try:
        with bootstrap.connect() as connection:
            version = int(
                connection.execute(text("SHOW server_version_num")).scalar_one()
            )
            assert version // 10000 == 17
            connection.exec_driver_sql(f'CREATE DATABASE "{name}"')
            created = True
        yield DatabaseFixture(
            migration=Settings(
                db_host=host,
                db_user="smart_migrator",
                db_name=name,
                db_password_file=migration_secret,
            ),
            runtime=Settings(
                db_host=host, db_name=name, db_password_file=runtime_secret
            ),
        )
    finally:
        if created:
            assert name.startswith("smart_test_") and len(name) == 43
            with bootstrap.connect() as connection:
                connection.exec_driver_sql(f'DROP DATABASE "{name}" WITH (FORCE)')
        bootstrap.dispose()


@pytest.fixture
def database() -> Iterator[DatabaseFixture]:
    with temporary_database() as value:
        yield value
