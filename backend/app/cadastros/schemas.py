from datetime import date, datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    BeforeValidator,
    EmailStr,
    Field,
    StrictBool,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.auth.schemas import Contract
from app.cadastros.validation import cnpj, cpf, normalized_name, phone, plain_text
from app.core.calendar import require_adult_birth

Name = Annotated[
    str, BeforeValidator(plain_text), StringConstraints(min_length=3, max_length=150)
]
ShortText = Annotated[
    str, BeforeValidator(plain_text), StringConstraints(min_length=1, max_length=150)
]
DocumentCPF = Annotated[
    str,
    AfterValidator(cpf),
    Field(min_length=11, max_length=11, pattern=r"^[0-9]{11}$"),
]
DocumentCNPJ = Annotated[
    str,
    AfterValidator(cnpj),
    Field(min_length=14, max_length=14, pattern=r"^[A-Z0-9]{12}[0-9]{2}$"),
]
Phone = Annotated[
    str,
    AfterValidator(phone),
    Field(min_length=13, max_length=14, pattern=r"^\+55[1-9][0-9]{9,10}$"),
]
Email = Annotated[EmailStr, BeforeValidator(plain_text), Field(max_length=254)]
UF = Literal[
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
]


class EnderecoEntrada(Contract):
    cidade: Annotated[
        str, BeforeValidator(plain_text), Field(min_length=1, max_length=120)
    ]
    uf: UF
    cep: Annotated[str, Field(pattern=r"^[0-9]{8}$")] | None = None
    rua: (
        Annotated[str, BeforeValidator(plain_text), Field(min_length=1, max_length=200)]
        | None
    ) = None
    numero: (
        Annotated[str, BeforeValidator(plain_text), Field(min_length=1, max_length=30)]
        | None
    ) = None
    complemento: ShortText | None = None
    bairro: (
        Annotated[str, BeforeValidator(plain_text), Field(min_length=1, max_length=120)]
        | None
    ) = None


class Curso(Contract):
    nome: ShortText
    instituicao: ShortText | None = None
    inicio: Annotated[int, Field(ge=1900, le=9999, strict=True)] | None = None
    conclusao: Annotated[int, Field(ge=1900, le=9999, strict=True)] | None = None

    @model_validator(mode="after")
    def years(self) -> Self:
        current = date.today().year
        if any(
            year is not None and year > current
            for year in (self.inicio, self.conclusao)
        ):
            raise ValueError("Ano de curso não pode ser futuro.")
        if (
            self.inicio is not None
            and self.conclusao is not None
            and self.conclusao < self.inicio
        ):
            raise ValueError("Conclusão não pode anteceder o início do curso.")
        return self


class ProfissaoOficial(Contract):
    profissao_id: UUID
    principal: StrictBool


class ProfissaoSugerida(Contract):
    sugestao: Annotated[
        str, BeforeValidator(plain_text), Field(min_length=2, max_length=100)
    ]
    principal: StrictBool


class AceitesEmpresa(Contract):
    maior_de_idade: Literal[True]
    termos_aceitos: Literal[True]
    versao_termos: Annotated[str, Field(min_length=1, max_length=80)]
    privacidade_aceita: Literal[True]
    versao_privacidade: Annotated[str, Field(min_length=1, max_length=80)]

    @field_validator(
        "termos_aceitos", "privacidade_aceita", "maior_de_idade", mode="before"
    )
    @classmethod
    def explicit_true(cls, value: object) -> object:
        if value is not True:
            raise ValueError("O aceite explícito é obrigatório.")
        return value


class AceitesProfissional(AceitesEmpresa):
    autorizacao_publicacao: Literal[True]

    @field_validator("autorizacao_publicacao", mode="before")
    @classmethod
    def explicit_publication(cls, value: object) -> object:
        return cls.explicit_true(value)


class ProfissionalDados(Contract):
    nome: Name
    cpf: DocumentCPF
    nascimento: date | None = None
    whatsapp: Phone
    email: Email | None = None
    endereco: EnderecoEntrada
    biografia: Annotated[
        str, BeforeValidator(plain_text), Field(min_length=20, max_length=400)
    ]
    profissoes: Annotated[
        list[ProfissaoOficial | ProfissaoSugerida],
        Field(
            min_length=1,
            max_length=5,
            json_schema_extra={
                "uniqueItems": True,
                "contains": {
                    "type": "object",
                    "required": ["principal"],
                    "properties": {"principal": {"const": True}},
                },
                "minContains": 1,
                "maxContains": 1,
            },
        ),
    ]
    cursos: Annotated[list[Curso], Field(max_length=10)] = Field(default_factory=list)

    @field_validator("nascimento")
    @classmethod
    def birth(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Nascimento não pode ser futuro.")
        return value

    @field_validator("profissoes")
    @classmethod
    def profession_choices(
        cls, choices: list[ProfissaoOficial | ProfissaoSugerida]
    ) -> list[ProfissaoOficial | ProfissaoSugerida]:
        if sum(choice.principal for choice in choices) != 1:
            raise ValueError("Escolha exatamente uma profissão principal.")
        keys = [
            str(choice.profissao_id)
            if isinstance(choice, ProfissaoOficial)
            else normalized_name(choice.sugestao)
            for choice in choices
        ]
        if any(not key for key in keys) or len(set(keys)) != len(keys):
            raise ValueError("Profissões não podem se repetir.")
        return choices


class ProfissionalDadosEntrada(ProfissionalDados):
    aceites: AceitesProfissional

    @field_validator("nascimento")
    @classmethod
    def adult(cls, value: date | None) -> date | None:
        require_adult_birth(value)
        return value


class EmpresaDados(Contract):
    razao_social: Annotated[
        str, BeforeValidator(plain_text), Field(min_length=3, max_length=200)
    ]
    nome_fantasia: (
        Annotated[str, BeforeValidator(plain_text), Field(min_length=1, max_length=200)]
        | None
    ) = None
    cnpj: DocumentCNPJ
    responsavel: Name
    whatsapp: Phone
    email: Email | None = None
    segmento: ShortText
    endereco: EnderecoEntrada
    descricao: (
        Annotated[
            str, BeforeValidator(plain_text), Field(min_length=1, max_length=1000)
        ]
        | None
    ) = None


class EmpresaDadosEntrada(EmpresaDados):
    aceites: AceitesEmpresa


class Recebimento(Contract):
    protocolo: str = Field(min_length=20, max_length=100)
    status: Literal["pendente"]
    recebido_em: datetime


class ConfiguracaoCadastro(Contract):
    habilitado: bool
    versao_termos: str | None
    versao_privacidade: str | None
