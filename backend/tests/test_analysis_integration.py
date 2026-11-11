import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pytest
from conftest import DatabaseFixture
from registration_samples import company_data, professional_data
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session
from test_cadastros_integration import Environment, submit
from test_cadastros_integration import environment as environment
from test_health import assert_schema
from test_registration_validation import png_bytes

from app.auth.cli import manage_admin
from app.cadastros.models import (
    Consent,
    Professional,
    Registration,
    RegistrationHistory,
)
from app.core.database import create_database_engine
from app.profissoes.models import Profession

pytestmark = pytest.mark.integration
ORIGIN = {"Origin": "http://127.0.0.1:3000"}
PASSWORD = "Senha sintética de análise!"


def test_minor_edit_and_legacy_minor_cannot_be_published(
    environment: Environment,
) -> None:
    env = environment
    assert submit(env).status_code == 201
    headers = sign_in(env)
    record = get_record(env)
    assert patch(env, headers, record, {"nascimento": "2020-01-01"}).status_code == 422
    with env.engine.begin() as connection:
        connection.execute(update(Professional).values(nascimento=date(2020, 1, 1)))
    denied = action(env, headers, record, "aprovar")
    assert denied.status_code == 409 and denied.json()["code"] == "ADULT_REQUIRED"
    assert env.client.get("/api/v1/profissionais").json()["data"] == []


def test_old_publication_without_adult_declaration_is_not_exposed(
    environment: Environment, database: DatabaseFixture
) -> None:
    env = environment
    assert (
        submit(
            env, images=[("foto_perfil", ("image.png", png_bytes(), "image/png"))]
        ).status_code
        == 201
    )
    headers = sign_in(env)
    record = get_record(env)
    approved = action(env, headers, record, "aprovar")
    assert approved.status_code == 200
    profile = f"/api/v1/profissionais/{record['profissional_id']}"
    assert env.client.get(profile).status_code == 200
    # Simula registro anterior à nova declaração, somente no banco descartável.
    migrator = create_database_engine(database.migration)
    try:
        with migrator.begin() as connection:
            connection.execute(delete(Consent).where(Consent.tipo == "maioridade"))
    finally:
        migrator.dispose()
    assert env.client.get(profile).status_code == 404
    assert (
        env.client.get(f"{profile}/imagens/{record['arquivos'][0]['id']}").status_code
        == 404
    )
    assert env.client.get("/api/v1/profissionais").json()["data"] == []
    hidden = action(env, headers, approved.json(), "despublicar")
    assert hidden.status_code == 200
    assert (
        action(env, headers, hidden.json(), "publicar").json()["code"]
        == "ADULT_DECLARATION_REQUIRED"
    )


def sign_in(env: Environment) -> dict[str, str]:
    manage_admin(
        env.settings,
        action="create",
        login="admin.analise",
        name="Administrador Sintético",
        password=PASSWORD,
    )
    result = env.client.post(
        "/api/v1/admin/sessao",
        headers=ORIGIN,
        json={"login": "admin.analise", "senha": PASSWORD},
    )
    assert result.status_code == 200
    return ORIGIN | {"X-CSRF-Token": result.json()["csrf_token"]}


def get_record(env: Environment, *, company=False):
    with Session(env.engine) as session:
        identifier = session.scalars(
            select(Registration.id).where(
                Registration.tipo == ("empresa" if company else "profissional")
            )
        ).one()
    response = env.client.get(f"/api/v1/admin/cadastros/{identifier}")
    assert response.status_code == 200
    assert_schema("CadastroAdministrativo", response.json())
    assert response.headers["etag"] == f'"{response.json()["versao"]}"'
    return response.json()


def action(env, headers, record, name, body=None, version=None):
    path = f"/api/v1/admin/cadastros/{record['id']}/{name}"
    if name in ["publicar", "despublicar"]:
        path = f"/api/v1/admin/profissionais/{record['profissional_id']}/{name}"
    return env.client.post(
        path,
        headers=headers | {"If-Match": version or f'"{record["versao"]}"'},
        json=body,
    )


def patch(env, headers, record, changes, version=None):
    return env.client.patch(
        f"/api/v1/admin/cadastros/{record['id']}",
        headers=headers | {"If-Match": version or f'"{record["versao"]}"'},
        json={"tipo": record["tipo"], "alteracoes": changes},
    )


def test_authorization_filters_etags_and_audited_correction(environment: Environment):
    env = environment
    assert submit(env).status_code == 201
    assert submit(env, company_data(), company=True).status_code == 201
    assert env.client.get("/api/v1/admin/cadastros").status_code == 401
    headers = sign_in(env)
    record = get_record(env)
    path = f"/api/v1/admin/cadastros/{record['id']}"
    assert (
        env.client.patch(
            path,
            headers=ORIGIN,
            json={"tipo": "profissional", "alteracoes": {"nome": "Outro Nome"}},
        ).status_code
        == 403
    )
    assert (
        env.client.patch(
            path,
            headers=headers,
            json={"tipo": "profissional", "alteracoes": {"nome": "Outro Nome"}},
        ).status_code
        == 428
    )
    for changes in [
        {"status": "aprovado"},
        {"aceites": {}},
        {"cpf": "00000000000"},
        {"nome": None},
        {"cursos": [{"nome": "Teste", "inicio": 2024, "conclusao": 2020}]},
        {"profissoes": []},
    ]:
        assert patch(env, headers, record, changes).status_code == 422
    response = env.client.get(
        "/api/v1/admin/cadastros?tipo=empresa&status=pendente&limit=1"
    )
    assert_schema("CadastrosPagina", response.json())
    assert (
        response.json()["meta"]["total"] == 1
        and response.json()["data"][0]["tipo"] == "empresa"
    )
    assert (
        env.client.get("/api/v1/admin/cadastros?search=%25").json()["meta"]["total"]
        == 0
    )
    assert env.client.get("/api/v1/admin/cadastros?page=999").json()["data"] == []
    changed = patch(
        env,
        headers,
        record,
        {"nome": "Profissional Corrigido", "nascimento": "1990-01-01", "email": None},
    )
    assert changed.status_code == 200
    assert changed.json()["versao"] == 2 and changed.json()["status"] == "pendente"
    assert patch(env, headers, record, {"nome": "Edição Antiga"}).status_code == 412
    no_op = patch(env, headers, changed.json(), {"nome": "Profissional Corrigido"})
    assert no_op.status_code == 200 and no_op.json()["versao"] == 2
    events = env.client.get(f"{path}/historico").json()
    assert_schema("HistoricoPagina", events)
    assert (
        len(events["data"]) == 2
        and events["data"][0]["administrador"]["login"] == "admin.analise"
    )
    assert events["data"][1]["administrador"] is None
    assert any(
        item["campo"] == "nome" and item["valor_atual"] == "Profissional Corrigido"
        for item in events["data"][0]["alteracoes"]
    )
    with Session(env.engine) as session:
        assert session.scalar(select(func.count()).select_from(Consent)) == 7


def test_reject_reopen_same_record_and_company_stays_private(environment: Environment):
    env = environment
    assert submit(env, company_data(), company=True).status_code == 201
    headers = sign_in(env)
    record = get_record(env, company=True)
    assert action(env, headers, record, "reprovar", {"motivo": "  "}).status_code == 422
    rejected = action(
        env, headers, record, "reprovar", {"motivo": "Informação sintética a corrigir."}
    )
    assert rejected.status_code == 200 and rejected.json()["status"] == "reprovado"
    assert action(env, headers, rejected.json(), "aprovar").status_code == 409
    assert submit(env, company_data(), company=True).status_code == 409
    reopened = action(env, headers, rejected.json(), "reabrir")
    assert (
        reopened.status_code == 200
        and reopened.json()["protocolo"] == record["protocolo"]
    )
    assert reopened.json()["motivo_reprovacao"] is None
    approved = action(env, headers, reopened.json(), "aprovar")
    assert approved.status_code == 200 and approved.json()["status"] == "aprovado"
    assert "publicacao" not in approved.json()
    assert env.client.get("/api/v1/profissionais").json()["data"] == []


def test_suggestions_must_be_resolved_and_inactive_existing_preserved(
    environment: Environment,
):
    env = environment
    data = professional_data()  # Sugestão privada.
    assert submit(env, data).status_code == 201
    headers = sign_in(env)
    record = get_record(env)
    assert action(env, headers, record, "aprovar").status_code == 409
    resolved = patch(
        env,
        headers,
        record,
        {"profissoes": [{"profissao_id": str(env.profession), "principal": True}]},
    )
    assert resolved.status_code == 200
    with Session(env.engine) as session, session.begin():
        session.execute(
            update(Profession)
            .where(Profession.id == env.profession)
            .values(ativo=False)
        )
    edited = patch(env, headers, resolved.json(), {"nome": "Nome com vínculo inativo"})
    assert edited.status_code == 200
    assert action(env, headers, edited.json(), "aprovar").status_code == 200


def test_publication_privacy_images_edit_unpublish_and_republish(
    environment: Environment,
):
    env = environment
    assert (
        submit(
            env, images=[("foto_perfil", ("imagem.png", png_bytes(), "image/png"))]
        ).status_code
        == 201
    )
    headers = sign_in(env)
    record = get_record(env)
    person = record["profissional_id"]
    file = record["arquivos"][0]["id"]
    path = f"/api/v1/profissionais/{person}"
    image = f"{path}/imagens/{file}"
    assert (
        env.client.get(path).status_code == 404
        and env.client.get(image).status_code == 404
    )
    approved = action(env, headers, record, "aprovar")
    assert approved.status_code == 200 and approved.json()["publicacao"]["publicado"]
    public = env.client.get(path)
    assert_schema("ProfissionalPublico", public.json())
    serialized = json.dumps(public.json())
    for field in [
        "cpf",
        "nascimento",
        "whatsapp",
        "email",
        "cep",
        "rua",
        "protocolo",
        "aceites",
        "historico",
        "rating",
    ]:
        assert f'"{field}"' not in serialized
    assert env.client.get(image).status_code == 200
    assert env.client.get(image).headers["cache-control"] == "no-store"
    listing = env.client.get("/api/v1/profissionais?sort_by=nome").json()
    assert_schema("ProfissionaisPagina", listing)
    assert listing["meta"]["facets"]["profissoes"][0]["count"] == 1
    assert (
        env.client.get("/api/v1/profissionais?cidade=Inexistente").json()["data"] == []
    )
    edited = patch(env, headers, approved.json(), {"nome": "Nome Público Corrigido"})
    assert edited.status_code == 200 and edited.json()["status"] == "aprovado"
    assert env.client.get(path).json()["nome"] == "Nome Público Corrigido"
    assert edited.json()["publicacao"]["revisao"] == 2
    hidden = action(env, headers, edited.json(), "despublicar")
    assert hidden.status_code == 200 and hidden.json()["status"] == "aprovado"
    assert (
        env.client.get(path).status_code == 404
        and env.client.get(image).status_code == 404
    )
    assert env.client.get("/api/v1/profissionais").json()["meta"]["total"] == 0
    assert action(env, headers, hidden.json(), "publicar").status_code == 200
    assert env.client.get(path).status_code == 200


def test_storage_failure_prevents_approval_and_partial_changes(
    environment: Environment,
):
    env = environment
    assert (
        submit(
            env, images=[("foto_perfil", ("imagem.png", png_bytes(), "image/png"))]
        ).status_code
        == 201
    )
    headers = sign_in(env)
    record = get_record(env)
    from app.core.problems import ApiProblem

    def failing_get(*args):
        raise ApiProblem(503, "STORAGE_UNAVAILABLE", "Armazenamento indisponível.")

    env.store.get = failing_get
    assert action(env, headers, record, "aprovar").status_code == 503
    after = get_record(env)
    assert (
        after["status"] == "pendente"
        and after["versao"] == 1
        and not after["publicacao"]["publicado"]
    )


def test_concurrent_decisions_have_one_winner(environment: Environment):
    env = environment
    assert submit(env).status_code == 201
    headers = sign_in(env)
    record = get_record(env)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(
                lambda _: action(env, headers, record, "aprovar").status_code, range(2)
            )
        )
    assert sorted(results) == [200, 412]
    with Session(env.engine) as session:
        assert (
            session.scalar(select(func.count()).select_from(RegistrationHistory)) == 2
        )


def test_image_replacement_removal_and_cross_registration_access(
    environment: Environment,
):
    env = environment
    assert submit(env).status_code == 201
    assert submit(env, company_data(), company=True).status_code == 201
    headers = sign_in(env)
    record = get_record(env)
    company = get_record(env, company=True)
    path = f"/api/v1/admin/cadastros/{record['id']}/arquivos"

    def upload(current, purpose="foto_perfil", content=None):
        return env.client.post(
            path,
            headers=headers | {"If-Match": f'"{current["versao"]}"'},
            data={"finalidade": purpose},
            files={
                "arquivo": (
                    "image.png",
                    content if content is not None else png_bytes(),
                    "image/png",
                )
            },
        )

    assert upload(record, "logo").status_code == 422
    assert upload(record, content=b"invalid").status_code == 422
    first = upload(record)
    assert first.status_code == 201
    assert_schema("ArquivoResultado", first.json())
    record = get_record(env)
    old = record["arquivos"][0]["id"]
    assert upload(record).status_code == 201
    record = get_record(env)
    new = record["arquivos"][0]["id"]
    assert (
        old != new
        and env.client.get(f"/api/v1/admin/arquivos/{old}").status_code == 404
    )
    assert (
        len(env.store.objects) == 2
    )  # Objetos retidos; referências antigas revogadas.
    cross = env.client.delete(
        f"/api/v1/admin/cadastros/{company['id']}/arquivos/{new}",
        headers=headers | {"If-Match": '"1"'},
    )
    assert cross.status_code == 404
    approved = action(env, headers, record, "aprovar").json()
    image = f"/api/v1/profissionais/{record['profissional_id']}/imagens/{new}"
    assert env.client.get(image).status_code == 200
    removed = env.client.delete(
        f"{path}/{new}", headers=headers | {"If-Match": f'"{approved["versao"]}"'}
    )
    assert removed.status_code == 200
    assert_schema("ArquivoRemocaoResultado", removed.json())
    assert env.client.get(image).status_code == 404
    assert get_record(env)["arquivos"] == []


def test_duplicate_document_edit_rolls_back_and_upload_failure_preserves_previous(
    environment: Environment,
):
    env = environment
    assert submit(env).status_code == 201
    second = professional_data(env.profession) | {
        "cpf": "11144477735",
        "nome": "Segundo Profissional",
    }
    assert submit(env, second).status_code == 201
    headers = sign_in(env)
    records = env.client.get("/api/v1/admin/cadastros").json()["data"]
    record = env.client.get(f"/api/v1/admin/cadastros/{records[0]['id']}").json()
    assert record["dados"]["cpf"] == second["cpf"]
    conflict = patch(env, headers, record, {"cpf": "12345678909"})
    assert conflict.status_code == 409
    assert (
        env.client.get(f"/api/v1/admin/cadastros/{record['id']}").json()["versao"] == 1
    )
    path = f"/api/v1/admin/cadastros/{record['id']}/arquivos"
    files = {"arquivo": ("image.png", png_bytes(), "image/png")}
    version = headers | {"If-Match": '"1"'}
    assert (
        env.client.post(
            path,
            headers=version,
            data={"finalidade": "foto_perfil", "chave": "arbitraria"},
            files=files,
        ).status_code
        == 422
    )
    first = env.client.post(
        path, headers=version, data={"finalidade": "foto_perfil"}, files=files
    )
    assert first.status_code == 201
    identifier = first.json()["arquivo"]["id"]
    env.store.fail = True
    failed = env.client.post(
        path,
        headers=headers | {"If-Match": '"2"'},
        data={"finalidade": "foto_perfil"},
        files=files,
    )
    assert failed.status_code == 503
    current = env.client.get(f"/api/v1/admin/cadastros/{record['id']}").json()
    assert current["versao"] == 2 and current["arquivos"][0]["id"] == identifier
