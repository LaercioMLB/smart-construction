from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

import pytest
from alembic import command
from conftest import DatabaseFixture
from sqlalchemy import Engine, func, select, update
from sqlalchemy.orm import Session

from app.auditoria.models import AuditEvent
from app.auth.cli import manage_admin
from app.auth.models import Administrator
from app.core.database import create_database_engine
from app.core.problems import ApiProblem
from app.profissoes import cli
from app.profissoes.models import Profession
from app.profissoes.schemas import ProfissaoAdministrativa, ProfissaoCriacao
from app.profissoes.service import create_profession

pytestmark = pytest.mark.integration


@pytest.fixture
def engine(database: DatabaseFixture) -> Iterator[Engine]:
    command.upgrade(database.config(), "head")
    manage_admin(
        database.runtime,
        action="create",
        login="admin.catalogo",
        name="Administrador Sintético",
        password="Senha sintetica exclusiva do catalogo!",
    )
    value = create_database_engine(database.runtime)
    try:
        yield value
    finally:
        value.dispose()


def counts(engine: Engine) -> tuple[int, int]:
    with Session(engine) as session:
        return (
            session.scalar(select(func.count()).select_from(Profession)) or 0,
            session.scalar(
                select(func.count())
                .select_from(AuditEvent)
                .where(AuditEvent.entidade == "profissao")
            )
            or 0,
        )


def test_dry_run_writes_nothing_and_apply_is_audited_and_idempotent(
    engine: Engine,
) -> None:
    catalog = cli.load_initial_catalog()
    result = cli.populate_catalog(engine, catalog)
    assert result.modo == "simulacao" and len(result.a_criar) == 25
    assert counts(engine) == (0, 0)
    result = cli.populate_catalog(
        engine, catalog, apply=True, admin_login="ADMIN.CATALOGO"
    )
    assert result.criadas == 25 and result.a_criar == []
    assert counts(engine) == (25, 25)
    with Session(engine) as session:
        administrator = session.scalars(select(Administrator)).one()
        assert all(
            row.administrador_id == administrator.id and row.acao == "criar"
            for row in session.scalars(
                select(AuditEvent).where(AuditEvent.entidade == "profissao")
            )
        )
    again = cli.populate_catalog(
        engine, catalog, apply=True, admin_login="admin.catalogo"
    )
    assert again.criadas == 0 and again.existentes == 25
    assert counts(engine) == (25, 25)


def test_existing_inactive_name_and_version_are_preserved(engine: Engine) -> None:
    with Session(engine) as session, session.begin():
        actor = session.scalars(select(Administrator)).one()
        original = create_profession(
            session, ProfissaoCriacao(nome="SERRALHEIRO", ativo=False), actor.id
        )
    result = cli.populate_catalog(
        engine, cli.load_initial_catalog(), apply=True, admin_login="admin.catalogo"
    )
    assert result.criadas == 24 and result.inativas_preservadas == 1
    with Session(engine) as session:
        preserved = session.get(Profession, original.id)
        assert preserved is not None
        assert preserved.nome == original.nome and preserved.ativo is False
        assert preserved.versao == original.versao
    assert counts(engine) == (25, 25)


@pytest.mark.parametrize("login", [None, "inexistente", "admin.catalogo"])
def test_application_requires_existing_active_admin(
    engine: Engine, login: str | None
) -> None:
    if login == "admin.catalogo":
        with engine.begin() as connection:
            connection.execute(update(Administrator).values(ativo=False))
    with pytest.raises(ValueError):
        cli.populate_catalog(
            engine, cli.load_initial_catalog(), apply=True, admin_login=login
        )
    assert counts(engine) == (0, 0)


def test_failure_rolls_back_entire_batch_including_audit(
    engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = cli.create_profession
    calls = 0

    def fail_second(
        session: Session, data: ProfissaoCriacao, actor: UUID
    ) -> ProfissaoAdministrativa:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise ApiProblem(409, "PROFESSION_EXISTS", "Conflito sintético.")
        return original(session, data, actor)

    monkeypatch.setattr(cli, "create_profession", fail_second)
    with pytest.raises(ApiProblem):
        cli.populate_catalog(
            engine, cli.load_initial_catalog(), apply=True, admin_login="admin.catalogo"
        )
    assert counts(engine) == (0, 0)


def test_concurrent_batches_do_not_duplicate_professions_or_history(
    engine: Engine,
) -> None:
    catalog = cli.load_initial_catalog()
    with ThreadPoolExecutor(max_workers=2) as executor:
        jobs = [
            executor.submit(
                cli.populate_catalog,
                engine,
                catalog,
                apply=True,
                admin_login="admin.catalogo",
            )
            for _ in range(2)
        ]
        assert sorted(job.result(timeout=10).criadas for job in jobs) == [0, 25]
    assert counts(engine) == (25, 25)
