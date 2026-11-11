import re
import unicodedata
from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import Field, StringConstraints, field_validator, model_validator

from app.auth.schemas import Contract

Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)
]


def profession_slug(name: str) -> str:
    ascii_name = (
        unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    )
    return re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")


def clean_name(name: str) -> str:
    name = " ".join(name.split())
    if (
        len(name) < 2
        or len(profession_slug(name)) < 2
        or any(
            unicodedata.category(char).startswith("C") or char in "<>" for char in name
        )
    ):
        raise ValueError("Informe um nome de profissão válido.")
    return name


class ProfissaoCriacao(Contract):
    nome: Name
    ativo: bool = Field(default=True, strict=True)
    _name = field_validator("nome")(clean_name)


class ProfissaoAlteracao(Contract):
    nome: Name = Field(default_factory=str, validate_default=False)
    ativo: bool = Field(default=True, strict=True)
    _name = field_validator("nome")(clean_name)

    @model_validator(mode="after")
    def non_empty(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo.")
        return self


class ProfissaoPublica(Contract):
    id: UUID
    nome: str
    slug: str


class ProfissaoAdministrativa(ProfissaoPublica):
    ativo: bool
    versao: int
    criado_em: datetime
    atualizado_em: datetime


class MetaPaginacao(Contract):
    total: int
    page: int
    limit: int
    total_pages: int


class ProfissoesPublicas(Contract):
    data: list[ProfissaoPublica]
    meta: MetaPaginacao


class ProfissoesAdministrativas(Contract):
    data: list[ProfissaoAdministrativa]
    meta: MetaPaginacao
