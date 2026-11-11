from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from app.core.database import DatabaseNotReady, Readiness
from app.core.errors import Erro


class Saude(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["ok"]


def health_router(readiness: Readiness) -> APIRouter:
    router = APIRouter(prefix="/api/v1/health", tags=["Operacao"])

    @router.get("/live", response_model=Saude, operation_id="consultarLiveness")
    def live() -> Saude:
        return Saude(status="ok")

    @router.get(
        "/ready",
        response_model=Saude,
        operation_id="consultarReadiness",
        responses={503: {"model": Erro, "description": "Dependencia indisponivel."}},
    )
    def ready() -> Saude:
        try:
            readiness.check()
        except DatabaseNotReady:
            raise HTTPException(status_code=503) from None
        return Saude(status="ok")

    return router
