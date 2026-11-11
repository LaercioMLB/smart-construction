import hashlib
import json
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import Engine, case, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.arquivos.images import PreparedImage
from app.arquivos.models import PrivateFile, UploadJournal
from app.arquivos.storage import PrivateStorage
from app.cadastros.models import (
    Address,
    Company,
    Consent,
    Professional,
    ProfessionalCourse,
    ProfessionChoice,
    Registration,
    RegistrationHistory,
    SubmissionKey,
    SubmissionLimit,
)
from app.cadastros.schemas import (
    EmpresaDadosEntrada,
    ProfissaoOficial,
    ProfissionalDadosEntrada,
    Recebimento,
)
from app.cadastros.validation import normalized_name
from app.core.problems import ApiProblem
from app.core.settings import Settings
from app.profissoes.models import Profession

RegistrationData = ProfissionalDadosEntrada | EmpresaDadosEntrada
CONFLICT_MESSAGE = (
    "Não foi possível receber este cadastro. Entre em contato com a Smart Construction."
)


def advisory_key(value: str) -> int:
    return int.from_bytes(hashlib.sha256(value.encode()).digest()[:8], signed=True)


def try_lock(session: Session, key: int) -> bool:
    return (
        session.execute(
            text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": key}
        ).scalar_one()
        is True
    )


def registration_limit(engine: Engine) -> None:
    now = datetime.now(UTC)
    with Session(engine) as session, session.begin():
        expired = SubmissionLimit.inicio <= now - timedelta(minutes=15)
        statement = insert(SubmissionLimit).values(
            chave="global", inicio=now, tentativas=1
        )
        count = session.scalar(
            statement.on_conflict_do_update(
                index_elements=[SubmissionLimit.chave],
                set_={
                    "inicio": case((expired, now), else_=SubmissionLimit.inicio),
                    "tentativas": case(
                        (expired, 1), else_=SubmissionLimit.tentativas + 1
                    ),
                },
            ).returning(SubmissionLimit.tentativas)
        )
    if count is None or count > 60:
        raise ApiProblem(
            429,
            "REGISTRATION_LIMIT",
            "Limite de envios atingido. Aguarde quinze minutos.",
        )


def fingerprint(data: RegistrationData, images: list[PreparedImage]) -> str:
    content = {
        "dados": data.model_dump(mode="json"),
        "imagens": [
            {
                "finalidade": item.purpose,
                "ordem": item.order,
                "sha256": item.original_sha256,
                "content_type": item.content_type,
            }
            for item in images
        ],
    }
    return hashlib.sha256(
        json.dumps(
            content, sort_keys=True, separators=(",", ":"), ensure_ascii=False
        ).encode()
    ).hexdigest()


def validate_professions(session: Session, data: ProfissionalDadosEntrada) -> None:
    identifiers = [
        item.profissao_id
        for item in data.profissoes
        if isinstance(item, ProfissaoOficial)
    ]
    records = list(
        session.scalars(
            select(Profession)
            .where(Profession.id.in_(identifiers))
            .order_by(Profession.id)
            .with_for_update(read=True)
        )
    )
    if len(records) != len(identifiers) or any(not item.ativo for item in records):
        raise ApiProblem(
            422, "INVALID_PROFESSION", "Escolha profissões existentes e ativas."
        )
    names = [normalized_name(item.nome) for item in records]
    names.extend(
        normalized_name(item.sugestao)
        for item in data.profissoes
        if not isinstance(item, ProfissaoOficial)
    )
    if len(set(names)) != len(names):
        raise ApiProblem(
            422,
            "DUPLICATE_PROFESSION",
            "As profissões selecionadas e sugeridas não podem se repetir.",
        )


def save_person(
    session: Session, registration: Registration, data: RegistrationData
) -> None:
    if isinstance(data, ProfissionalDadosEntrada):
        validate_professions(session, data)
        professional = Professional(
            cadastro_id=registration.id,
            nome=data.nome,
            cpf=data.cpf,
            nascimento=data.nascimento,
            whatsapp=data.whatsapp,
            email=data.email,
            biografia=data.biografia,
        )
        session.add(professional)
        session.flush()
        for index, item in enumerate(data.profissoes):
            suggestion = (
                item.sugestao if not isinstance(item, ProfissaoOficial) else None
            )
            session.add(
                ProfessionChoice(
                    profissional_id=professional.id,
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
        for index, course in enumerate(data.cursos):
            session.add(
                ProfessionalCourse(
                    profissional_id=professional.id, ordem=index, **course.model_dump()
                )
            )
    else:
        session.add(
            Company(
                cadastro_id=registration.id,
                razao_social=data.razao_social,
                nome_fantasia=data.nome_fantasia,
                cnpj=data.cnpj,
                responsavel=data.responsavel,
                whatsapp=data.whatsapp,
                email=data.email,
                segmento=data.segmento,
                descricao=data.descricao,
            )
        )
    session.add(Address(cadastro_id=registration.id, **data.endereco.model_dump()))


def reserve_upload(engine: Engine, *, key: str, bucket: str, lock_key: int) -> UUID:
    with Session(engine) as session, session.begin():
        journal = UploadJournal(chave=key, bucket=bucket, lock_key=lock_key)
        session.add(journal)
        session.flush()
        return journal.id


def accept_registration(
    engine: Engine,
    settings: Settings,
    store: PrivateStorage,
    data: RegistrationData,
    images: list[PreparedImage],
    key: UUID,
) -> Recebimento:
    kind = "profissional" if isinstance(data, ProfissionalDadosEntrada) else "empresa"
    digest = fingerprint(data, images)
    lock_key = advisory_key(f"cadastro:{kind}:{key}")
    document = data.cpf if isinstance(data, ProfissionalDadosEntrada) else data.cnpj
    now = datetime.now(UTC)
    try:
        with Session(engine) as session, session.begin():
            if not try_lock(session, lock_key):
                raise ApiProblem(
                    409,
                    "SUBMISSION_CONFLICT",
                    "Este envio está sendo processado. Aguarde e tente novamente.",
                )
            previous = session.get(SubmissionKey, (key, kind))
            if previous is not None:
                if previous.fingerprint != digest or previous.expira_em <= now:
                    raise ApiProblem(
                        409,
                        "SUBMISSION_CONFLICT",
                        "Chave de envio expirada ou usada com outro conteúdo.",
                    )
                original = session.get(Registration, previous.cadastro_id)
                if original is None:
                    raise ApiProblem(
                        503,
                        "DEPENDENCY_UNAVAILABLE",
                        "Envio temporariamente indisponível.",
                    )
                return Recebimento(
                    protocolo=original.protocolo,
                    status="pendente",
                    recebido_em=original.criado_em,
                )
            if not try_lock(session, advisory_key(f"documento:{kind}:{document}")):
                raise ApiProblem(
                    409,
                    "REGISTRATION_CONFLICT",
                    CONFLICT_MESSAGE,
                )
            exists = (
                session.scalar(
                    select(Professional.id).where(Professional.cpf == document)
                )
                if kind == "profissional"
                else session.scalar(select(Company.id).where(Company.cnpj == document))
            )
            if exists is not None:
                raise ApiProblem(
                    409,
                    "REGISTRATION_CONFLICT",
                    CONFLICT_MESSAGE,
                )
            if (
                data.aceites.versao_termos != settings.terms_version
                or data.aceites.versao_privacidade != settings.privacy_version
            ):
                raise ApiProblem(
                    422,
                    "CONSENT_VERSION",
                    "Atualize o formulário e confira os termos e a privacidade.",
                )
            registration = Registration(
                id=uuid4(),
                protocolo=secrets.token_urlsafe(24),
                tipo=kind,
                criado_em=now,
                atualizado_em=now,
            )
            session.add(registration)
            session.flush()
            save_person(session, registration, data)
            for consent_type, version in (
                ("termos", settings.terms_version),
                ("privacidade", settings.privacy_version),
                ("maioridade", settings.terms_version),
            ):
                session.add(
                    Consent(
                        cadastro_id=registration.id,
                        tipo=consent_type,
                        versao=version,
                        aceito_em=now,
                    )
                )
            if isinstance(data, ProfissionalDadosEntrada):
                session.add(
                    Consent(
                        cadastro_id=registration.id,
                        tipo="publicacao",
                        versao=settings.terms_version,
                        aceito_em=now,
                    )
                )
            session.add(
                RegistrationHistory(
                    cadastro_id=registration.id,
                    administrador_id=None,
                    acao="criacao",
                    ocorrido_em=now,
                    alteracoes=[],
                )
            )
            session.add(
                SubmissionKey(
                    chave=key,
                    tipo=kind,
                    fingerprint=digest,
                    cadastro_id=registration.id,
                    expira_em=now + timedelta(hours=24),
                )
            )
            session.flush()
            for image in images:
                file_id = uuid4()
                extension = "jpg" if image.content_type == "image/jpeg" else "png"
                object_key = (
                    f"cadastros/{registration.id.hex}/{file_id.hex}.{extension}"
                )
                journal_id = reserve_upload(
                    engine, key=object_key, bucket=store.bucket, lock_key=lock_key
                )
                store.put(object_key, image.data, image.content_type)
                session.add(
                    PrivateFile(
                        id=file_id,
                        cadastro_id=registration.id,
                        finalidade=image.purpose,
                        bucket=store.bucket,
                        chave=object_key,
                        content_type=image.content_type,
                        tamanho_bytes=len(image.data),
                        sha256=image.sha256,
                        largura=image.width,
                        altura=image.height,
                        ordem=image.order,
                        estado="pronto",
                    )
                )
                session.execute(
                    update(UploadJournal)
                    .where(UploadJournal.id == journal_id)
                    .values(estado="vinculado")
                )
            session.flush()
            receipt = Recebimento(
                protocolo=registration.protocolo,
                status="pendente",
                recebido_em=registration.criado_em,
            )
        # Só retornar sucesso depois do COMMIT; nunca apagar objetos no caminho de erro.
        # O journal permite reconciliar inclusive uma confirmação de COMMIT incerta.
        return receipt
    except IntegrityError:
        raise ApiProblem(
            409,
            "REGISTRATION_CONFLICT",
            CONFLICT_MESSAGE,
        ) from None
