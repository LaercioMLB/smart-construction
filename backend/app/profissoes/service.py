from datetime import UTC, datetime
from math import ceil
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auditoria.models import AuditEvent, AuditValues
from app.auditoria.schemas import Alteracao, Historico, HistoricoPagina
from app.auth.models import Administrator
from app.auth.schemas import Administrador
from app.core.problems import ApiProblem
from app.profissoes.models import Profession
from app.profissoes.schemas import (
    MetaPaginacao,
    ProfissaoAdministrativa,
    ProfissaoAlteracao,
    ProfissaoCriacao,
    ProfissaoPublica,
    ProfissoesAdministrativas,
    ProfissoesPublicas,
    profession_slug,
)


def list_professions(
    session: Session,
    *,
    page: int,
    limit: int,
    search: str,
    active: bool | None,
    public: bool,
) -> ProfissoesAdministrativas | ProfissoesPublicas:
    query = select(Profession)
    if active is not None:
        query = query.where(Profession.ativo == active)
    normalized = profession_slug(search)
    if normalized:
        query = query.where(Profession.slug.contains(normalized, autoescape=True))
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    records = session.scalars(
        query.order_by(Profession.slug, Profession.id)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    meta = MetaPaginacao(
        total=total, page=page, limit=limit, total_pages=ceil(total / limit)
    )
    if public:
        return ProfissoesPublicas(
            data=[ProfissaoPublica.model_validate(row) for row in records], meta=meta
        )
    return ProfissoesAdministrativas(
        data=[ProfissaoAdministrativa.model_validate(row) for row in records], meta=meta
    )


def snapshot(record: Profession) -> AuditValues:
    return {
        "nome": record.nome,
        "slug": record.slug,
        "ativo": record.ativo,
        "versao": record.versao,
    }


def save(
    session: Session, record: Profession, actor: UUID, before: AuditValues | None
) -> ProfissaoAdministrativa:
    try:
        session.add(record)
        session.flush()
        session.add(
            AuditEvent(
                administrador_id=actor,
                entidade="profissao",
                entidade_id=record.id,
                acao="criar" if before is None else "editar",
                antes=before,
                depois=snapshot(record),
            )
        )
        session.flush()
    except IntegrityError:
        raise ApiProblem(
            409,
            "PROFESSION_EXISTS",
            "Já existe uma profissão com esse nome ou equivalente.",
        ) from None
    return ProfissaoAdministrativa.model_validate(record)


def create_profession(
    session: Session, data: ProfissaoCriacao, actor: UUID
) -> ProfissaoAdministrativa:
    record = Profession(
        nome=data.nome, slug=profession_slug(data.nome), ativo=data.ativo
    )
    return save(session, record, actor, None)


def edit_profession(
    session: Session,
    identifier: UUID,
    data: ProfissaoAlteracao,
    actor: UUID,
    expected_version: str | None,
) -> ProfissaoAdministrativa:
    if expected_version is None:
        raise ApiProblem(
            428, "VERSION_REQUIRED", "A versão da profissão é obrigatória."
        )
    record = session.scalar(
        select(Profession).where(Profession.id == identifier).with_for_update()
    )
    if record is None:
        raise ApiProblem(404, "NOT_FOUND", "Profissão não encontrada.")
    if expected_version != f'"{record.versao}"':
        raise ApiProblem(
            412,
            "VERSION_CONFLICT",
            "A profissão foi alterada. Recarregue a lista antes de editar.",
        )
    before = snapshot(record)
    if "nome" in data.model_fields_set:
        record.nome = data.nome
        record.slug = profession_slug(data.nome)
    if "ativo" in data.model_fields_set:
        record.ativo = data.ativo
    if before == snapshot(record):
        return ProfissaoAdministrativa.model_validate(record)
    record.versao += 1
    record.atualizado_em = datetime.now(UTC)
    return save(session, record, actor, before)


def profession_history(
    session: Session, identifier: UUID, page: int, limit: int
) -> HistoricoPagina:
    if session.get(Profession, identifier) is None:
        raise ApiProblem(404, "NOT_FOUND", "Profissão não encontrada.")
    query = (
        select(AuditEvent, Administrator)
        .join(Administrator, AuditEvent.administrador_id == Administrator.id)
        .where(AuditEvent.entidade == "profissao", AuditEvent.entidade_id == identifier)
    )
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    records = session.execute(
        query.order_by(AuditEvent.ocorrido_em.desc(), AuditEvent.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    events = []
    for record, admin in records:
        before, after = record.antes or {}, record.depois or {}
        changes = [
            Alteracao(
                campo=key,
                valor_anterior=str(before[key]) if key in before else None,
                valor_atual=str(after[key]) if key in after else None,
            )
            for key in sorted(before.keys() | after.keys())
            if before.get(key) != after.get(key)
        ]
        events.append(
            Historico(
                id=record.id,
                acao="criacao" if record.acao == "criar" else "edicao",
                administrador=Administrador.model_validate(admin),
                ocorrido_em=record.ocorrido_em,
                motivo=None,
                alteracoes=changes,
            )
        )
    return HistoricoPagina(
        data=events,
        meta=MetaPaginacao(
            total=total, page=page, limit=limit, total_pages=ceil(total / limit)
        ),
    )
