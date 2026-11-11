from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.admin_routes import admin_router
from app.arquivos.storage import PrivateStorage, S3PrivateStorage
from app.cadastros.routes import registration_router
from app.cadastros.schemas import EmpresaDadosEntrada, ProfissionalDadosEntrada
from app.core.body_limit import AdminBodyLimit
from app.core.database import Database, Readiness
from app.core.errors import (
    ErroCampo,
    error_response,
    http_error_handler,
    request_id_context,
    unexpected_error_handler,
)
from app.core.problems import ApiProblem, problem_handler
from app.core.settings import Settings
from app.health.routes import health_router


def create_app(
    settings: Settings | None = None,
    readiness: Readiness | None = None,
    storage: PrivateStorage | None = None,
) -> FastAPI:
    configuration = settings if settings is not None else Settings()
    database = readiness if readiness is not None else Database(configuration)
    store = storage

    def private_storage() -> PrivateStorage:
        nonlocal store
        if store is None:
            try:
                store = S3PrivateStorage(configuration)
            except RuntimeError:
                raise ApiProblem(
                    503, "STORAGE_UNAVAILABLE", "Armazenamento privado indisponível."
                ) from None
        return store

    class CombinedReadiness:
        def check(self) -> None:
            database.check()
            if configuration.registrations_enabled:
                private_storage().check()

        def close(self) -> None:
            database.close()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            database.close()
            if store is not None:
                store.close()

    development = configuration.environment != "production"
    application = FastAPI(
        title="Smart Construction — API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if development else None,
        redoc_url=None,
        openapi_url="/openapi.json" if development else None,
    )
    application.add_exception_handler(HTTPException, http_error_handler)
    application.add_exception_handler(Exception, unexpected_error_handler)
    application.add_exception_handler(ApiProblem, problem_handler)

    async def invalid_input(request: Request, exc: Exception) -> Response:
        fields = []
        if isinstance(exc, RequestValidationError):
            fields = [
                ErroCampo(
                    path=".".join(str(part) for part in issue["loc"])[:200] or "body",
                    code="INVALID_VALUE",
                    message="Valor inválido ou fora dos limites.",
                )
                for issue in exc.errors()[:20]
            ]
        return error_response(
            422,
            "VALIDATION_ERROR",
            "Confira os campos informados e seus limites.",
            fields,
        )

    async def unavailable(request: Request, exc: Exception) -> Response:
        return error_response(
            503, "DEPENDENCY_UNAVAILABLE", "Serviço temporariamente indisponível."
        )

    application.add_exception_handler(RequestValidationError, invalid_input)
    application.add_exception_handler(SQLAlchemyError, unavailable)
    application.add_middleware(AdminBodyLimit, settings=configuration)

    @application.middleware("http")
    async def response_context(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = uuid4()
        token = request_id_context.set(request_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = str(request_id)
            response.headers["Cache-Control"] = "no-store"
            return response
        finally:
            request_id_context.reset(token)

    application.include_router(health_router(CombinedReadiness()))

    def business_engine() -> Engine:
        if not isinstance(database, Database):
            raise ApiProblem(
                503, "DEPENDENCY_UNAVAILABLE", "Banco de dados indisponível."
            )
        return database.engine

    application.include_router(
        admin_router(configuration, business_engine, private_storage)
    )
    application.include_router(
        registration_router(configuration, business_engine, private_storage)
    )
    # FastAPI combina dependências Security como alternativas (OR) na documentação.
    # As escritas exigem sessão E CSRF; expressar a mesma regra no OpenAPI servido.
    schema = application.openapi()
    components = schema["components"]["schemas"]
    # O PATCH valida os campos presentes e depois o conjunto completo resultante.
    # Documentar as mesmas propriedades da entrada, sem tornar campos omitidos nulos.
    from app.cadastros.schemas import EmpresaDados, ProfissionalDados

    alternatives = []
    for kind, data_model, changes_name in (
        ("profissional", ProfissionalDados, "ProfissionalAlteracoes"),
        ("empresa", EmpresaDados, "EmpresaAlteracoes"),
    ):
        definition = data_model.model_json_schema(
            ref_template="#/components/schemas/{model}"
        )
        components.update(definition.pop("$defs", {}))
        definition.pop("required", None)
        definition["minProperties"] = 1
        components[changes_name] = definition
        alternatives.append(
            {
                "type": "object",
                "additionalProperties": False,
                "required": ["tipo", "alteracoes"],
                "properties": {
                    "tipo": {"const": kind, "type": "string"},
                    "alteracoes": {"$ref": f"#/components/schemas/{changes_name}"},
                },
            }
        )
    components["CadastroAlteracao"] = {
        "oneOf": alternatives,
        "discriminator": {"propertyName": "tipo"},
    }
    for registration_model in (ProfissionalDadosEntrada, EmpresaDadosEntrada):
        definition = registration_model.model_json_schema(
            ref_template="#/components/schemas/{model}"
        )
        components.update(definition.pop("$defs", {}))
        components[registration_model.__name__] = definition
    for kind, model_name in (
        ("profissionais", "ProfissionalDadosEntrada"),
        ("empresas", "EmpresaDadosEntrada"),
    ):
        operation = schema["paths"][f"/api/v1/cadastros/{kind}"]["post"]
        multipart = operation["requestBody"]["content"]["multipart/form-data"]["schema"]
        multipart["additionalProperties"] = False
        multipart["properties"]["dados"].update(
            {
                "contentMediaType": "application/json",
                "contentSchema": {"$ref": f"#/components/schemas/{model_name}"},
            }
        )
        operation["description"] = (
            "Exige habilitação explícita e versões dos aceites configuradas. "
            "Desabilitado por padrão."
        )
    schema["x-registrations-enabled"] = configuration.registrations_enabled and bool(
        configuration.terms_version and configuration.privacy_version
    )
    for path, operations in schema["paths"].items():
        for method, operation in operations.items():
            if path.startswith("/api/v1/admin/"):
                if path == "/api/v1/admin/sessao" and method == "post":
                    operation["security"] = []
                elif method in ("post", "patch", "delete"):
                    operation["security"] = [{"AdminSession": [], "CsrfToken": []}]
                else:
                    operation["security"] = [{"AdminSession": []}]
            for parameter in operation.get("parameters", []):
                if parameter.get("name") == "If-Match":
                    parameter["required"] = True
                    parameter["schema"] = {
                        "type": "string",
                        "pattern": '^"[1-9][0-9]*"$',
                    }
    return application
