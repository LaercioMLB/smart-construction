from datetime import datetime
from uuid import UUID

from app.auth.schemas import Administrador, Contract
from app.profissoes.schemas import MetaPaginacao


class Alteracao(Contract):
    campo: str
    valor_anterior: str | None
    valor_atual: str | None


class Historico(Contract):
    id: UUID
    acao: str
    administrador: Administrador
    ocorrido_em: datetime
    motivo: str | None
    alteracoes: list[Alteracao]


class HistoricoPagina(Contract):
    data: list[Historico]
    meta: MetaPaginacao
