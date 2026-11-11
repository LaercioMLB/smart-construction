from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy import Engine
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile

from app.arquivos.images import MAX_FILE_BYTES, PreparedImage, prepare_image
from app.arquivos.storage import PrivateStorage
from app.cadastros.schemas import (
    ConfiguracaoCadastro,
    EmpresaDadosEntrada,
    ProfissionalDadosEntrada,
    Recebimento,
)
from app.cadastros.service import accept_registration, registration_limit
from app.core.errors import Erro
from app.core.problems import ApiProblem
from app.core.settings import Settings


def registration_router(
    settings: Settings,
    engine: Callable[[], Engine],
    storage: Callable[[], PrivateStorage],
) -> APIRouter:
    router = APIRouter(
        prefix="/api/v1/cadastros",
        responses={code: {"model": Erro} for code in (403, 409, 413, 422, 429, 503)},
    )

    @router.get(
        "/configuracao",
        response_model=ConfiguracaoCadastro,
        operation_id="consultarConfiguracaoCadastro",
    )
    def configuration() -> ConfiguracaoCadastro:
        enabled = settings.registrations_enabled and bool(
            settings.terms_version and settings.privacy_version
        )
        return ConfiguracaoCadastro(
            habilitado=enabled,
            versao_termos=settings.terms_version if enabled else None,
            versao_privacidade=settings.privacy_version if enabled else None,
        )

    async def submit(request: Request, key: UUID, *, professional: bool) -> Recebimento:
        if (
            not settings.registrations_enabled
            or not settings.terms_version
            or not settings.privacy_version
        ):
            raise ApiProblem(
                503,
                "REGISTRATIONS_DISABLED",
                "Cadastros online temporariamente indisponíveis.",
            )
        origin = request.headers.get("origin")
        if origin is not None and (
            origin not in settings.allowed_origins
            or (
                settings.environment == "production"
                and not origin.startswith("https://")
            )
        ):
            raise ApiProblem(
                403, "ORIGIN_INVALID", "Origem da requisição não autorizada."
            )
        await run_in_threadpool(registration_limit, engine())
        if (
            not request.headers.get("content-type", "")
            .lower()
            .startswith("multipart/form-data;")
        ):
            raise ApiProblem(
                422,
                "INVALID_MULTIPART",
                "Envie dados e imagens como multipart/form-data.",
            )
        images: list[PreparedImage] = []
        async with request.form(
            max_files=7 if professional else 1, max_fields=1, max_part_size=32 * 1024
        ) as form:
            fields = list(form.multi_items())
            raw_data = form.getlist("dados")
            if len(raw_data) != 1 or not isinstance(raw_data[0], str):
                raise ApiProblem(
                    422,
                    "INVALID_DATA",
                    "Informe uma única parte textual dados com JSON válido.",
                )
            try:
                data = (
                    ProfissionalDadosEntrada.model_validate_json(raw_data[0])
                    if professional
                    else EmpresaDadosEntrada.model_validate_json(raw_data[0])
                )
            except ValidationError as exc:
                raise RequestValidationError(exc.errors()) from None
            allowed = (
                {"dados", "foto_perfil", "fotos_trabalhos"}
                if professional
                else {"dados", "logo"}
            )
            if any(name not in allowed for name, _ in fields):
                raise ApiProblem(
                    422, "INVALID_PART", "O formulário contém partes não reconhecidas."
                )
            for name in allowed - {"dados"}:
                files = form.getlist(name)
                maximum = 6 if name == "fotos_trabalhos" else 1
                if len(files) > maximum or any(
                    not isinstance(file, UploadFile) for file in files
                ):
                    raise ApiProblem(
                        422,
                        "INVALID_FILE_COUNT",
                        "Confira a finalidade e quantidade das imagens.",
                    )
            for name, value in fields:
                if name == "dados":
                    continue
                if not isinstance(value, UploadFile):
                    raise ApiProblem(
                        422,
                        "INVALID_IMAGE",
                        "A imagem deve ser uma parte binária do formulário.",
                    )
                raw = await value.read(MAX_FILE_BYTES + 1)
                purpose = "foto_trabalho" if name == "fotos_trabalhos" else name
                order = sum(item.purpose == purpose for item in images)
                images.append(
                    await run_in_threadpool(
                        prepare_image,
                        raw,
                        content_type=value.content_type or "",
                        purpose=purpose,
                        order=order,
                    )
                )
        # Ordem canônica: reorganizar partes multipart não muda o reenvio lógico.
        images.sort(key=lambda item: (item.purpose, item.order))
        return await run_in_threadpool(
            accept_registration, engine(), settings, storage(), data, images, key
        )

    multipart_description = {
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["dados"],
                        "properties": {
                            "dados": {
                                "type": "string",
                                "description": "JSON dos campos do profissional.",
                            },
                            "foto_perfil": {"type": "string", "format": "binary"},
                            "fotos_trabalhos": {
                                "type": "array",
                                "items": {"type": "string", "format": "binary"},
                                "maxItems": 6,
                            },
                        },
                    }
                }
            },
        }
    }

    @router.post(
        "/profissionais",
        status_code=201,
        response_model=Recebimento,
        operation_id="enviarCadastroProfissional",
        openapi_extra=multipart_description,
    )
    async def professional(
        request: Request, key: Annotated[UUID, Header(alias="Idempotency-Key")]
    ) -> Recebimento:
        return await submit(request, key, professional=True)

    @router.post(
        "/empresas",
        status_code=201,
        response_model=Recebimento,
        operation_id="enviarCadastroEmpresa",
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "multipart/form-data": {
                        "schema": {
                            "type": "object",
                            "required": ["dados"],
                            "properties": {
                                "dados": {
                                    "type": "string",
                                    "description": "JSON conforme EmpresaDadosEntrada.",
                                },
                                "logo": {"type": "string", "format": "binary"},
                            },
                        }
                    }
                },
            }
        },
    )
    async def company(
        request: Request, key: Annotated[UUID, Header(alias="Idempotency-Key")]
    ) -> Recebimento:
        return await submit(request, key, professional=False)

    return router
