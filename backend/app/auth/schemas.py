from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, StringConstraints


class Contract(BaseModel):
    model_config = ConfigDict(
        extra="forbid", from_attributes=True, hide_input_in_errors=True
    )


LoginName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)
]


class Login(Contract):
    login: LoginName
    senha: SecretStr = Field(min_length=1, max_length=256)


class Administrador(Contract):
    id: UUID
    nome: str
    login: str


class Sessao(Contract):
    administrador: Administrador
    expira_em: datetime
    csrf_token: str
