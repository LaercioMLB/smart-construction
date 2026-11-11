from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import BeforeValidator, Field, JsonValue, model_validator

from app.auditoria.schemas import Alteracao
from app.auth.schemas import Administrador, Contract
from app.cadastros.schemas import EmpresaDados, ProfissionalDados
from app.cadastros.validation import plain_text
from app.profissoes.schemas import MetaPaginacao

Tipo = Literal["profissional", "empresa"]
Status = Literal["pendente", "aprovado", "reprovado"]


class ArquivoAdministrativo(Contract):
    id: UUID
    finalidade: Literal["foto_perfil", "foto_trabalho", "logo"]
    content_type: Literal["image/jpeg", "image/png"]
    tamanho_bytes: int
    estado: Literal["pronto", "processando", "erro"]
    ordem: int
    criado_em: datetime
    acesso_path: str


class Publicacao(Contract):
    publicado: bool
    revisao: int
    atualizado_em: datetime | None


class Aceite(Contract):
    tipo: Literal["termos", "privacidade", "publicacao", "maioridade"]
    versao: str
    aceito_em: datetime


class CadastroBase(Contract):
    id: UUID
    protocolo: str
    status: Status
    versao: int
    criado_em: datetime
    atualizado_em: datetime
    motivo_reprovacao: str | None
    arquivos: list[ArquivoAdministrativo]
    aceites: list[Aceite]


class CadastroProfissionalAdministrativo(CadastroBase):
    tipo: Literal["profissional"] = "profissional"
    profissional_id: UUID
    dados: ProfissionalDados
    publicacao: Publicacao


class CadastroEmpresaAdministrativo(CadastroBase):
    tipo: Literal["empresa"] = "empresa"
    empresa_id: UUID
    dados: EmpresaDados


CadastroAdministrativo = Annotated[
    CadastroProfissionalAdministrativo | CadastroEmpresaAdministrativo,
    Field(discriminator="tipo"),
]


class CadastroResumo(Contract):
    id: UUID
    protocolo: str
    tipo: Tipo
    nome_exibicao: str
    status: Status
    versao: int
    criado_em: datetime
    atualizado_em: datetime


class CadastrosPagina(Contract):
    data: list[CadastroResumo]
    meta: MetaPaginacao


class CadastroAlteracao(Contract):
    tipo: Tipo
    alteracoes: Annotated[dict[str, JsonValue], Field(min_length=1)]

    @model_validator(mode="after")
    def allowed(self) -> Self:
        fields = (
            ProfissionalDados.model_fields
            if self.tipo == "profissional"
            else EmpresaDados.model_fields
        )
        if not self.alteracoes.keys() <= fields.keys():
            raise ValueError("Campo não permitido para edição.")
        return self


class Motivo(Contract):
    motivo: Annotated[
        str, BeforeValidator(plain_text), Field(min_length=1, max_length=1000)
    ]


class HistoricoCadastro(Contract):
    id: UUID
    acao: str
    administrador: Administrador | None
    ocorrido_em: datetime
    motivo: str | None
    alteracoes: list[Alteracao]


class HistoricoCadastrosPagina(Contract):
    data: list[HistoricoCadastro]
    meta: MetaPaginacao


class ArquivoResultado(Contract):
    arquivo: ArquivoAdministrativo
    versao_cadastro: int


class ArquivoRemocaoResultado(Contract):
    arquivo_id: UUID
    versao_cadastro: int
