"""Projeções públicas explícitas, sem contatos, documentos ou endereço completo."""

from typing import Literal
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.auth.schemas import Contract
from app.cadastros.analysis import pagination, private_files, professional_data
from app.cadastros.models import (
    Address,
    Consent,
    Professional,
    ProfessionChoice,
    Publication,
    Registration,
)
from app.cadastros.schemas import UF, Curso
from app.core.calendar import adult_birth_cutoff
from app.core.problems import ApiProblem
from app.profissoes.models import Profession
from app.profissoes.schemas import MetaPaginacao


class LocalizacaoPublica(Contract):
    cidade: str
    uf: UF


class ProfissaoPublicada(Contract):
    id: UUID
    nome: str
    slug: str
    principal: bool


class ImagemPublica(Contract):
    id: UUID
    url: str
    ordem: int


class ProfissionalPublico(Contract):
    id: UUID
    nome: str
    biografia: str
    localizacao: LocalizacaoPublica
    profissoes: list[ProfissaoPublicada]
    cursos: list[Curso]
    foto_perfil: ImagemPublica | None
    fotos_trabalhos: list[ImagemPublica]


class ProfissaoFacet(Contract):
    id: UUID
    nome: str
    slug: str
    count: int


class Facets(Contract):
    profissoes: list[ProfissaoFacet]


class MetaProfissionais(MetaPaginacao):
    facets: Facets


class ProfissionaisPagina(Contract):
    data: list[ProfissionalPublico]
    meta: MetaProfissionais


def adult_eligibility() -> ColumnElement[bool]:
    return and_(
        select(Consent.cadastro_id)
        .where(
            Consent.cadastro_id == Professional.cadastro_id,
            Consent.tipo == "maioridade",
        )
        .exists(),
        or_(
            Professional.nascimento.is_(None),
            Professional.nascimento <= adult_birth_cutoff(),
        ),
    )


def published_person(session: Session, identifier: UUID) -> Professional:
    result = session.scalar(
        select(Professional)
        .join(Registration, Registration.id == Professional.cadastro_id)
        .join(Publication, Publication.profissional_id == Professional.id)
        .where(
            Professional.id == identifier,
            Registration.status == "aprovado",
            Registration.encerrado_em.is_(None),
            Publication.publicado.is_(True),
            adult_eligibility(),
        )
    )
    if result is None:
        raise ApiProblem(404, "NOT_FOUND", "Profissional não encontrado.")
    return result


def projection(session: Session, person: Professional) -> ProfissionalPublico:
    data = professional_data(session, person)
    professions = session.execute(
        select(Profession, ProfessionChoice.principal)
        .join(ProfessionChoice, ProfessionChoice.profissao_id == Profession.id)
        .where(ProfessionChoice.profissional_id == person.id)
        .order_by(ProfessionChoice.ordem)
    )
    images = [
        (
            item.finalidade,
            ImagemPublica(
                id=item.id,
                url=f"/api/v1/profissionais/{person.id}/imagens/{item.id}",
                ordem=item.ordem,
            ),
        )
        for item in private_files(session, person.cadastro_id)
        if item.estado == "pronto"
    ]
    return ProfissionalPublico(
        id=person.id,
        nome=person.nome,
        biografia=person.biografia,
        localizacao=LocalizacaoPublica(
            cidade=data.endereco.cidade, uf=data.endereco.uf
        ),
        profissoes=[
            ProfissaoPublicada(
                id=row.id, nome=row.nome, slug=row.slug, principal=primary
            )
            for row, primary in professions
        ],
        cursos=data.cursos,
        foto_perfil=next(
            (item for purpose, item in images if purpose == "foto_perfil"), None
        ),
        fotos_trabalhos=[
            item for purpose, item in images if purpose == "foto_trabalho"
        ],
    )


def list_public(
    session: Session,
    *,
    page: int,
    limit: int,
    search: str,
    city: str | None,
    uf: UF | None,
    professions: list[UUID],
    sort: Literal["relevancia", "nome"],
) -> ProfissionaisPagina:
    query = (
        select(Professional)
        .join(Registration, Registration.id == Professional.cadastro_id)
        .join(Publication, Publication.profissional_id == Professional.id)
        .join(Address, Address.cadastro_id == Registration.id)
        .where(
            Registration.status == "aprovado",
            Registration.encerrado_em.is_(None),
            Publication.publicado.is_(True),
            adult_eligibility(),
        )
    )
    if search.strip():
        query = query.where(
            Professional.nome.icontains(search.strip(), autoescape=True)
            | Professional.biografia.icontains(search.strip(), autoescape=True)
        )
    if city:
        query = query.where(func.lower(Address.cidade) == city.strip().lower())
    if uf:
        query = query.where(Address.uf == uf)
    candidates = query.with_only_columns(Professional.id).subquery()
    facets = session.execute(
        select(Profession, func.count(ProfessionChoice.profissional_id))
        .join(ProfessionChoice, ProfessionChoice.profissao_id == Profession.id)
        .where(ProfessionChoice.profissional_id.in_(select(candidates.c.id)))
        .group_by(Profession.id)
        .order_by(Profession.slug, Profession.id)
    )
    facet_response = [
        ProfissaoFacet(id=row.id, nome=row.nome, slug=row.slug, count=count)
        for row, count in facets
    ]
    if professions:
        query = query.where(
            Professional.id.in_(
                select(ProfessionChoice.profissional_id).where(
                    ProfessionChoice.profissao_id.in_(professions)
                )
            )
        )
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    # Sem pontuação fictícia: relevância usa criação decrescente com UUID de desempate.
    order = (
        (func.lower(Professional.nome), Professional.id)
        if sort == "nome"
        else (Registration.criado_em.desc(), Professional.id)
    )
    records = session.scalars(
        query.order_by(*order).offset((page - 1) * limit).limit(limit)
    )
    return ProfissionaisPagina(
        data=[projection(session, person) for person in records],
        meta=MetaProfissionais(
            **pagination(total, page, limit).model_dump(),
            facets=Facets(profissoes=facet_response),
        ),
    )
