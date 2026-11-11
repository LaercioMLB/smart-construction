"""Manutenção local: simulação por padrão; não é uma rota HTTP."""

import argparse
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.arquivos.storage import S3PrivateStorage
from app.auditoria.models import AuditEvent
from app.cadastros.models import Registration, RegistrationHistory
from app.core.database import create_database_engine
from app.core.problems import ApiProblem
from app.core.settings import Settings
from app.retencao.backups import expire_backups, snapshot_time, verify_package
from app.retencao.ledger import Ledger, PreservationRecord
from app.retencao.models import Preservation
from app.retencao.service import (
    active_actor,
    compact_ledger,
    erase_registration,
    expire_files,
    expire_records,
    prepare_erasure,
    privileged,
    replay_erasures,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action",
        choices=[
            "init",
            "erase",
            "expire",
            "replay",
            "hold",
            "review",
            "backups",
            "validate-backup",
        ],
    )
    parser.add_argument("--ledger", type=Path, default=Path("/retention"))
    parser.add_argument("--id", type=UUID)
    parser.add_argument("--actor", type=UUID)
    parser.add_argument("--version", type=int)
    parser.add_argument(
        "--reason",
        choices=["solicitacao_titular", "fim_finalidade", "cadastro_indevido"],
    )
    parser.add_argument("--until", type=datetime.fromisoformat)
    parser.add_argument("--reference")
    parser.add_argument("--backup-root", type=Path, default=Path("/backup"))
    parser.add_argument("--backup-id")
    parser.add_argument("--expected-origin", type=UUID)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--maintenance",
        action="store_true",
        help="Confirma que web/API estão parados e as exceções foram conferidas.",
    )
    args = parser.parse_args()
    ledger = Ledger(args.ledger)
    try:
        if args.action == "init":
            print(ledger.initialize())
            return 0
        if args.action == "validate-backup":
            state = ledger.read()
            if args.expected_origin != state.origem or args.backup_id is None:
                raise ValueError("Backup sem registro de exclusões correspondente.")
            age = datetime.now(UTC) - snapshot_time(args.backup_id)
            if age < timedelta(0) or age > timedelta(days=30):
                raise ValueError("Backup fora da janela de restauração de 30 dias.")
            verify_package(args.backup_root / args.backup_id)
            print("Registro externo e prazo do backup conferidos.")
            return 0
        if args.apply and not args.maintenance:
            raise ValueError("Aplicação exige --maintenance e API/web parados.")
        if args.action == "backups":
            ledger.read()
            print(json.dumps(expire_backups(args.backup_root, apply=args.apply)))
            return 0
        settings = Settings()
        if settings.db_user != "smart_migrator":
            raise ValueError("Use o serviço de manutenção, com credencial separada.")
        engine = create_database_engine(settings)
        store = S3PrivateStorage(settings)
        try:
            with ledger.locked():
                result: dict[str, object] = {"simulacao": not args.apply}
                if args.action == "erase":
                    if (
                        args.id is None
                        or args.actor is None
                        or args.version is None
                        or args.reason is None
                    ):
                        raise ValueError("Informe --id, --actor, --version e --reason.")
                    entry = prepare_erasure(
                        engine,
                        ledger,
                        args.id,
                        args.actor,
                        args.version,
                        args.reason,
                        apply=args.apply,
                    )
                    result.update(
                        erase_registration(
                            engine, store, ledger, entry, apply=args.apply
                        )
                    )
                elif args.action in ("expire", "replay"):
                    if args.action == "replay":
                        result.update(
                            replay_erasures(engine, store, ledger, apply=args.apply)
                        )
                    else:
                        result["fotos_revogadas"] = expire_files(
                            engine, store, ledger, apply=args.apply
                        )
                    expired = expire_records(engine, apply=args.apply)
                    expired_totals = expired.copy()
                    if args.action == "replay" and args.apply:
                        while any(expired.values()):
                            expired = expire_records(engine, apply=True)
                            for key, count in expired.items():
                                expired_totals[key] += count
                    result.update(expired_totals)
                    result.update(compact_ledger(engine, ledger, apply=args.apply))
                elif args.action == "hold":
                    if (
                        args.id is None
                        or args.actor is None
                        or args.until is None
                        or args.until.tzinfo is None
                        or args.until <= datetime.now(UTC)
                        or not re.fullmatch(
                            r"[A-Za-z0-9_-]{3,80}", args.reference or ""
                        )
                    ):
                        raise ValueError(
                            "Informe --id, --actor, --until futuro com fuso e "
                            "--reference como código sem dados pessoais."
                        )
                    with Session(engine) as session, session.begin():
                        privileged(session)
                        active_actor(session, args.actor)
                        if args.apply:
                            hold = PreservationRecord(
                                entidade_id=args.id,
                                responsavel_id=args.actor,
                                referencia=args.reference,
                                registrado_em=datetime.now(UTC),
                                ate=args.until,
                            )
                            ledger.preserve(hold)
                            session.merge(
                                Preservation(
                                    entidade_id=args.id,
                                    responsavel_id=args.actor,
                                    referencia=args.reference,
                                    registrado_em=hold.registrado_em,
                                    ate=args.until,
                                )
                            )
                            session.add(
                                AuditEvent(
                                    id=hold.id,
                                    administrador_id=args.actor,
                                    entidade="preservacao",
                                    entidade_id=args.id,
                                    acao="preservar",
                                    antes=None,
                                    depois={
                                        "referencia": args.reference,
                                        "ate": args.until.isoformat(),
                                    },
                                )
                            )
                    result["preservacao"] = str(args.id)
                elif args.action == "review":
                    moment = datetime.now(UTC)
                    with Session(engine) as session:
                        privileged(session)
                        records = session.scalars(
                            select(Registration)
                            .where(
                                Registration.encerrado_em.is_(None),
                                Registration.status.in_(["pendente", "reprovado"]),
                            )
                            .order_by(Registration.criado_em)
                        )
                        due: list[str] = []
                        for record in records:
                            start = record.criado_em
                            if record.status == "reprovado":
                                event = session.scalar(
                                    select(RegistrationHistory.ocorrido_em)
                                    .where(
                                        RegistrationHistory.cadastro_id == record.id,
                                        RegistrationHistory.acao == "reprovacao",
                                    )
                                    .order_by(RegistrationHistory.ocorrido_em.desc())
                                    .limit(1)
                                )
                                if event is None:
                                    continue
                                start = event
                            if start <= moment - timedelta(days=90):
                                due.append(str(record.id))
                        result["revisar_sem_excluir"] = due
                print(json.dumps(result, ensure_ascii=False))
        finally:
            store.close()
            engine.dispose()
    except (ValueError, OSError, SQLAlchemyError, ApiProblem):
        # Não imprimir payload, conexão ou exceção de validação com dados pessoais.
        print(
            "Operação interrompida. Confira parâmetros e registro externo. "
            "banco e armazenamento. Resolva as pendências antes de reiniciar a API."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
