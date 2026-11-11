"""Operações idempotentes: registro externo → encerramento → S3 → banco."""

from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID

from sqlalchemy import Engine, delete, select, text
from sqlalchemy.orm import Session

from app.arquivos.models import PrivateFile, UploadJournal
from app.arquivos.storage import PrivateStorage
from app.auditoria.models import AuditEvent
from app.auth.models import Administrator
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
    SubmissionKey,
)
from app.retencao.ledger import (
    Erasure,
    FileErasure,
    Ledger,
    MinimalConsent,
    MinimalEvent,
    months_after,
)
from app.retencao.models import Preservation, RetainedProof


class ErasureStorage(PrivateStorage, Protocol):
    def delete_verified(self, key: str) -> None: ...


def privileged(session: Session) -> None:
    if session.scalar(text("SELECT current_user")) != "smart_migrator":
        raise ValueError("Manutenção exige credencial separada de migrations.")
    # Uma operação de manutenção por banco. Sem elevar privilégios de smart_api.
    if not session.scalar(text("SELECT pg_try_advisory_xact_lock(71524175001)")):
        raise ValueError("Outra manutenção está em andamento.")


def held(session: Session, identifier: UUID, moment: datetime) -> bool:
    return (
        session.scalar(
            select(Preservation.entidade_id).where(
                Preservation.entidade_id == identifier, Preservation.ate > moment
            )
        )
        is not None
    )


def active_actor(session: Session, actor: UUID) -> None:
    admin = session.get(Administrator, actor)
    if admin is None or not admin.ativo:
        raise ValueError("Administrador responsável inválido ou inativo.")


def prepare_erasure(
    engine: Engine,
    ledger: Ledger,
    identifier: UUID,
    actor: UUID,
    expected: int,
    reason: str,
    *,
    apply: bool = False,
) -> Erasure:
    moment = datetime.now(UTC)
    with Session(engine) as session, session.begin():
        privileged(session)
        active_actor(session, actor)
        if held(session, identifier, moment):
            raise ValueError("Entidade com preservação vigente; não encerrar/excluir.")
        previous = next(
            (
                item
                for item in ledger.read().exclusoes
                if item.cadastro_id == identifier
            ),
            None,
        )
        record = session.scalar(
            select(Registration).where(Registration.id == identifier).with_for_update()
        )
        if previous is not None:
            if apply and record is not None and record.encerrado_em is None:
                record.encerrado_em = previous.encerrado_em
                record.versao += 1
                session.execute(
                    delete(RegistrationHistory).where(
                        RegistrationHistory.cadastro_id == identifier
                    )
                )
            return previous
        if record is None or record.versao != expected:
            raise ValueError(
                "Cadastro ausente ou versão diferente; confira a simulação."
            )
        if record.encerrado_em is not None:
            raise ValueError("Marco sem registro externo correspondente; investigar.")
        events = session.scalars(
            select(RegistrationHistory)
            .where(RegistrationHistory.cadastro_id == identifier)
            .order_by(RegistrationHistory.ocorrido_em, RegistrationHistory.id)
        )
        consents = session.scalars(
            select(Consent)
            .where(Consent.cadastro_id == identifier)
            .order_by(Consent.tipo)
        )
        result = Erasure.model_validate(
            {
                "cadastro_id": identifier,
                "encerrado_em": moment,
                "expira_em": months_after(moment, 24),
                "administrador_id": actor,
                "motivo": reason,
                "eventos": [
                    MinimalEvent(
                        id=item.id,
                        acao=item.acao,
                        ocorrido_em=item.ocorrido_em,
                        administrador_id=item.administrador_id,
                    )
                    for item in events
                ],
                "aceites": [
                    MinimalConsent(
                        tipo=item.tipo, versao=item.versao, aceito_em=item.aceito_em
                    )
                    for item in consents
                ],
            }
        )
        if apply:
            ledger.erase(result)
            record.encerrado_em = result.encerrado_em
            record.versao += 1
            # Valores históricos antigos são minimizados no próprio encerramento.
            session.execute(
                delete(RegistrationHistory).where(
                    RegistrationHistory.cadastro_id == identifier
                )
            )
            session.add(
                RegistrationHistory(
                    cadastro_id=identifier,
                    administrador_id=actor,
                    acao="encerrado",
                    motivo=None,
                    alteracoes=[],
                    ocorrido_em=moment,
                )
            )
            person = session.scalar(
                select(Professional).where(Professional.cadastro_id == identifier)
            )
            published = session.get(Publication, person.id) if person else None
            if published:
                published.publicado = False
                published.revisao += 1
                published.atualizado_em = moment
        return result


def _erase_registration(
    engine: Engine,
    store: ErasureStorage,
    ledger: Ledger,
    entry: Erasure,
    *,
    apply: bool = False,
    replay: bool = False,
) -> dict[str, int]:
    with Session(engine) as session, session.begin():
        privileged(session)
        record = session.scalar(
            select(Registration)
            .where(Registration.id == entry.cadastro_id)
            .with_for_update()
        )
        if held(session, entry.cadastro_id, datetime.now(UTC)) and not replay:
            raise ValueError("Preservação vigente impede exclusão.")
        if record is None:
            return {"cadastros": 0, "arquivos": 0}
        if apply and not replay and record.encerrado_em != entry.encerrado_em:
            raise ValueError("Encerramento precisa estar confirmado antes da exclusão.")
        files = list(
            session.scalars(
                select(PrivateFile)
                .where(PrivateFile.cadastro_id == record.id)
                .with_for_update()
            )
        )
        for item in files:
            if item.bucket != store.bucket or not item.chave.startswith(
                f"cadastros/{record.id.hex}/"
            ):
                raise ValueError("Arquivo fora do bucket ou prefixo do cadastro.")
        if not apply:
            return {"cadastros": 1, "arquivos": len(files)}
        # Antes do S3, garantir que o registro write-ahead está íntegro e contém o ato.
        if entry not in ledger.read().exclusoes:
            raise ValueError("Exclusão sem registro externo confirmado.")
        journals = list(
            session.scalars(
                select(UploadJournal)
                .where(
                    UploadJournal.bucket == store.bucket,
                    UploadJournal.chave.startswith(
                        f"cadastros/{record.id.hex}/", autoescape=True
                    ),
                )
                .with_for_update()
            )
        )
        keys = {item.chave for item in files} | {item.chave for item in journals}
        for key in keys:
            store.delete_verified(key)
        person = session.scalar(
            select(Professional).where(Professional.cadastro_id == record.id)
        )
        if person:
            for model in (Publication, ProfessionalCourse, ProfessionChoice):
                session.execute(delete(model).where(model.profissional_id == person.id))
            session.execute(delete(Professional).where(Professional.id == person.id))
        session.execute(delete(Company).where(Company.cadastro_id == record.id))
        for journal in journals:
            session.delete(journal)
        for registration_model in (
            PrivateFile,
            Address,
            Consent,
            RegistrationHistory,
            SubmissionKey,
        ):
            session.execute(
                delete(registration_model).where(
                    registration_model.cadastro_id == record.id
                )
            )
        session.execute(delete(Registration).where(Registration.id == record.id))
        proof = session.get(RetainedProof, entry.cadastro_id)
        if proof is None and entry.expira_em > datetime.now(UTC):
            session.add(
                RetainedProof(
                    cadastro_id=entry.cadastro_id,
                    encerrado_em=entry.encerrado_em,
                    expira_em=entry.expira_em,
                    minimo=entry.model_dump(mode="json"),
                )
            )
        # Triggers diferidos continuam ativos; nenhum CASCADE/disable amplo.
        session.flush()
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        return {"cadastros": 1, "arquivos": len(files)}


def erase_registration(
    engine: Engine,
    store: ErasureStorage,
    ledger: Ledger,
    entry: Erasure,
    *,
    apply: bool = False,
    replay: bool = False,
) -> dict[str, int]:
    result = _erase_registration(
        engine, store, ledger, entry, apply=apply, replay=replay
    )
    if apply:
        # Depois do commit: uma falha mantém a intenção para retomada, sem encurtar
        # a janela necessária para os backups ainda existentes.
        ledger.finish(entry.cadastro_id, datetime.now(UTC))
    return result


def _expire_files(
    engine: Engine,
    store: ErasureStorage,
    ledger: Ledger,
    *,
    apply: bool = False,
    moment: datetime | None = None,
) -> int:
    moment = moment or datetime.now(UTC)
    with Session(engine) as session, session.begin():
        privileged(session)
        ids = list(
            session.scalars(
                select(PrivateFile.id)
                .where(
                    PrivateFile.estado == "removido",
                    PrivateFile.revogado_em <= moment - timedelta(days=30),
                )
                .order_by(PrivateFile.id)
                .limit(100)
            )
        )
        count = 0
        for identifier in ids:
            # Mesma ordem dos locks da API: cadastro antes de arquivo.
            image = session.get(PrivateFile, identifier)
            if image is None:
                continue
            session.scalar(
                select(Registration)
                .where(Registration.id == image.cadastro_id)
                .with_for_update()
            )
            session.refresh(image, with_for_update=True)
            if held(session, image.cadastro_id, moment) or image.estado != "removido":
                continue
            entry = FileErasure(
                arquivo_id=image.id,
                cadastro_id=image.cadastro_id,
                bucket=image.bucket,
                chave=image.chave,
                registrado_em=moment,
            )
            if image.bucket != store.bucket or not image.chave.startswith(
                f"cadastros/{image.cadastro_id.hex}/"
            ):
                raise ValueError("Vínculo de arquivo incompatível.")
            count += 1
            if apply:
                ledger.files([entry])
                store.delete_verified(image.chave)
                session.execute(
                    delete(UploadJournal).where(
                        UploadJournal.chave == image.chave,
                        UploadJournal.bucket == image.bucket,
                    )
                )
                session.delete(image)
        return count


def expire_files(
    engine: Engine,
    store: ErasureStorage,
    ledger: Ledger,
    *,
    apply: bool = False,
    moment: datetime | None = None,
) -> int:
    count = _expire_files(engine, store, ledger, apply=apply, moment=moment)
    if apply:
        for item in ledger.read().arquivos:
            if item.eliminado_em is not None:
                continue
            with Session(engine) as session:
                privileged(session)
                exists = session.get(PrivateFile, item.arquivo_id) is not None
            if not exists:
                if item.bucket != store.bucket:
                    raise ValueError("Bucket diferente no registro externo.")
                store.delete_verified(item.chave)
                ledger.finish(item.arquivo_id, datetime.now(UTC), file=True)
    return count


def expire_records(
    engine: Engine, *, apply: bool = False, moment: datetime | None = None
) -> dict[str, int]:
    moment = moment or datetime.now(UTC)
    cutoff = months_after(moment, -24) + timedelta(days=3)
    result: dict[str, int] = {}
    with Session(engine) as session, session.begin():
        privileged(session)
        active_holds = select(Preservation.entidade_id).where(Preservation.ate > moment)
        queries = {
            "comprovantes": select(RetainedProof).where(
                RetainedProof.expira_em <= moment,
                RetainedProof.cadastro_id.not_in(active_holds),
            ),
            "auditoria": select(AuditEvent)
            .where(
                AuditEvent.ocorrido_em <= cutoff,
                AuditEvent.entidade.in_(["administrador", "profissao", "preservacao"]),
                AuditEvent.entidade_id.not_in(active_holds),
            )
            .order_by(AuditEvent.ocorrido_em, AuditEvent.id),
            "preservacoes_vencidas": select(Preservation).where(
                Preservation.ate <= moment
            ),
        }
        for name, query in queries.items():
            rows = list(session.scalars(query.limit(100).with_for_update()))
            if name == "auditoria":
                rows = [
                    row
                    for row in rows
                    if isinstance(row, AuditEvent)
                    and months_after(row.ocorrido_em, 24) <= moment
                ]
            result[name] = len(rows)
            if apply:
                for row in rows:
                    session.delete(row)
    return result


def compact_ledger(
    engine: Engine,
    ledger: Ledger,
    *,
    apply: bool = False,
    moment: datetime | None = None,
) -> dict[str, int]:
    moment = moment or datetime.now(UTC)
    state = ledger.read()
    with Session(engine) as session, session.begin():
        privileged(session)
        exclusions = [
            item
            for item in state.exclusoes
            if item.expira_em > moment
            or item.eliminado_em is None
            or item.eliminado_em + timedelta(days=30) >= moment
            or held(session, item.cadastro_id, moment)
            or session.get(Registration, item.cadastro_id) is not None
        ]
        files = [
            item
            for item in state.arquivos
            if item.eliminado_em is None
            or item.eliminado_em + timedelta(days=30) >= moment
            or held(session, item.cadastro_id, moment)
            or session.get(PrivateFile, item.arquivo_id) is not None
        ]
        preservations = [item for item in state.preservacoes if item.ate > moment]
        if apply:
            ledger.write(
                state.model_copy(
                    update={
                        "exclusoes": exclusions,
                        "arquivos": files,
                        "preservacoes": preservations,
                    }
                )
            )
        return {
            "registros_externos": len(state.exclusoes) - len(exclusions),
            "arquivos_externos": len(state.arquivos) - len(files),
            "preservacoes_externas": len(state.preservacoes) - len(preservations),
        }


def replay_erasures(
    engine: Engine, store: ErasureStorage, ledger: Ledger, *, apply: bool = False
) -> dict[str, int]:
    state = ledger.read()
    totals = {"cadastros": 0, "arquivos": 0}
    # Obrigações criadas depois do dump também precisam acompanhar a restauração.
    if apply:
        with Session(engine) as session, session.begin():
            privileged(session)
            for hold in state.preservacoes:
                if hold.ate <= datetime.now(UTC):
                    continue
                session.merge(
                    Preservation(
                        entidade_id=hold.entidade_id,
                        referencia=hold.referencia,
                        responsavel_id=hold.responsavel_id,
                        registrado_em=hold.registrado_em,
                        ate=hold.ate,
                    )
                )
                if (
                    session.get(AuditEvent, hold.id) is None
                    and session.get(Administrator, hold.responsavel_id) is not None
                ):
                    session.add(
                        AuditEvent(
                            id=hold.id,
                            administrador_id=hold.responsavel_id,
                            entidade="preservacao",
                            entidade_id=hold.entidade_id,
                            acao="preservar",
                            antes=None,
                            depois={
                                "referencia": hold.referencia,
                                "ate": hold.ate.isoformat(),
                            },
                            ocorrido_em=hold.registrado_em,
                        )
                    )
    for entry in state.exclusoes:
        values = erase_registration(
            engine, store, ledger, entry, apply=apply, replay=True
        )
        for key, value in values.items():
            totals[key] += value
    for file_entry in state.arquivos:
        with Session(engine) as session, session.begin():
            privileged(session)
            image = session.get(PrivateFile, file_entry.arquivo_id)
            if image and (
                image.cadastro_id != file_entry.cadastro_id
                or image.chave != file_entry.chave
                or image.bucket != file_entry.bucket
            ):
                raise ValueError(
                    "Arquivo restaurado incompatível com o registro externo."
                )
            if file_entry.bucket != store.bucket:
                raise ValueError("Registro externo pertence a outro bucket.")
            if apply:
                store.delete_verified(file_entry.chave)
                session.execute(
                    delete(UploadJournal).where(
                        UploadJournal.chave == file_entry.chave,
                        UploadJournal.bucket == file_entry.bucket,
                    )
                )
                if image:
                    session.delete(image)
            totals["arquivos"] += int(image is not None)
        if apply:
            ledger.finish(file_entry.arquivo_id, datetime.now(UTC), file=True)
    return totals
