from fastapi import Request
from starlette.responses import JSONResponse

from app.core.errors import error_response


class ApiProblem(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        self.status = status
        self.code = code
        self.message = message


async def problem_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, ApiProblem):
        return error_response(exc.status, exc.code, exc.message)
    return error_response(500, "INTERNAL_ERROR", "Erro interno.")
