import hashlib
import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

import pytest
from alembic import command
from botocore.exceptions import ClientError
from conftest import DatabaseFixture
from fastapi.testclient import TestClient
from registration_samples import company_data, professional_data
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_registration_validation import png_bytes

from app.arquivos.models import PrivateFile, UploadJournal
from app.arquivos.storage import S3PrivateStorage
from app.auth.cli import manage_admin
from app.core.database import create_database_engine
from app.core.settings import Settings
from app.main import create_app

pytestmark = pytest.mark.integration
ORIGIN = {"Origin": "http://127.0.0.1:3000"}


def storage_settings(database: DatabaseFixture) -> Settings:
    endpoint = os.environ.get("SMART_TEST_S3_ENDPOINT_URL")
    if not endpoint:
        pytest.skip("SeaweedFS privado de testes não configurado.")
    return Settings(
        **(
            database.runtime.model_dump()
            | {
                "registrations_enabled": True,
                "terms_version": "teste-v1",
                "privacy_version": "teste-v1",
                "s3_endpoint_url": endpoint,
                "s3_access_key_file": Path(os.environ["SMART_TEST_S3_ACCESS_KEY_FILE"]),
                "s3_secret_key_file": Path(os.environ["SMART_TEST_S3_SECRET_KEY_FILE"]),
            }
        )
    )


def remove_test_objects(store: S3PrivateStorage, keys: list[str]) -> None:
    # Chaves obtidas exclusivamente do banco smart_test_<uuid> deste teste.
    for key in keys:
        assert re.fullmatch(r"cadastros/[a-f0-9]{32}/[a-f0-9]{32}\.(jpg|png)", key)
        store.delete_verified(key)


def test_real_bucket_roundtrip_private_access_and_integrity(
    database: DatabaseFixture,
) -> None:
    command.upgrade(database.config(), "head")
    settings = storage_settings(database)
    store = S3PrivateStorage(settings)
    engine = create_database_engine(settings)
    try:
        store.check()
        manage_admin(
            settings,
            action="create",
            login="admin.storage",
            name="Admin Sintético",
            password="Senha sintética para storage!",
        )
        with TestClient(
            create_app(settings, storage=store), raise_server_exceptions=False
        ) as client:
            try:
                payload = professional_data()
                request_files = [
                    ("dados", (None, json.dumps(payload))),
                    ("foto_perfil", ("privado.png", png_bytes(), "image/png")),
                ]
                key = str(uuid4())
                response = client.post(
                    "/api/v1/cadastros/profissionais",
                    headers=ORIGIN | {"Idempotency-Key": key},
                    files=request_files,
                )
                assert response.status_code == 201
                assert (
                    client.post(
                        "/api/v1/cadastros/profissionais",
                        headers=ORIGIN | {"Idempotency-Key": key},
                        files=request_files,
                    ).json()
                    == response.json()
                )
                with Session(engine) as session:
                    record = session.scalar(select(PrivateFile))
                    assert record is not None
                    identifier, object_key, digest, size = (
                        record.id,
                        record.chave,
                        record.sha256,
                        record.tamanho_bytes,
                    )
                data = store.get(object_key, size, digest)
                assert hashlib.sha256(data).hexdigest() == digest
                for method in ("GET", "HEAD"):
                    with pytest.raises(HTTPError) as anonymous:
                        urlopen(
                            Request(
                                f"{settings.s3_endpoint_url}/{store.bucket}/{object_key}",
                                method=method,
                            ),
                            timeout=5,
                        )
                    assert anonymous.value.code == 403
                target = f"/api/v1/admin/arquivos/{identifier}"
                assert client.get(target).status_code == 401
                assert (
                    client.post(
                        "/api/v1/admin/sessao",
                        headers=ORIGIN,
                        json={
                            "login": "admin.storage",
                            "senha": "Senha sintética para storage!",
                        },
                    ).status_code
                    == 200
                )
                private = client.get(target)
                assert private.status_code == 200 and private.content == data
                assert private.headers["cache-control"] == "no-store"
                csrf = client.get("/api/v1/admin/sessao").json()["csrf_token"]
                headers = ORIGIN | {"X-CSRF-Token": csrf}
                profession = client.post(
                    "/api/v1/admin/profissoes",
                    headers=headers,
                    json={"nome": "Pintor Storage Sintético"},
                )
                assert profession.status_code == 201
                registration = client.get("/api/v1/admin/cadastros").json()["data"][0]
                admin_path = f"/api/v1/admin/cadastros/{registration['id']}"
                edited = client.patch(
                    admin_path,
                    headers=headers | {"If-Match": '"1"'},
                    json={
                        "tipo": "profissional",
                        "alteracoes": {
                            "profissoes": [
                                {
                                    "profissao_id": profession.json()["id"],
                                    "principal": True,
                                }
                            ]
                        },
                    },
                )
                assert edited.status_code == 200
                approved = client.post(
                    f"{admin_path}/aprovar", headers=headers | {"If-Match": '"2"'}
                )
                assert approved.status_code == 200
                person = approved.json()["profissional_id"]
                image_path = f"/api/v1/profissionais/{person}/imagens/{identifier}"
                assert client.get(image_path).content == data
                hidden = client.post(
                    f"/api/v1/admin/profissionais/{person}/despublicar",
                    headers=headers | {"If-Match": '"3"'},
                )
                assert (
                    hidden.status_code == 200
                    and client.get(image_path).status_code == 404
                )
                # Não transmitir conteúdo que diverge do hash persistido no banco.
                store.client.put_object(
                    Bucket=store.bucket,
                    Key=object_key,
                    Body=b"corrompido",
                    ContentType="image/png",
                )
                assert client.get(target).status_code == 503
                assert (
                    client.post(
                        f"/api/v1/admin/profissionais/{person}/publicar",
                        headers=headers | {"If-Match": '"4"'},
                    ).status_code
                    == 503
                )
            finally:
                with Session(engine) as session:
                    keys = list(session.scalars(select(UploadJournal.chave)))
                remove_test_objects(store, keys)
    finally:
        store.close()
        engine.dispose()


def test_company_logo_private_and_api_bucket_permissions_limited(
    database: DatabaseFixture,
) -> None:
    command.upgrade(database.config(), "head")
    settings = storage_settings(database)
    store = S3PrivateStorage(settings)
    engine = create_database_engine(settings)
    try:
        with TestClient(
            create_app(settings, storage=store), raise_server_exceptions=False
        ) as client:
            try:
                response = client.post(
                    "/api/v1/cadastros/empresas",
                    headers=ORIGIN | {"Idempotency-Key": str(uuid4())},
                    files=[
                        ("dados", (None, json.dumps(company_data()))),
                        ("logo", ("logo.png", png_bytes(), "image/png")),
                    ],
                )
                assert response.status_code == 201
                with Session(engine) as session:
                    file = session.scalar(select(PrivateFile))
                    assert file is not None and file.finalidade == "logo"
                    with pytest.raises(HTTPError) as anonymous:
                        urlopen(
                            f"{settings.s3_endpoint_url}/{store.bucket}/{file.chave}",
                            timeout=5,
                        )
                    assert anonymous.value.code == 403
                with pytest.raises(ClientError) as policy:
                    store.client.get_bucket_policy(Bucket=store.bucket)
                assert policy.value.response["Error"]["Code"] == "NoSuchBucketPolicy"
                with pytest.raises(ClientError) as change_policy:
                    store.client.put_bucket_policy(Bucket=store.bucket, Policy="{}")
                assert (
                    change_policy.value.response["ResponseMetadata"]["HTTPStatusCode"]
                    == 403
                )
                with pytest.raises(ClientError) as other_bucket:
                    store.client.list_objects_v2(Bucket="smart-assets")
                assert (
                    other_bucket.value.response["ResponseMetadata"]["HTTPStatusCode"]
                    == 403
                )
            finally:
                with Session(engine) as session:
                    keys = list(session.scalars(select(UploadJournal.chave)))
                remove_test_objects(store, keys)
    finally:
        store.close()
        engine.dispose()
