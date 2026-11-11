import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from conftest import DatabaseFixture
from registration_samples import company_data
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from test_analysis_integration import action, get_record, patch, sign_in
from test_cadastros_integration import Environment, submit
from test_cadastros_integration import environment as environment
from test_registration_validation import png_bytes

from app.arquivos.models import UploadJournal
from app.auditoria.models import AuditEvent
from app.auth.models import Administrator
from app.cadastros.models import (
    Consent,
    Registration,
)
from app.core.database import create_database_engine
from app.core.problems import ApiProblem
from app.retencao.ledger import Ledger, months_after
from app.retencao.models import Preservation, RetainedProof
from app.retencao.service import (
    compact_ledger,
    erase_registration,
    expire_files,
    expire_records,
    prepare_erasure,
    replay_erasures,
)

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("company", [False, True])
def test_erasure_is_minimal_and_allows_document_again(
    environment: Environment, database: DatabaseFixture, tmp_path: Path, company: bool
):
    env = environment
    data = company_data() if company else None
    images = [
        ("logo" if company else "foto_perfil", ("image.png", png_bytes(), "image/png"))
    ]
    assert submit(env, data, company=company, images=images).status_code == 201
    headers = sign_in(env)
    record = get_record(env, company=company)
    identifier = UUID(record["id"])
    with Session(env.engine) as session:
        actor = session.scalars(select(Administrator.id)).one()
    engine = create_database_engine(database.migration)
    ledger = Ledger(tmp_path / "ledger")
    ledger.initialize()
    try:
        entry = prepare_erasure(
            engine, ledger, identifier, actor, record["versao"], "solicitacao_titular"
        )
        assert erase_registration(engine, env.store, ledger, entry) == {
            "cadastros": 1,
            "arquivos": 1,
        }
        assert ledger.read().exclusoes == [] and len(env.store.objects) == 1
        with Session(engine) as session:
            assert session.get(Registration, identifier).encerrado_em is None
        entry = prepare_erasure(
            engine,
            ledger,
            identifier,
            actor,
            record["versao"],
            "solicitacao_titular",
            apply=True,
        )
        assert (
            patch(env, headers, record, {"email": "outro@example.test"}).json()["code"]
            == "REGISTRATION_CLOSED"
        )
        assert submit(env, data, company=company).status_code == 409
        env.store.fail = True
        with pytest.raises(ApiProblem):
            erase_registration(engine, env.store, ledger, entry, apply=True)
        with Session(engine) as session:
            assert (
                session.get(Registration, identifier).encerrado_em == entry.encerrado_em
            )
        env.store.fail = False
        entry_again = prepare_erasure(
            engine, ledger, identifier, actor, 999, "solicitacao_titular", apply=True
        )
        assert entry_again.encerrado_em == entry.encerrado_em
        assert (
            erase_registration(engine, env.store, ledger, entry, apply=True)[
                "cadastros"
            ]
            == 1
        )
        assert (
            erase_registration(engine, env.store, ledger, entry, apply=True)[
                "cadastros"
            ]
            == 0
        )
        assert env.store.objects == {}
        with Session(engine) as session:
            assert session.get(Registration, identifier) is None
            proof = session.get(RetainedProof, identifier)
            assert proof.expira_em == months_after(entry.encerrado_em, 24)
            encoded = json.dumps(proof.minimo)
            for forbidden in (
                "cpf",
                "cnpj",
                "whatsapp",
                "email",
                "alteracoes",
                "valor_anterior",
                "biografia",
                "razao_social",
                "chave",
            ):
                assert forbidden not in encoded
            assert session.scalar(select(func.count()).select_from(Consent)) == 0
            assert session.scalar(select(func.count()).select_from(UploadJournal)) == 0
        assert submit(env, data, company=company).status_code == 201
        # O UUID apagado não bloqueia o novo cadastro do mesmo documento.
        assert replay_erasures(engine, env.store, ledger, apply=True)["cadastros"] == 0
        assert env.client.get("/api/v1/admin/cadastros").json()["meta"]["total"] == 1
    finally:
        engine.dispose()


def test_hold_version_and_runtime_permissions(
    environment: Environment, database: DatabaseFixture, tmp_path: Path
):
    env = environment
    assert submit(env).status_code == 201
    sign_in(env)
    record = get_record(env)
    identifier = UUID(record["id"])
    ledger = Ledger(tmp_path / "ledger")
    ledger.initialize()
    engine = create_database_engine(database.migration)
    try:
        with Session(engine) as session, session.begin():
            actor = session.scalars(select(Administrator.id)).one()
            session.add(
                Preservation(
                    entidade_id=identifier,
                    referencia="caso-sintetico",
                    responsavel_id=actor,
                    registrado_em=datetime.now(UTC),
                    ate=datetime.now(UTC) + timedelta(days=10),
                )
            )
        with pytest.raises(ValueError, match="preservação"):
            prepare_erasure(
                engine, ledger, identifier, actor, 1, "fim_finalidade", apply=True
            )
        assert ledger.read().exclusoes == []
        with engine.begin() as connection:
            connection.execute(delete(Preservation))
        with pytest.raises(ValueError, match="versão"):
            prepare_erasure(
                engine, ledger, identifier, actor, 99, "fim_finalidade", apply=True
            )
        with pytest.raises(ValueError, match="credencial"):
            prepare_erasure(
                env.engine, ledger, identifier, actor, 1, "fim_finalidade", apply=True
            )
        for statement in (
            "DELETE FROM smart.aceites",
            "DELETE FROM smart.historico_cadastros",
            "DELETE FROM smart.auditoria",
            "SELECT * FROM smart.comprovantes_encerramento",
            "SELECT * FROM smart.preservacoes",
            "UPDATE smart.cadastros SET encerrado_em = now()",
        ):
            with pytest.raises(DBAPIError), env.engine.begin() as connection:
                connection.execute(text(statement))
    finally:
        engine.dispose()


def test_restore_replays_old_record_and_image(
    environment: Environment, database: DatabaseFixture, tmp_path: Path
):
    env = environment
    assert (
        submit(
            env, images=[("foto_perfil", ("image.png", png_bytes(), "image/png"))]
        ).status_code
        == 201
    )
    headers = sign_in(env)
    record = get_record(env)
    approved = action(env, headers, record, "aprovar").json()
    person_path = f"/api/v1/profissionais/{record['profissional_id']}"
    assert env.client.get(person_path).status_code == 200
    identifier = UUID(record["id"])
    engine = create_database_engine(database.migration)
    ledger = Ledger(tmp_path / "ledger")
    ledger.initialize()
    try:
        with Session(engine) as session:
            actor = session.scalars(select(Administrator.id)).one()
        entry = prepare_erasure(
            engine,
            ledger,
            identifier,
            actor,
            approved["versao"],
            "fim_finalidade",
            apply=True,
        )
        assert env.client.get(person_path).status_code == 404
        assert env.client.get("/api/v1/profissionais").json()["data"] == []
        # Simula DB anterior ao encerramento, preservando o registro externo atual.
        with engine.begin() as connection:
            connection.execute(update(Registration).values(encerrado_em=None))
        assert replay_erasures(engine, env.store, ledger)["cadastros"] == 1
        assert len(env.store.objects) == 1
        assert replay_erasures(engine, env.store, ledger, apply=True)["cadastros"] == 1
        assert env.client.get(person_path).status_code == 404 and not env.store.objects
        saved = ledger.read().exclusoes[0]
        assert saved.encerrado_em == entry.encerrado_em
        assert saved.expira_em == entry.expira_em
        assert saved.eliminado_em is not None
    finally:
        engine.dispose()


def test_expiry_uses_revocation_and_individual_event_times(
    environment: Environment, database: DatabaseFixture, tmp_path: Path
):
    env = environment
    assert (
        submit(
            env, images=[("foto_perfil", ("image.png", png_bytes(), "image/png"))]
        ).status_code
        == 201
    )
    headers = sign_in(env)
    record = get_record(env)
    identifier = UUID(record["id"])
    engine = create_database_engine(database.migration)
    ledger = Ledger(tmp_path / "ledger")
    ledger.initialize()
    try:
        file_id = record["arquivos"][0]["id"]
        path = f"/api/v1/admin/cadastros/{identifier}/arquivos/{file_id}"
        assert (
            env.client.delete(path, headers=headers | {"If-Match": '"1"'}).status_code
            == 200
        )
        moment = datetime.now(UTC)
        assert (
            expire_files(
                engine,
                env.store,
                ledger,
                moment=moment + timedelta(days=29),
                apply=True,
            )
            == 0
        )
        assert len(env.store.objects) == 1
        assert (
            expire_files(engine, env.store, ledger, moment=moment + timedelta(days=31))
            == 1
        )
        assert len(env.store.objects) == 1
        assert (
            expire_files(
                engine,
                env.store,
                ledger,
                moment=moment + timedelta(days=31),
                apply=True,
            )
            == 1
        )
        assert not env.store.objects
        with Session(engine) as session, session.begin():
            actor = session.scalars(select(Administrator.id)).one()
            old_id, new_id = uuid4(), uuid4()
            session.add_all(
                [
                    AuditEvent(
                        id=old_id,
                        administrador_id=actor,
                        entidade="profissao",
                        entidade_id=old_id,
                        acao="evento",
                        antes=None,
                        depois=None,
                        ocorrido_em=months_after(moment, -25),
                    ),
                    AuditEvent(
                        id=new_id,
                        administrador_id=actor,
                        entidade="profissao",
                        entidade_id=new_id,
                        acao="evento",
                        antes=None,
                        depois=None,
                        ocorrido_em=moment,
                    ),
                ]
            )
        assert expire_records(engine)["auditoria"] == 1
        assert expire_records(engine, apply=True)["auditoria"] == 1
        with Session(engine) as session:
            assert session.get(AuditEvent, old_id) is None
            assert session.get(AuditEvent, new_id) is not None
            assert session.get(Registration, identifier) is not None
    finally:
        engine.dispose()


def test_minimal_proof_and_audit_expiry_respect_holds_and_leap_year(
    environment: Environment, database: DatabaseFixture, tmp_path: Path
):
    from app.retencao.ledger import Erasure

    env = environment
    sign_in(env)
    engine = create_database_engine(database.migration)
    ledger = Ledger(tmp_path / "ledger")
    ledger.initialize()
    event_time = datetime(2024, 2, 29, 12, tzinfo=UTC)
    expiry = datetime(2026, 2, 28, 12, tzinfo=UTC)
    identifier, incident_id = uuid4(), uuid4()
    try:
        with Session(engine) as session, session.begin():
            actor = session.scalars(select(Administrator.id)).one()
            session.add(
                RetainedProof(
                    cadastro_id=identifier,
                    encerrado_em=event_time,
                    expira_em=expiry,
                    minimo={"acao": "encerrado"},
                )
            )
            session.add(
                Preservation(
                    entidade_id=identifier,
                    referencia="caso-sintetico",
                    responsavel_id=actor,
                    registrado_em=event_time,
                    ate=expiry + timedelta(days=1),
                )
            )
            session.add(
                AuditEvent(
                    id=incident_id,
                    administrador_id=actor,
                    entidade="incidente",
                    entidade_id=incident_id,
                    acao="evento",
                    antes=None,
                    depois=None,
                    ocorrido_em=event_time,
                )
            )
            session.add(
                AuditEvent(
                    administrador_id=actor,
                    entidade="profissao",
                    entidade_id=identifier,
                    acao="evento",
                    antes=None,
                    depois=None,
                    ocorrido_em=event_time,
                )
            )
        entry = Erasure(
            cadastro_id=identifier,
            encerrado_em=event_time,
            expira_em=expiry,
            administrador_id=actor,
            motivo="fim_finalidade",
            eventos=[],
            aceites=[],
        )
        ledger.erase(entry)
        assert expire_records(engine, apply=True, moment=expiry)["comprovantes"] == 0
        assert (
            compact_ledger(
                engine, ledger, apply=True, moment=expiry + timedelta(days=40)
            )["registros_externos"]
            == 0
        )
        # Intenção antiga ainda não concluída nunca perde proteção de restauração.
        ledger.finish(identifier, expiry + timedelta(days=39))
        assert (
            compact_ledger(engine, ledger, moment=expiry + timedelta(days=40))[
                "registros_externos"
            ]
            == 0
        )
        assert (
            expire_records(engine, apply=True, moment=expiry + timedelta(days=2))[
                "comprovantes"
            ]
            == 1
        )
        assert (
            compact_ledger(
                engine, ledger, apply=True, moment=expiry + timedelta(days=70)
            )["registros_externos"]
            == 1
        )
        with Session(engine) as session:
            assert session.get(AuditEvent, incident_id) is not None
            assert session.get(RetainedProof, identifier) is None
        # Evento de 29/02 vence em 28/02, incluindo o horário exato.
        with Session(engine) as session, session.begin():
            session.add(
                AuditEvent(
                    administrador_id=actor,
                    entidade="profissao",
                    entidade_id=uuid4(),
                    acao="evento",
                    antes=None,
                    depois=None,
                    ocorrido_em=event_time,
                )
            )
        assert (
            expire_records(engine, moment=expiry - timedelta(microseconds=1))[
                "auditoria"
            ]
            == 0
        )
        assert expire_records(engine, moment=expiry)["auditoria"] == 1
    finally:
        engine.dispose()


def test_preservation_created_after_backup_is_replayed_before_expiry(
    environment: Environment, database: DatabaseFixture, tmp_path: Path
):
    from app.retencao.ledger import PreservationRecord

    env = environment
    sign_in(env)
    engine = create_database_engine(database.migration)
    ledger = Ledger(tmp_path / "ledger")
    ledger.initialize()
    now = datetime.now(UTC)
    identifier = uuid4()
    try:
        with Session(engine) as session, session.begin():
            actor = session.scalars(select(Administrator.id)).one()
            session.add(
                RetainedProof(
                    cadastro_id=identifier,
                    encerrado_em=months_after(now, -25),
                    expira_em=months_after(now, -1),
                    minimo={"acao": "encerrado"},
                )
            )
        # O dump precedeu esta preservação. Apenas o registro externo está atual.
        hold = PreservationRecord(
            entidade_id=identifier,
            referencia="caso-sintetico",
            responsavel_id=actor,
            registrado_em=now,
            ate=now + timedelta(days=30),
        )
        ledger.preserve(hold)
        replay_erasures(engine, env.store, ledger, apply=True)
        assert expire_records(engine, apply=True)["comprovantes"] == 0
        with Session(engine) as session:
            assert session.get(RetainedProof, identifier) is not None
            assert session.get(Preservation, identifier).referencia == hold.referencia
            assert session.get(AuditEvent, hold.id) is not None
    finally:
        engine.dispose()
