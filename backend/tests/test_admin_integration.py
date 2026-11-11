from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from alembic import command
from conftest import DatabaseFixture
from fastapi.testclient import TestClient
from sqlalchemy import select, text, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from test_health import assert_schema

from app.auditoria.models import AuditEvent
from app.auth.cli import manage_admin
from app.auth.models import Administrator, AdminSession, LoginLimit
from app.auth.security import COOKIE, session_hash
from app.core.database import create_database_engine
from app.core.settings import Settings
from app.main import create_app

pytestmark = pytest.mark.integration
ORIGIN = {"Origin": "http://127.0.0.1:3000"}
PASSWORD = "Senha sintética exclusiva de teste!"


@pytest.fixture
def client(database: DatabaseFixture) -> Iterator[TestClient]:
    command.upgrade(database.config(), "head")
    manage_admin(
        database.runtime,
        action="create",
        login="admin.teste",
        name="Administrador Sintético",
        password=PASSWORD,
    )
    with TestClient(
        create_app(database.runtime), raise_server_exceptions=False
    ) as instance:
        yield instance


def sign_in(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/admin/sessao",
        headers=ORIGIN,
        json={"login": "ADMIN.TESTE", "senha": PASSWORD},
    )
    assert response.status_code == 200
    assert_schema("Sessao", response.json())
    return ORIGIN | {"X-CSRF-Token": response.json()["csrf_token"]}


def test_authentication_rotation_logout_and_private_cookie(
    client: TestClient, database: DatabaseFixture
) -> None:
    assert client.get("/api/v1/admin/profissoes").status_code == 401
    assert (
        client.post(
            "/api/v1/admin/sessao", json={"login": "admin.teste", "senha": PASSWORD}
        ).status_code
        == 403
    )
    invalid = client.post(
        "/api/v1/admin/sessao",
        headers=ORIGIN,
        json={"login": "inexistente", "senha": PASSWORD},
    )
    assert invalid.status_code == 401
    headers = sign_in(client)
    old = client.cookies.get(COOKIE)
    assert old is not None
    response = client.get("/api/v1/admin/sessao")
    assert response.json()["csrf_token"] == headers["X-CSRF-Token"]
    assert old not in response.text and PASSWORD not in response.text
    headers = sign_in(client)
    assert old != client.cookies.get(COOKIE)
    assert (
        client.get(
            "/api/v1/admin/sessao", headers={"Cookie": f"{COOKIE}={old}"}
        ).status_code
        == 401
    )
    engine = create_database_engine(database.runtime)
    try:
        with Session(engine) as session:
            saved = session.scalar(select(AdminSession))
            assert saved is not None
            assert saved.token_hash == session_hash(client.cookies.get(COOKIE) or "")
        result = client.delete("/api/v1/admin/sessao", headers=headers)
        assert result.status_code == 204
        assert "HttpOnly" in result.headers["set-cookie"]
        assert "Path=/api/v1/admin" in result.headers["set-cookie"]
        assert client.get("/api/v1/admin/sessao").status_code == 401
    finally:
        engine.dispose()


def test_csrf_origin_and_input_errors_do_not_expose_values(client: TestClient) -> None:
    headers = sign_in(client)
    for request_headers in (
        ORIGIN,
        headers | {"Origin": "https://evil.invalid"},
        headers | {"X-CSRF-Token": "wrong"},
    ):
        assert (
            client.post(
                "/api/v1/admin/profissoes",
                headers=request_headers,
                json={"nome": "Pintor Teste"},
            ).status_code
            == 403
        )
    assert client.delete("/api/v1/admin/sessao", headers=ORIGIN).status_code == 403
    bad = client.post(
        "/api/v1/admin/profissoes",
        headers=headers,
        json={"nome": "<privado>", "senha": PASSWORD},
    )
    assert bad.status_code == 422
    assert_schema("Erro", bad.json())
    assert PASSWORD not in bad.text and "<privado>" not in bad.text
    oversized = client.post(
        "/api/v1/admin/sessao", headers=ORIGIN, content=b"x" * 16385
    )
    assert oversized.status_code == 413


def test_profession_versions_public_filter_and_history(client: TestClient) -> None:
    headers = sign_in(client)
    response = client.post(
        "/api/v1/admin/profissoes",
        headers=headers,
        json={"nome": " Técnico   de obras "},
    )
    assert response.status_code == 201
    record = response.json()
    assert_schema("ProfissaoAdministrativa", record)
    assert record["slug"] == "tecnico-de-obras" and response.headers["etag"] == '"1"'
    identifier = record["id"]
    duplicate = client.post(
        "/api/v1/admin/profissoes", headers=headers, json={"nome": "TECNICO DE OBRAS"}
    )
    assert duplicate.status_code == 409
    target = f"/api/v1/admin/profissoes/{identifier}"
    assert (
        client.patch(target, headers=headers, json={"ativo": False}).status_code == 428
    )
    assert (
        client.patch(
            target, headers=headers | {"If-Match": '"2"'}, json={"ativo": False}
        ).status_code
        == 412
    )
    changed = client.patch(
        target,
        headers=headers | {"If-Match": '"1"'},
        json={"nome": "Técnico Teste", "ativo": False},
    )
    assert changed.status_code == 200 and changed.json()["versao"] == 2
    assert changed.headers["etag"] == '"2"'
    assert client.get("/api/v1/profissoes").json()["data"] == []
    admin = client.get("/api/v1/admin/profissoes?ativo=false&search=TECNICO&limit=1")
    assert_schema("ProfissoesAdministrativas", admin.json())
    assert admin.json()["meta"]["total"] == 1
    history = client.get(target + "/historico")
    assert history.status_code == 200
    assert_schema("HistoricoPagina", history.json())
    events = history.json()["data"]
    assert len(events) == 2 and events[0]["acao"] == "edicao"
    assert {change["campo"] for change in events[0]["alteracoes"]} == {
        "nome",
        "slug",
        "ativo",
        "versao",
    }
    assert (
        client.patch(
            target, headers=headers | {"If-Match": '"2"'}, json={"ativo": True}
        ).status_code
        == 200
    )
    public = client.get("/api/v1/profissoes?search=técnico")
    assert_schema("ProfissoesPublicas", public.json())
    assert set(public.json()["data"][0]) == {"id", "nome", "slug"}
    assert client.get("/api/v1/profissoes?limit=101").status_code == 422
    assert (
        client.patch(
            f"/api/v1/admin/profissoes/{uuid4()}",
            headers=headers | {"If-Match": '"1"'},
            json={"ativo": False},
        ).status_code
        == 404
    )


def test_audit_append_only_and_failed_changes_rollback(
    client: TestClient, database: DatabaseFixture
) -> None:
    headers = sign_in(client)
    first = client.post(
        "/api/v1/admin/profissoes", headers=headers, json={"nome": "Pintor Teste"}
    ).json()
    second = client.post(
        "/api/v1/admin/profissoes", headers=headers, json={"nome": "Pedreiro Teste"}
    ).json()
    failed = client.patch(
        f"/api/v1/admin/profissoes/{second['id']}",
        headers=headers | {"If-Match": '"1"'},
        json={"nome": first["nome"]},
    )
    assert failed.status_code == 409
    engine = create_database_engine(database.runtime)
    try:
        with Session(engine) as session:
            assert (
                len(
                    list(
                        session.scalars(
                            select(AuditEvent).where(AuditEvent.entidade == "profissao")
                        )
                    )
                )
                == 2
            )
        for statement in (
            "UPDATE smart.auditoria SET acao='forjado'",
            "DELETE FROM smart.auditoria",
            "TRUNCATE smart.auditoria",
        ):
            with pytest.raises(DBAPIError), engine.begin() as connection:
                connection.execute(text(statement))
        page = client.get("/api/v1/admin/profissoes").json()
        assert all(row["versao"] == 1 for row in page["data"])
    finally:
        engine.dispose()


def test_expired_disabled_and_password_reset_revoke_access(
    client: TestClient, database: DatabaseFixture
) -> None:
    sign_in(client)
    engine = create_database_engine(database.runtime)
    try:
        with Session(engine) as session, session.begin():
            session.execute(
                update(AdminSession).values(
                    expira_em=datetime.now(UTC) - timedelta(seconds=1)
                )
            )
        assert client.get("/api/v1/admin/sessao").status_code == 401
        sign_in(client)
        manage_admin(
            database.runtime,
            action="reset-password",
            login="admin.teste",
            name=None,
            password=PASSWORD + "Nova",
        )
        assert client.get("/api/v1/admin/sessao").status_code == 401
        assert (
            client.post(
                "/api/v1/admin/sessao",
                headers=ORIGIN,
                json={"login": "admin.teste", "senha": PASSWORD},
            ).status_code
            == 401
        )
        assert (
            client.post(
                "/api/v1/admin/sessao",
                headers=ORIGIN,
                json={"login": "admin.teste", "senha": PASSWORD + "Nova"},
            ).status_code
            == 200
        )
        with Session(engine) as session, session.begin():
            session.execute(update(Administrator).values(ativo=False))
        assert client.get("/api/v1/admin/sessao").status_code == 401
    finally:
        engine.dispose()


def test_failed_login_limit_persists_and_resets_after_window(
    client: TestClient, database: DatabaseFixture
) -> None:
    for _ in range(10):
        assert (
            client.post(
                "/api/v1/admin/sessao",
                headers=ORIGIN,
                json={"login": "admin.teste", "senha": "errada"},
            ).status_code
            == 401
        )
    assert (
        client.post(
            "/api/v1/admin/sessao",
            headers=ORIGIN,
            json={"login": "admin.teste", "senha": PASSWORD},
        ).status_code
        == 429
    )
    engine = create_database_engine(database.runtime)
    try:
        with Session(engine) as session, session.begin():
            session.execute(
                update(LoginLimit).values(
                    inicio=datetime.now(UTC) - timedelta(minutes=16)
                )
            )
        sign_in(client)
    finally:
        engine.dispose()


def test_production_cookie_is_secure(database: DatabaseFixture) -> None:
    command.upgrade(database.config(), "head")
    manage_admin(
        database.runtime,
        action="create",
        login="admin.teste",
        name="Admin Teste",
        password=PASSWORD,
    )
    settings = Settings(
        **(
            database.runtime.model_dump()
            | {
                "environment": "production",
                "allowed_origins": ["https://smart.example"],
            }
        )
    )
    with TestClient(create_app(settings), base_url="https://smart.example") as client:
        response = client.post(
            "/api/v1/admin/sessao",
            headers={"Origin": "https://smart.example"},
            json={"login": "admin.teste", "senha": PASSWORD},
        )
        assert response.status_code == 200
        cookie = response.headers["set-cookie"]
        assert "Secure" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
        assert "Domain=" not in cookie and "Max-Age=28800" in cookie
        assert client.get("/api/v1/admin/sessao").status_code == 200


def test_two_concurrent_edits_only_commit_one_version(client: TestClient) -> None:
    headers = sign_in(client)
    created = client.post(
        "/api/v1/admin/profissoes", headers=headers, json={"nome": "Pintor Concorrente"}
    ).json()
    target = f"/api/v1/admin/profissoes/{created['id']}"

    def edit(name: str) -> int:
        return client.patch(
            target, headers=headers | {"If-Match": '"1"'}, json={"nome": name}
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(edit, ("Pintor A", "Pintor B")))
    assert sorted(results) == [200, 412]
    history = client.get(target + "/historico").json()
    assert history["meta"]["total"] == 2
