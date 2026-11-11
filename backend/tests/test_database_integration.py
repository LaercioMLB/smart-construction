import pytest
from alembic import command
from conftest import DatabaseFixture
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, pool, text
from sqlalchemy.exc import DBAPIError

from app.core.database import Database, DatabaseNotReady
from app.main import create_app

pytestmark = pytest.mark.integration


def test_empty_database_becomes_ready_after_idempotent_migrations(
    database: DatabaseFixture,
) -> None:
    runtime = Database(database.runtime)
    try:
        with pytest.raises(DatabaseNotReady):
            runtime.check()
        command.upgrade(database.config(), "head")
        command.upgrade(database.config(), "head")
        runtime.check()
        with TestClient(create_app(database.runtime, readiness=runtime)) as client:
            assert client.get("/api/v1/health/ready").status_code == 200
    finally:
        runtime.close()


def test_downgrade_is_detected_and_upgrade_restores_readiness(
    database: DatabaseFixture,
) -> None:
    command.upgrade(database.config(), "head")
    runtime = Database(database.runtime)
    try:
        runtime.check()
        command.downgrade(database.config(), "base")
        with pytest.raises(DatabaseNotReady):
            runtime.check()
        command.upgrade(database.config(), "head")
        runtime.check()
    finally:
        runtime.close()


def test_runtime_cannot_change_structure_or_migration_history(
    database: DatabaseFixture,
) -> None:
    command.upgrade(database.config(), "head")
    runtime = Database(database.runtime)
    try:
        for statement in (
            "CREATE TABLE smart.forbidden(id integer)",
            "CREATE SCHEMA forbidden",
            "UPDATE public.alembic_version SET version_num = 'forged'",
        ):
            with pytest.raises(DBAPIError), runtime.engine.begin() as connection:
                connection.exec_driver_sql(statement)
        runtime.check()
    finally:
        runtime.close()


def test_default_privileges_allow_runtime_dml_on_migrated_tables(
    database: DatabaseFixture,
) -> None:
    command.upgrade(database.config(), "head")
    migrator = create_engine(database.migration.database_url(), poolclass=pool.NullPool)
    runtime = Database(database.runtime)
    try:
        with migrator.begin() as connection:
            connection.exec_driver_sql(
                "CREATE TABLE smart.probe(id integer PRIMARY KEY, value text NOT NULL)"
            )
        with runtime.engine.begin() as connection:
            connection.execute(
                text("INSERT INTO smart.probe VALUES (1, :value)"),
                {"value": "synthetic"},
            )
        with runtime.engine.begin() as connection:
            assert (
                connection.execute(
                    text("SELECT value FROM smart.probe WHERE id=1")
                ).scalar_one()
                == "synthetic"
            )
            connection.execute(
                text("UPDATE smart.probe SET value='updated' WHERE id=1")
            )
            connection.execute(text("DELETE FROM smart.probe WHERE id=1"))
        with runtime.engine.connect() as connection:
            assert (
                connection.execute(
                    text("SELECT count(*) FROM smart.probe")
                ).scalar_one()
                == 0
            )
    finally:
        runtime.close()
        migrator.dispose()


def test_wrong_revision_does_not_report_ready(database: DatabaseFixture) -> None:
    command.upgrade(database.config(), "head")
    migrator = create_engine(database.migration.database_url(), poolclass=pool.NullPool)
    runtime = Database(database.runtime)
    try:
        runtime.check()
        with migrator.begin() as connection:
            connection.exec_driver_sql(
                "UPDATE public.alembic_version SET version_num='unknown'"
            )
        with pytest.raises(DatabaseNotReady, match="schema_revision"):
            runtime.check()
    finally:
        runtime.close()
        migrator.dispose()
