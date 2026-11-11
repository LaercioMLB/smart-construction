"""Conferência manual de objetos reservados sem vínculo; sem limpeza automática."""

import argparse
from datetime import UTC, datetime, timedelta

from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.arquivos.models import PrivateFile, UploadJournal
from app.arquivos.storage import PrivateStorage, S3PrivateStorage
from app.cadastros.service import try_lock
from app.core.database import create_database_engine
from app.core.settings import Settings


def reconcile(
    engine: Engine, store: PrivateStorage, *, apply: bool = False
) -> dict[str, int]:
    totals = {"candidatos": 0, "limpos": 0, "em_uso": 0}
    cutoff = datetime.now(UTC) - timedelta(hours=24)
    with Session(engine) as session:
        identifiers = list(
            session.scalars(
                select(UploadJournal.id)
                .where(
                    UploadJournal.estado == "reservado",
                    UploadJournal.criado_em <= cutoff,
                )
                .order_by(UploadJournal.id)
                .limit(100)
            )
        )
    for identifier in identifiers:
        with Session(engine) as session, session.begin():
            record = session.get(UploadJournal, identifier)
            if (
                record is None
                or record.estado != "reservado"
                or record.bucket != store.bucket
            ):
                continue
            if not try_lock(session, record.lock_key):
                totals["em_uso"] += 1
                continue
            # Revalidar vínculo depois do lock que o envio também usa.
            linked = session.scalar(
                select(PrivateFile.id).where(
                    PrivateFile.chave == record.chave,
                    PrivateFile.bucket == record.bucket,
                )
            )
            if linked is not None:
                totals["em_uso"] += 1
                if apply:
                    record.estado = "vinculado"
                continue
            totals["candidatos"] += 1
            if apply:
                store.delete(record.chave)
                record.estado = "limpo"
                totals["limpos"] += 1
    return totals


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Remover objetos sem vínculo, reservados há pelo menos 24 horas.",
    )
    arguments = parser.parse_args()
    settings = Settings()
    engine = create_database_engine(settings)
    try:
        print(reconcile(engine, S3PrivateStorage(settings), apply=arguments.apply))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
