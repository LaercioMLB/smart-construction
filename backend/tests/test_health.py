import json
import os
from pathlib import Path
from uuid import UUID

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from app.core.database import DatabaseNotReady
from app.core.settings import Settings
from app.main import create_app


class Probe:
    def __init__(self, *, ready: bool = True, unexpected: bool = False) -> None:
        self.ready = ready
        self.unexpected = unexpected
        self.calls = 0
        self.closed = False

    def check(self) -> None:
        self.calls += 1
        if self.unexpected:
            raise RuntimeError("private-database-address-and-password")
        if not self.ready:
            raise DatabaseNotReady("private-database-address-and-password")

    def close(self) -> None:
        self.closed = True


def planned_contract() -> dict:
    path = Path(
        os.environ.get(
            "SMART_TEST_CONTRACT_PATH",
            str(Path(__file__).resolve().parents[2] / "docs/api/openapi.json"),
        )
    )
    return json.loads(path.read_text(encoding="utf-8"))


def assert_schema(name: str, payload: object) -> None:
    contract = planned_contract()
    registry = Registry().with_resource(
        "urn:smart:planned",
        Resource.from_contents(contract, default_specification=DRAFT202012),
    )
    Draft202012Validator(
        {"$ref": f"urn:smart:planned#/components/schemas/{name}"}, registry=registry
    ).validate(payload)


def test_liveness_does_not_connect_to_database() -> None:
    probe = Probe(ready=False)
    with TestClient(create_app(readiness=probe)) as client:
        response = client.get("/api/v1/health/live")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert response.headers["cache-control"] == "no-store"
        UUID(response.headers["x-request-id"])
        assert probe.calls == 0
        assert_schema("Saude", response.json())
    assert probe.closed


def test_readiness_success_matches_contract() -> None:
    probe = Probe()
    with TestClient(create_app(readiness=probe)) as client:
        response = client.get("/api/v1/health/ready")
        assert response.status_code == 200
        assert probe.calls == 1
        assert_schema("Saude", response.json())


def test_unavailable_database_is_503_without_details() -> None:
    with TestClient(create_app(readiness=Probe(ready=False))) as client:
        response = client.get("/api/v1/health/ready")
        assert response.status_code == 503
        assert_schema("Erro", response.json())
        assert response.json()["request_id"] == response.headers["x-request-id"]
        assert "private-database" not in response.text
        assert response.headers["cache-control"] == "no-store"


def test_unexpected_error_does_not_expose_internal_details() -> None:
    with TestClient(
        create_app(readiness=Probe(unexpected=True)), raise_server_exceptions=False
    ) as client:
        response = client.get("/api/v1/health/ready")
        assert response.status_code == 500
        assert_schema("Erro", response.json())
        assert "private-database" not in response.text
        assert response.json()["request_id"] == response.headers["x-request-id"]
        assert response.headers["cache-control"] == "no-store"


def test_implemented_routes_match_contract_and_collection_is_disabled() -> None:
    with TestClient(create_app(readiness=Probe())) as client:
        schema = client.get("/openapi.json").json()
        assert schema["components"]["schemas"]["Saude"]["required"] == ["status"]
        assert schema["components"]["schemas"]["Erro"]["additionalProperties"] is False
        for path in schema["paths"]:
            for method, actual in schema["paths"][path].items():
                planned = planned_contract()["paths"][path.removeprefix("/api/v1")][
                    method
                ]
                assert actual["operationId"] == planned["operationId"]
                assert actual.get("security", []) == planned.get("security", [])
        for path in (
            "/api/v1/cadastros/profissionais",
            "/api/v1/cadastros/empresas",
        ):
            response = client.post(path, json={})
            assert response.status_code == 503
            assert response.json()["code"] == "REGISTRATIONS_DISABLED"
            assert_schema("Erro", response.json())


def test_production_does_not_expose_documentation() -> None:
    with TestClient(
        create_app(Settings(environment="production"), readiness=Probe())
    ) as client:
        for path in ("/docs", "/openapi.json", "/redoc"):
            assert client.get(path).status_code == 404
        assert client.get("/api/v1/health/live").status_code == 200


def test_registration_configuration_requires_flag_and_both_versions() -> None:
    for configuration, enabled in (
        (Settings(), False),
        (Settings(registrations_enabled=True, terms_version="teste-v1"), False),
        (
            Settings(
                registrations_enabled=True,
                terms_version="teste-v1",
                privacy_version="teste-v1",
            ),
            True,
        ),
    ):
        with TestClient(create_app(configuration, readiness=Probe())) as client:
            response = client.get("/api/v1/cadastros/configuracao")
            assert response.status_code == 200
            assert response.headers["cache-control"] == "no-store"
            assert response.json() == {
                "habilitado": enabled,
                "versao_termos": "teste-v1" if enabled else None,
                "versao_privacidade": "teste-v1" if enabled else None,
            }
            assert_schema("ConfiguracaoCadastro", response.json())


def test_request_ids_are_generated_not_reflected_from_input() -> None:
    with TestClient(create_app(readiness=Probe())) as client:
        first = client.get("/missing", headers={"X-Request-ID": "untrusted"})
        second = client.get("/missing")
        assert first.status_code == 404
        assert first.headers["x-request-id"] != second.headers["x-request-id"]
        UUID(first.headers["x-request-id"])
        assert first.json()["request_id"] == first.headers["x-request-id"]
