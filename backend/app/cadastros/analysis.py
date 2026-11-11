"""Análise e correção: lock do cadastro, versão e histórico na mesma transação."""

import json
from datetime import UTC, datetime
from math import ceil
from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.arquivos.models import PrivateFile
from app.arquivos.storage import PrivateStorage
from app.auth.models import Administrator
from app.auth.schemas import Administrador
from app.cadastros.admin_schemas import (
    Aceite,
    ArquivoAdministrativo,
    CadastroAdministrativo,
    CadastroAlteracao,
    CadastroEmpresaAdministrativo,
    CadastroProfissionalAdministrativo,
    CadastroResumo,
    CadastrosPagina,
    HistoricoCadastro,
    HistoricoCadastrosPagina,
    Publicacao,
    Status,
    Tipo,
)
from app.cadastros.models import (
    Address,
    Company,
    Consent,
    Professional,
    ProfessionalCourse,
    ProfessionChoice,
    Publication,
    Registration,
    RegistrationHistory,
)
from app.cadastros.schemas import (
    Curso,
    EmpresaDados,
    EnderecoEntrada,
    ProfissaoOficial,
    ProfissaoSugerida,
    ProfissionalDados,
)
from app.cadastros.validation import normalized_name
from app.core.calendar import require_adult_birth
from app.core.problems import ApiProblem
from app.profissoes.models import Profession
from app.profissoes.schemas import MetaPaginacao


def pagination(total: int, page: int, limit: int) -> MetaPaginacao:
    return MetaPaginacao(
        total=total, page=page, limit=limit, total_pages=ceil(total / limit)
    )


def registration(
    session: Session,
    identifier: UUID,
    expected: str | None = None,
    *,
    lock: bool = False,
) -> Registration:
    if lock and expected is None:
        raise ApiProblem(428, "VERSION_REQUIRED", "A versão do cadastro é obrigatória.")
    query = select(Registration).where(Registration.id == identifier)
    if lock:
        query = query.with_for_update()
    record = session.scalar(query)
    if record is None:
        raise ApiProblem(404, "NOT_FOUND", "Cadastro não encontrado.")
    if lock and record.encerrado_em is not None:
        raise ApiProblem(
            409, "REGISTRATION_CLOSED", "Cadastro encerrado definitivamente."
        )
    if lock and expected != f'"{record.versao}"':
        raise ApiProblem(
            412,
            "VERSION_CONFLICT",
            "O cadastro foi alterado. Recarregue antes de continuar.",
        )
    return record


def private_files(session: Session, identifier: UUID) -> list[PrivateFile]:
    return list(
        session.scalars(
            select(PrivateFile)
            .where(
                PrivateFile.cadastro_id == identifier, PrivateFile.estado != "removido"
            )
            .order_by(PrivateFile.finalidade, PrivateFile.ordem, PrivateFile.id)
        )
    )


def file_response(record: PrivateFile) -> ArquivoAdministrativo:
    return ArquivoAdministrativo.model_validate(
        {
            key: getattr(record, key)
            for key in ArquivoAdministrativo.model_fields
            if key != "acesso_path"
        }
        | {"acesso_path": f"/api/v1/admin/arquivos/{record.id}"}
    )


def professional_data(session: Session, person: Professional) -> ProfissionalDados:
    address = session.get(Address, person.cadastro_id)
    choices = session.scalars(
        select(ProfessionChoice)
        .where(ProfessionChoice.profissional_id == person.id)
        .order_by(ProfessionChoice.ordem)
    )
    courses = session.scalars(
        select(ProfessionalCourse)
        .where(ProfessionalCourse.profissional_id == person.id)
        .order_by(ProfessionalCourse.ordem)
    )
    return ProfissionalDados(
        nome=person.nome,
        cpf=person.cpf,
        nascimento=person.nascimento,
        whatsapp=person.whatsapp,
        email=person.email,
        biografia=person.biografia,
        endereco=EnderecoEntrada.model_validate(address),
        profissoes=[
            ProfissaoOficial(profissao_id=item.profissao_id, principal=item.principal)
            if item.profissao_id
            else ProfissaoSugerida.model_validate(
                {"sugestao": item.sugestao, "principal": item.principal}
            )
            for item in choices
        ],
        cursos=[Curso.model_validate(item) for item in courses],
    )


def detail(session: Session, record: Registration) -> CadastroAdministrativo:
    common = {
        key: getattr(record, key)
        for key in (
            "id",
            "protocolo",
            "status",
            "versao",
            "criado_em",
            "atualizado_em",
            "motivo_reprovacao",
        )
    }
    common["arquivos"] = [
        file_response(item) for item in private_files(session, record.id)
    ]
    common["aceites"] = [
        Aceite.model_validate(item)
        for item in session.scalars(
            select(Consent)
            .where(Consent.cadastro_id == record.id)
            .order_by(Consent.tipo)
        )
    ]
    if record.tipo == "profissional":
        person = session.scalars(
            select(Professional).where(Professional.cadastro_id == record.id)
        ).one()
        publication = session.get(Publication, person.id)
        return CadastroProfissionalAdministrativo.model_validate(
            common
            | {
                "profissional_id": person.id,
                "dados": professional_data(session, person),
                "publicacao": Publicacao.model_validate(publication)
                if publication
                else Publicacao(publicado=False, revisao=0, atualizado_em=None),
            }
        )
    company = session.scalars(
        select(Company).where(Company.cadastro_id == record.id)
    ).one()
    data = {
        key: getattr(company, key)
        for key in EmpresaDados.model_fields
        if key != "endereco"
    }
    data["endereco"] = EnderecoEntrada.model_validate(session.get(Address, record.id))
    return CadastroEmpresaAdministrativo.model_validate(
        common | {"empresa_id": company.id, "dados": EmpresaDados.model_validate(data)}
    )


def list_registrations(
    session: Session,
    *,
    page: int,
    limit: int,
    search: str,
    tipo: Tipo | None,
    status: Status | None,
) -> CadastrosPagina:
    name = func.coalesce(Professional.nome, Company.nome_fantasia, Company.razao_social)
    query = (
        select(Registration, name.label("nome"))
        .outerjoin(Professional, Professional.cadastro_id == Registration.id)
        .outerjoin(Company, Company.cadastro_id == Registration.id)
    )
    if tipo:
        query = query.where(Registration.tipo == tipo)
    if status:
        query = query.where(Registration.status == status)
    if search.strip():
        term = search.strip()
        query = query.where(
            or_(
                name.icontains(term, autoescape=True),
                Company.razao_social.icontains(term, autoescape=True),
                Registration.protocolo.contains(term, autoescape=True),
            )
        )
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = session.execute(
        query.order_by(Registration.criado_em.desc(), Registration.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    return CadastrosPagina(
        data=[
            CadastroResumo.model_validate(
                {
                    key: getattr(row, key)
                    for key in CadastroResumo.model_fields
                    if key != "nome_exibicao"
                }
                | {"nome_exibicao": label}
            )
            for row, label in rows
        ],
        meta=pagination(total, page, limit),
    )


def history(
    session: Session, identifier: UUID, page: int, limit: int
) -> HistoricoCadastrosPagina:
    registration(session, identifier)
    query = (
        select(RegistrationHistory, Administrator)
        .outerjoin(
            Administrator, RegistrationHistory.administrador_id == Administrator.id
        )
        .where(RegistrationHistory.cadastro_id == identifier)
    )
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = session.execute(
        query.order_by(
            RegistrationHistory.ocorrido_em.desc(), RegistrationHistory.id.desc()
        )
        .offset((page - 1) * limit)
        .limit(limit)
    )
    return HistoricoCadastrosPagina(
        data=[
            HistoricoCadastro.model_validate(
                {
                    key: getattr(row, key)
                    for key in HistoricoCadastro.model_fields
                    if key != "administrador"
                }
                | {
                    "administrador": Administrador.model_validate(admin)
                    if admin
                    else None
                }
            )
            for row, admin in rows
        ],
        meta=pagination(total, page, limit),
    )


def snapshot(session: Session, record: Registration) -> dict[str, str | None]:
    response = detail(session, record)
    result = {
        key: value
        if isinstance(value, str) or value is None
        else json.dumps(value, ensure_ascii=False, sort_keys=True)
        for key, value in response.dados.model_dump(mode="json").items()
    }
    result["status"] = record.status
    result["motivo_reprovacao"] = record.motivo_reprovacao
    result["arquivos"] = json.dumps([str(item.id) for item in response.arquivos])
    if isinstance(response, CadastroProfissionalAdministrativo):
        result["publicado"] = str(response.publicacao.publicado)
    return result


def audit(
    session: Session,
    record: Registration,
    actor: UUID,
    action: str,
    before: dict[str, str | None],
    reason: str | None = None,
) -> None:
    after = snapshot(session, record)
    changes = [
        {"campo": key, "valor_anterior": before.get(key), "valor_atual": after.get(key)}
        for key in sorted(before.keys() | after.keys())
        if before.get(key) != after.get(key)
    ]
    record.versao += 1
    record.atualizado_em = datetime.now(UTC)
    session.add(
        RegistrationHistory(
            cadastro_id=record.id,
            administrador_id=actor,
            acao=action,
            motivo=reason,
            alteracoes=changes,
            ocorrido_em=record.atualizado_em,
        )
    )
    session.flush()


def validate_choices(
    session: Session, data: ProfissionalDados, old: set[UUID], *, approval: bool = False
) -> None:
    identifiers = [
        item.profissao_id
        for item in data.profissoes
        if isinstance(item, ProfissaoOficial)
    ]
    professions = list(
        session.scalars(
            select(Profession)
            .where(Profession.id.in_(identifiers))
            .order_by(Profession.id)
            .with_for_update(read=True)
        )
    )
    if len(professions) != len(identifiers) or any(
        not item.ativo and item.id not in old for item in professions
    ):
        raise ApiProblem(
            422,
            "INVALID_PROFESSION",
            "Escolha profissões existentes e ativas. "
            "Vínculos anteriores inativos podem ser mantidos.",
        )
    if approval and len(identifiers) != len(data.profissoes):
        raise ApiProblem(
            409,
            "UNRESOLVED_PROFESSION",
            "Resolva as sugestões em profissões oficiais antes de aprovar ou publicar.",
        )
    names = [normalized_name(item.nome) for item in professions] + [
        normalized_name(item.sugestao)
        for item in data.profissoes
        if isinstance(item, ProfissaoSugerida)
    ]
    if len(names) != len(set(names)):
        raise ApiProblem(
            422, "DUPLICATE_PROFESSION", "Profissões não podem se repetir."
        )


def verify_images(
    session: Session, record: Registration, store: PrivateStorage
) -> None:
    for image in private_files(session, record.id):
        if image.estado != "pronto" or image.bucket != store.bucket:
            raise ApiProblem(
                409,
                "IMAGE_NOT_READY",
                "Todas as imagens precisam estar prontas antes da publicação.",
            )
        store.get(image.chave, image.tamanho_bytes, image.sha256)


def publication(session: Session, person: Professional) -> Publication:
    result = session.get(Publication, person.id)
    if result is None:
        result = Publication(profissional_id=person.id, publicado=False, revisao=0)
        session.add(result)
    return result


def revise(published: Publication, visible: bool) -> None:
    published.publicado = visible
    published.revisao += 1
    published.atualizado_em = datetime.now(UTC)


def edit(
    session: Session,
    record: Registration,
    data: CadastroAlteracao,
    actor: UUID,
    store: PrivateStorage,
) -> CadastroAdministrativo:
    if data.tipo != record.tipo:
        raise ApiProblem(409, "TYPE_CONFLICT", "O tipo de cadastro não pode mudar.")
    before = snapshot(session, record)
    current = detail(session, record)
    merged = current.dados.model_dump(mode="json") | data.alteracoes
    try:
        validated = (
            ProfissionalDados.model_validate(merged)
            if data.tipo == "profissional"
            else EmpresaDados.model_validate(merged)
        )
        if isinstance(validated, ProfissionalDados):
            require_adult_birth(validated.nascimento)
    except ValueError:
        raise ApiProblem(
            422, "VALIDATION_ERROR", "Confira os campos informados e seus limites."
        ) from None
    if validated.model_dump(mode="json") == current.dados.model_dump(mode="json"):
        return current
    if isinstance(validated, ProfissionalDados):
        person = session.scalars(
            select(Professional).where(Professional.cadastro_id == record.id)
        ).one()
        old = (
            {
                item.profissao_id
                for item in current.dados.profissoes
                if isinstance(item, ProfissaoOficial)
            }
            if isinstance(current, CadastroProfissionalAdministrativo)
            else set()
        )
        validate_choices(session, validated, old, approval=record.status == "aprovado")
        for key in ProfissionalDados.model_fields.keys() - {
            "endereco",
            "profissoes",
            "cursos",
        }:
            setattr(person, key, getattr(validated, key))
        session.execute(
            delete(ProfessionChoice).where(
                ProfessionChoice.profissional_id == person.id
            )
        )
        session.execute(
            delete(ProfessionalCourse).where(
                ProfessionalCourse.profissional_id == person.id
            )
        )
        for index, item in enumerate(validated.profissoes):
            suggestion = item.sugestao if isinstance(item, ProfissaoSugerida) else None
            session.add(
                ProfessionChoice(
                    profissional_id=person.id,
                    ordem=index,
                    profissao_id=item.profissao_id
                    if isinstance(item, ProfissaoOficial)
                    else None,
                    sugestao=suggestion,
                    sugestao_normalizada=normalized_name(suggestion)
                    if suggestion
                    else None,
                    principal=item.principal,
                )
            )
        for index, course in enumerate(validated.cursos):
            session.add(
                ProfessionalCourse(
                    profissional_id=person.id, ordem=index, **course.model_dump()
                )
            )
        published = session.get(Publication, person.id)
        if published and published.publicado:
            verify_images(session, record, store)
            revise(published, True)
    else:
        company = session.scalars(
            select(Company).where(Company.cadastro_id == record.id)
        ).one()
        for key in EmpresaDados.model_fields.keys() - {"endereco"}:
            setattr(company, key, getattr(validated, key))
    address = session.get(Address, record.id)
    if address is None:
        raise ApiProblem(409, "ADDRESS_MISSING", "Endereço do cadastro ausente.")
    for key, value in validated.endereco.model_dump().items():
        setattr(address, key, value)
    try:
        session.flush()
    except IntegrityError:
        raise ApiProblem(
            409, "DOCUMENT_CONFLICT", "Já existe um cadastro com esse documento."
        ) from None
    audit(session, record, actor, "edicao", before)
    return detail(session, record)


def decide(
    session: Session,
    record: Registration,
    action: str,
    actor: UUID,
    store: PrivateStorage,
    reason: str | None = None,
) -> CadastroAdministrativo:
    before = snapshot(session, record)
    expected = {
        "aprovar": "pendente",
        "reprovar": "pendente",
        "reabrir": "reprovado",
        "publicar": "aprovado",
        "despublicar": "aprovado",
    }
    if record.status != expected[action]:
        raise ApiProblem(
            409, "INVALID_STATE", "A ação não está disponível para o status atual."
        )
    person = session.scalar(
        select(Professional).where(Professional.cadastro_id == record.id)
    )
    if action in ("publicar", "despublicar") and person is None:
        raise ApiProblem(409, "INVALID_STATE", "Empresas permanecem privadas.")
    if action in ("aprovar", "publicar"):
        if session.get(Consent, (record.id, "maioridade")) is None:
            raise ApiProblem(
                409,
                "ADULT_DECLARATION_REQUIRED",
                "Declaração de maioridade não registrada.",
            )
        if person is not None:
            try:
                require_adult_birth(person.nascimento)
            except ValueError:
                raise ApiProblem(
                    409,
                    "ADULT_REQUIRED",
                    "Cadastro permitido somente a maiores de 18 anos.",
                ) from None
    if person and action in ("aprovar", "publicar"):
        data = professional_data(session, person)
        validate_choices(
            session,
            data,
            {
                item.profissao_id
                for item in data.profissoes
                if isinstance(item, ProfissaoOficial)
            },
            approval=True,
        )
        if session.get(Consent, (record.id, "publicacao")) is None:
            raise ApiProblem(
                409,
                "PUBLICATION_CONSENT_REQUIRED",
                "Autorização de publicação não registrada.",
            )
        verify_images(session, record, store)
    if person and action in ("aprovar", "publicar", "despublicar"):
        published = publication(session, person)
        visible = action != "despublicar"
        if action != "aprovar" and published.publicado == visible:
            raise ApiProblem(
                409, "INVALID_STATE", "O perfil já está nessa situação de publicação."
            )
        revise(published, visible)
    if action in ("aprovar", "reprovar", "reabrir"):
        record.status = {
            "aprovar": "aprovado",
            "reprovar": "reprovado",
            "reabrir": "pendente",
        }[action]
        record.motivo_reprovacao = reason if action == "reprovar" else None
    session.flush()
    audit(
        session,
        record,
        actor,
        {
            "aprovar": "aprovacao",
            "reprovar": "reprovacao",
            "reabrir": "reabertura",
            "publicar": "publicacao",
            "despublicar": "despublicacao",
        }[action],
        before,
        reason,
    )
    return detail(session, record)
