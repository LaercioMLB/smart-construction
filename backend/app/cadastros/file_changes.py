from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Engine, update
from sqlalchemy.orm import Session

from app.arquivos.images import PreparedImage
from app.arquivos.models import PrivateFile, UploadJournal
from app.arquivos.storage import PrivateStorage
from app.cadastros.analysis import audit, private_files, revise, snapshot, verify_images
from app.cadastros.models import Professional, Publication, Registration
from app.cadastros.service import advisory_key, reserve_upload, try_lock
from app.core.problems import ApiProblem


def update_publication(
    session: Session, record: Registration, store: PrivateStorage
) -> None:
    from sqlalchemy import select

    person = session.scalar(
        select(Professional).where(Professional.cadastro_id == record.id)
    )
    published = session.get(Publication, person.id) if person else None
    if published and published.publicado:
        verify_images(session, record, store)
        revise(published, True)


def add_file(
    session: Session,
    engine: Engine,
    record: Registration,
    actor: UUID,
    store: PrivateStorage,
    image: PreparedImage,
) -> PrivateFile:
    allowed = (
        {"foto_perfil", "foto_trabalho"} if record.tipo == "profissional" else {"logo"}
    )
    if image.purpose not in allowed:
        raise ApiProblem(
            422, "INVALID_PURPOSE", "Finalidade incompatível com o cadastro."
        )
    existing = [
        item
        for item in private_files(session, record.id)
        if item.finalidade == image.purpose
    ]
    if image.purpose == "foto_trabalho" and len(existing) >= 6:
        raise ApiProblem(
            409,
            "IMAGE_LIMIT",
            "Limite de imagens atingido. Remova a anterior para substituir.",
        )
    before = snapshot(session, record)
    lock_key = advisory_key(f"admin-upload:{record.id}")
    if not try_lock(session, lock_key):
        raise ApiProblem(409, "UPLOAD_CONFLICT", "Há outro envio em andamento.")
    identifier = uuid4()
    extension = "jpg" if image.content_type == "image/jpeg" else "png"
    key = f"cadastros/{record.id.hex}/{identifier.hex}.{extension}"
    journal = reserve_upload(engine, key=key, bucket=store.bucket, lock_key=lock_key)
    store.put(key, image.data, image.content_type)
    if image.purpose != "foto_trabalho":
        for previous in existing:
            previous.estado = "removido"
            previous.revogado_em = datetime.now(UTC)
    result = PrivateFile(
        id=identifier,
        cadastro_id=record.id,
        finalidade=image.purpose,
        bucket=store.bucket,
        chave=key,
        content_type=image.content_type,
        tamanho_bytes=len(image.data),
        sha256=image.sha256,
        largura=image.width,
        altura=image.height,
        ordem=max((item.ordem for item in existing), default=-1) + 1
        if image.purpose == "foto_trabalho"
        else 0,
        estado="pronto",
    )
    session.add(result)
    session.execute(
        update(UploadJournal)
        .where(UploadJournal.id == journal)
        .values(estado="vinculado")
    )
    session.flush()
    update_publication(session, record, store)
    audit(session, record, actor, "arquivo_adicionado", before)
    return result


def remove_file(
    session: Session,
    record: Registration,
    identifier: UUID,
    actor: UUID,
    store: PrivateStorage,
) -> None:
    file = session.get(PrivateFile, identifier)
    if file is None or file.cadastro_id != record.id or file.estado == "removido":
        raise ApiProblem(404, "NOT_FOUND", "Arquivo não encontrado neste cadastro.")
    before = snapshot(session, record)
    # Tombstone transacional: revoga os acessos sem apagar o objeto antes do commit.
    # Retenção física fica para a política operacional, sem exclusão automática.
    file.estado = "removido"
    file.revogado_em = datetime.now(UTC)
    session.flush()
    update_publication(session, record, store)
    audit(session, record, actor, "arquivo_removido", before)
