import hashlib
import json
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from threading import Event
from uuid import UUID, uuid4

import pytest
from alembic import command
from conftest import DatabaseFixture
from fastapi.testclient import TestClient
from registration_samples import company_data, professional_data
from sqlalchemy import Engine, func, select, text, update
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session
from test_health import assert_schema
from test_registration_validation import png_bytes

from app.arquivos.models import PrivateFile, UploadJournal
from app.arquivos.reconcile import reconcile
from app.auth.cli import manage_admin
from app.auth.models import Administrator
from app.cadastros import service as registration_service
from app.cadastros.models import (
    Company,
    Consent,
    Professional,
    ProfessionChoice,
    Registration,
    RegistrationHistory,
    SubmissionKey,
    SubmissionLimit,
)
from app.core.database import create_database_engine
from app.core.problems import ApiProblem
from app.core.settings import Settings
from app.main import create_app
from app.profissoes.models import Profession

pytestmark = pytest.mark.integration
ORIGIN = {"Origin": "http://127.0.0.1:3000"}


class MemoryStorage:
    bucket = "smart-cadastros-private"

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.fail = False
        self.entered: Event | None = None
        self.release: Event | None = None

    def put(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data
        if self.entered is not None:
            self.entered.set()
        if self.release is not None and not self.release.wait(timeout=8):
            raise ApiProblem(503, "TEST_TIMEOUT", "Timeout controlado de teste.")
        if self.fail:
            raise ApiProblem(503, "STORAGE_UNAVAILABLE", "Armazenamento indisponível.")

    def get(self, key: str, expected_size: int, expected_hash: str) -> bytes:
        result = self.objects[key]
        assert (
            len(result) == expected_size
            and hashlib.sha256(result).hexdigest() == expected_hash
        )
        return result

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)

    def delete_verified(self, key: str) -> None:
        if self.fail:
            raise ApiProblem(503, "DELETE_UNCONFIRMED", "Falha sintética de exclusão.")
        self.delete(key)

    def check(self) -> None:
        if self.fail:
            raise ApiProblem(503, "STORAGE_UNAVAILABLE", "Armazenamento indisponível.")

    def close(self) -> None:
        pass


@dataclass
class Environment:
    client: TestClient
    engine: Engine
    settings: Settings
    store: MemoryStorage
    profession: UUID


@pytest.fixture
def environment(database: DatabaseFixture) -> Iterator[Environment]:
    command.upgrade(database.config(), "head")
    settings = Settings(
        **(
            database.runtime.model_dump()
            | {
                "registrations_enabled": True,
                "terms_version": "teste-v1",
                "privacy_version": "teste-v1",
            }
        )
    )
    engine = create_database_engine(settings)
    store = MemoryStorage()
    identifier = uuid4()
    with Session(engine) as session, session.begin():
        session.add(
            Profession(
                id=identifier,
                nome="Pintor Sintético",
                slug="pintor-sintetico",
                ativo=True,
            )
        )
    try:
        with TestClient(
            create_app(settings, storage=store), raise_server_exceptions=False
        ) as client:
            yield Environment(client, engine, settings, store, identifier)
    finally:
        engine.dispose()


def submit(
    env: Environment,
    data: dict | None = None,
    *,
    key: UUID | None = None,
    company: bool = False,
    images: list | None = None,
):
    payload = data if data is not None else professional_data(env.profession)
    files = [("dados", (None, json.dumps(payload)))] + (images or [])
    route = "empresas" if company else "profissionais"
    return env.client.post(
        f"/api/v1/cadastros/{route}",
        headers=ORIGIN | {"Idempotency-Key": str(key or uuid4())},
        files=files,
    )


def test_professional_receipt_relations_consents_and_replay(
    environment: Environment,
) -> None:
    env = environment
    key = uuid4()
    payload = professional_data(env.profession) | {
        "nascimento": "1990-01-01",
        "cursos": [{"nome": "Curso Sintético", "inicio": 2020, "conclusao": 2021}],
    }
    response = submit(env, payload, key=key)
    assert response.status_code == 201
    assert_schema("Recebimento", response.json())
    assert set(response.json()) == {"protocolo", "status", "recebido_em"}
    with Session(env.engine) as session:
        assert session.scalar(select(func.count()).select_from(Professional)) == 1
        assert session.scalar(select(func.count()).select_from(Administrator)) == 0
        assert session.scalar(select(func.count()).select_from(Consent)) == 4
        event = session.scalar(select(RegistrationHistory))
        assert (
            event is not None
            and event.administrador_id is None
            and event.alteracoes == []
        )
    assert submit(env, payload, key=key).json() == response.json()
    changed = submit(env, payload | {"nome": "Outro Nome Sintético"}, key=key)
    assert changed.status_code == 409
    with Session(env.engine) as session, session.begin():
        session.execute(
            update(SubmissionKey).values(
                expira_em=datetime.now(UTC) - timedelta(seconds=1)
            )
        )
    assert submit(env, payload, key=key).status_code == 409


def test_duplicate_document_is_private_and_blocked_in_every_status(
    environment: Environment,
) -> None:
    env = environment
    key = uuid4()
    data = professional_data(env.profession)
    original = submit(env, data, key=key)
    assert original.status_code == 201
    for status in ("pendente", "reprovado", "aprovado"):
        with Session(env.engine) as session, session.begin():
            session.execute(update(Registration).values(status=status))
        duplicate = submit(env, data | {"nome": "Outro Profissional Sintético"})
        assert duplicate.status_code == 409
        assert_schema("Erro", duplicate.json())
        for private in (
            data["cpf"],
            data["nome"],
            original.json()["protocolo"],
            status,
        ):
            assert private not in duplicate.text
        assert submit(env, data, key=key).json() == original.json()


def test_company_accepts_alphanumeric_and_numeric_cnpj_and_stays_private(
    environment: Environment,
) -> None:
    env = environment
    response = submit(env, company_data(), company=True)
    assert response.status_code == 201
    assert submit(env, company_data(), company=True).status_code == 409
    numeric = submit(env, company_data() | {"cnpj": "11222333000181"}, company=True)
    assert numeric.status_code == 201
    with Session(env.engine) as session:
        assert session.scalar(select(func.count()).select_from(Company)) == 2
        assert session.scalar(select(func.count()).select_from(Consent)) == 6
    for path in (
        "/api/v1/empresas",
        "/api/v1/cadastros",
        "/api/v1/cadastros/12345678909",
    ):
        assert env.client.get(path).status_code == 404


def test_profession_validation_unknown_inactive_and_duplicate_suggestion(
    environment: Environment,
) -> None:
    env = environment
    assert submit(env, professional_data(uuid4())).status_code == 422
    duplicate = professional_data(env.profession)
    duplicate["profissoes"].append({"sugestao": "PINTOR SINTETICO", "principal": False})
    assert submit(env, duplicate).status_code == 422
    with Session(env.engine) as session, session.begin():
        session.execute(update(Profession).values(ativo=False))
    assert submit(env).status_code == 422
    suggested = professional_data()
    assert submit(env, suggested).status_code == 201
    with Session(env.engine) as session:
        item = session.scalar(select(ProfessionChoice))
        assert (
            item is not None
            and item.profissao_id is None
            and item.sugestao == "Pintor Sintético"
        )


def test_multipart_idempotency_versions_and_image_limits(
    environment: Environment,
) -> None:
    env = environment
    endpoint = "/api/v1/cadastros/profissionais"
    assert (
        env.client.post(
            endpoint, files={"dados": (None, json.dumps(professional_data()))}
        ).status_code
        == 422
    )
    assert (
        env.client.post(
            endpoint,
            headers={"Idempotency-Key": "invalida"},
            files={"dados": (None, "{}")},
        ).status_code
        == 422
    )
    assert (
        submit(
            env,
            professional_data()
            | {
                "aceites": professional_data()["aceites"]
                | {"versao_termos": "anterior"}
            },
        ).status_code
        == 422
    )
    assert (
        env.client.post(
            endpoint,
            headers={"Idempotency-Key": str(uuid4())},
            files={"dados": (None, '{"cpf":"privado",INVALIDO')},
        ).status_code
        == 422
    )
    assert (
        env.client.post(
            endpoint, headers={"Idempotency-Key": str(uuid4())}, content=b"invalid"
        ).status_code
        == 422
    )
    assert (
        submit(
            env, images=[("desconhecido", ("x.png", png_bytes(), "image/png"))]
        ).status_code
        == 422
    )
    assert (
        submit(
            env, images=[("foto_perfil", ("x.png", png_bytes(), "image/png"))] * 2
        ).status_code
        == 422
    )
    assert (
        submit(
            env, images=[("fotos_trabalhos", ("x.png", png_bytes(), "image/png"))] * 7
        ).status_code
        == 422
    )
    assert (
        submit(
            env, images=[("foto_perfil", ("x.png", b"<svg></svg>", "image/png"))]
        ).status_code
        == 422
    )
    large = submit(
        env,
        company_data(),
        company=True,
        images=[("logo", ("x.png", b"x" * (5 * 1024 * 1024 + 1), "image/png"))],
    )
    assert large.status_code == 413
    for route, megabytes in (("profissionais", 41), ("empresas", 8)):
        assert (
            env.client.post(
                f"/api/v1/cadastros/{route}",
                headers={"Idempotency-Key": str(uuid4())},
                content=iter([b"x" * 1024 * 1024] * megabytes),
            ).status_code
            == 413
        )


def test_images_private_authenticated_and_no_filename_reflection(
    environment: Environment,
) -> None:
    env = environment
    images = [
        ("foto_perfil", ("pessoa-privada.png", png_bytes(), "image/png")),
        ("fotos_trabalhos", ("obra.png", png_bytes(), "image/png")),
    ]
    response = submit(env, images=images)
    assert response.status_code == 201
    with Session(env.engine) as session:
        records = list(session.scalars(select(PrivateFile)))
        assert {record.finalidade for record in records} == {
            "foto_perfil",
            "foto_trabalho",
        }
        assert all(record.estado == "pronto" for record in records)
        identifier = records[0].id
    target = f"/api/v1/admin/arquivos/{identifier}"
    assert env.client.get(target).status_code == 401
    manage_admin(
        env.settings,
        action="create",
        login="admin.teste",
        name="Admin Sintético",
        password="Senha sintética para arquivos!",
    )
    login = env.client.post(
        "/api/v1/admin/sessao",
        headers=ORIGIN,
        json={"login": "admin.teste", "senha": "Senha sintética para arquivos!"},
    )
    assert login.status_code == 200
    image = env.client.get(target)
    assert image.status_code == 200 and image.headers["content-type"] == "image/png"
    assert (
        image.headers["x-content-type-options"] == "nosniff"
        and image.headers["cache-control"] == "no-store"
    )
    assert "pessoa-privada" not in image.headers["content-disposition"]
    assert env.client.get(f"/api/v1/admin/arquivos/{uuid4()}").status_code == 404


def test_minor_rejected_without_writing_registration_or_images(
    environment: Environment,
) -> None:
    env = environment
    result = submit(
        env,
        professional_data(env.profession) | {"nascimento": "2020-01-01"},
        images=[("foto_perfil", ("x.png", png_bytes(), "image/png"))],
    )
    assert result.status_code == 422
    assert not env.store.objects
    with Session(env.engine) as session:
        assert session.scalar(select(func.count()).select_from(Registration)) == 0
        assert session.scalar(select(func.count()).select_from(PrivateFile)) == 0


def test_storage_failure_rolls_back_and_journal_can_be_reconciled(
    environment: Environment,
) -> None:
    env = environment
    env.store.fail = True
    result = submit(env, images=[("foto_perfil", ("x.png", png_bytes(), "image/png"))])
    assert result.status_code == 503
    with Session(env.engine) as session, session.begin():
        assert session.scalar(select(func.count()).select_from(Registration)) == 0
        assert session.scalar(select(func.count()).select_from(SubmissionKey)) == 0
        journal = session.scalar(select(UploadJournal))
        assert journal is not None and journal.estado == "reservado"
        journal.criado_em = datetime.now(UTC) - timedelta(hours=23)

    assert reconcile(env.engine, env.store, apply=True)["limpos"] == 0
    assert len(env.store.objects) == 1
    with Session(env.engine) as session, session.begin():
        journal = session.scalar(select(UploadJournal))
        assert journal is not None
        journal.criado_em = datetime.now(UTC) - timedelta(hours=25)
    assert env.store.objects
    assert reconcile(env.engine, env.store) == {
        "candidatos": 1,
        "limpos": 0,
        "em_uso": 0,
    }
    assert env.store.objects
    assert reconcile(env.engine, env.store, apply=True)["limpos"] == 1
    assert not env.store.objects


def test_reconciliation_never_deletes_linked_object(environment: Environment) -> None:
    env = environment
    assert (
        submit(
            env, images=[("foto_perfil", ("x.png", png_bytes(), "image/png"))]
        ).status_code
        == 201
    )
    with Session(env.engine) as session, session.begin():
        session.execute(
            update(UploadJournal).values(
                estado="reservado", criado_em=datetime.now(UTC) - timedelta(hours=25)
            )
        )
    result = reconcile(env.engine, env.store, apply=True)
    assert result["limpos"] == 0 and result["em_uso"] == 1
    assert len(env.store.objects) == 1


def test_concurrent_key_and_document_cannot_duplicate_registration(
    environment: Environment,
) -> None:
    env = environment
    key = uuid4()
    env.store.entered, env.store.release = Event(), Event()
    image = [("foto_perfil", ("x.png", png_bytes(), "image/png"))]
    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(submit, env, key=key, images=image)
        try:
            assert env.store.entered.wait(timeout=5)
            assert submit(env, key=key, images=image).status_code == 409
            assert submit(env, images=image).status_code == 409
        finally:
            env.store.release.set()
        assert first.result(timeout=10).status_code == 201
    with Session(env.engine) as session:
        assert session.scalar(select(func.count()).select_from(Registration)) == 1
        assert session.scalar(select(func.count()).select_from(PrivateFile)) == 1


def test_database_invariants_and_immutable_consents_and_history(
    environment: Environment,
) -> None:
    env = environment
    with pytest.raises(IntegrityError), Session(env.engine) as session, session.begin():
        session.add(
            Registration(
                protocolo="sintetico-sem-subtipo-para-teste", tipo="profissional"
            )
        )
    assert submit(env).status_code == 201
    with pytest.raises(IntegrityError), Session(env.engine) as session, session.begin():
        session.execute(update(ProfessionChoice).values(principal=False))
    for statement in (
        "UPDATE smart.aceites SET versao='forjada'",
        "DELETE FROM smart.aceites",
        "TRUNCATE smart.aceites",
        "UPDATE smart.historico_cadastros SET acao='forjada'",
        "DELETE FROM smart.historico_cadastros",
    ):
        with pytest.raises(DBAPIError), env.engine.begin() as connection:
            connection.execute(text(statement))


def test_rate_limit_gate_and_storage_readiness(environment: Environment) -> None:
    env = environment
    with Session(env.engine) as session, session.begin():
        session.add(
            SubmissionLimit(chave="global", inicio=datetime.now(UTC), tentativas=60)
        )
    assert submit(env).status_code == 429
    assert env.client.get("/api/v1/health/ready").status_code == 200
    env.store.fail = True
    assert env.client.get("/api/v1/health/ready").status_code == 503
    assert env.client.get("/api/v1/health/live").status_code == 200
    disabled = Settings(
        **(env.settings.model_dump() | {"registrations_enabled": False})
    )
    with TestClient(create_app(disabled, storage=env.store)) as client:
        result = client.post(
            "/api/v1/cadastros/profissionais", content=b"nao deve ser decodificado"
        )
        assert (
            result.status_code == 503
            and result.json()["code"] == "REGISTRATIONS_DISABLED"
        )


def test_failure_at_database_commit_never_confirms_upload(
    environment: Environment, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = environment
    original = registration_service.save_person

    def invalid_selection(
        session: Session,
        registration: Registration,
        data: registration_service.RegistrationData,
    ) -> None:
        original(session, registration, data)
        session.execute(update(ProfessionChoice).values(principal=False))

    monkeypatch.setattr(registration_service, "save_person", invalid_selection)
    response = submit(
        env, images=[("foto_perfil", ("x.png", png_bytes(), "image/png"))]
    )
    assert response.status_code == 409
    with Session(env.engine) as session:
        assert session.scalar(select(func.count()).select_from(Registration)) == 0
        assert session.scalar(select(func.count()).select_from(PrivateFile)) == 0
        journal = session.scalar(select(UploadJournal))
        assert journal is not None and journal.estado == "reservado"
    assert len(env.store.objects) == 1
