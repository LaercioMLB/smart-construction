from contextvars import ContextVar
from uuid import UUID, uuid4

from fastapi import Request
from pydantic import BaseModel, ConfigDict, Field
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

request_id_context: ContextVar[UUID | None] = ContextVar("request_id", default=None)


class ErroCampo(BaseModel):
    model_config = ConfigDict(extra="forbid")
    path: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=300)


class Erro(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=500)
    field_errors: list[ErroCampo]
    request_id: UUID


def error_response(
    status_code: int, code: str, message: str, fields: list[ErroCampo] | None = None
) -> JSONResponse:
    request_id = request_id_context.get() or uuid4()
    error = Erro(
        code=code, message=message, field_errors=fields or [], request_id=request_id
    )
    return JSONResponse(
        status_code=status_code,
        content=error.model_dump(mode="json"),
        headers={"Cache-Control": "no-store", "X-Request-ID": str(request_id)},
    )


async def http_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, HTTPException):
        return error_response(500, "INTERNAL_ERROR", "Erro interno.")
    if exc.status_code == 400 and request.url.path.startswith("/api/v1/cadastros/"):
        return error_response(
            422,
            "INVALID_MULTIPART",
            "Confira o formato, as partes e os limites do formulário.",
        )
    messages = {
        404: ("NOT_FOUND", "Recurso nao encontrado."),
        405: ("METHOD_NOT_ALLOWED", "Metodo nao permitido."),
        503: ("DEPENDENCY_UNAVAILABLE", "Servico temporariamente indisponivel."),
    }
    code, message = messages.get(
        exc.status_code, ("HTTP_ERROR", "Requisicao recusada.")
    )
    return error_response(exc.status_code, code, message)


async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return error_response(
        500, "INTERNAL_ERROR", "Nao foi possivel concluir a operacao."
    )
