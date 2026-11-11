import argparse
import getpass
from datetime import UTC, datetime

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auditoria.models import AuditEvent
from app.auth.models import Administrator, AdminSession
from app.auth.schemas import LoginName
from app.auth.security import password_hash
from app.core.database import create_database_engine
from app.core.settings import Settings


def manage_admin(
    settings: Settings, *, action: str, login: str, name: str | None, password: str
) -> None:
    login = TypeAdapter(LoginName).validate_python(login).casefold()
    if action == "create" and (name is None or not 3 <= len(name.strip()) <= 150):
        raise ValueError("Informe --nome com 3 a 150 caracteres.")
    encoded = password_hash(password)
    engine = create_database_engine(settings)
    try:
        with Session(engine) as session, session.begin():
            administrator = session.scalar(
                select(Administrator)
                .where(Administrator.login == login)
                .with_for_update()
            )
            if action == "create":
                if administrator is not None:
                    raise ValueError("Administrador já existe. Use reset-password.")
                administrator = Administrator(
                    nome=(name or "").strip(),
                    login=login,
                    senha_hash=encoded,
                    ativo=True,
                    criado_em=datetime.now(UTC),
                )
                session.add(administrator)
                session.flush()
            elif action == "reset-password":
                if administrator is None:
                    raise ValueError("Administrador não encontrado.")
                administrator.senha_hash = encoded
                session.execute(
                    delete(AdminSession).where(
                        AdminSession.administrador_id == administrator.id
                    )
                )
            else:
                raise ValueError("Comando inválido.")
            session.add(
                AuditEvent(
                    administrador_id=administrator.id,
                    entidade="administrador",
                    entidade_id=administrator.id,
                    acao="criar" if action == "create" else "redefinir_senha",
                    antes=None,
                    depois=None,
                )
            )
    finally:
        engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Administração local de acesso Smart Construction"
    )
    parser.add_argument("action", choices=["create", "reset-password"])
    parser.add_argument("--login", required=True)
    parser.add_argument("--nome")
    args = parser.parse_args()
    try:
        password = getpass.getpass("Senha (12 a 256 caracteres): ")
        if password != getpass.getpass("Confirme a senha: "):
            raise ValueError("As senhas não coincidem.")
        manage_admin(
            Settings(),
            action=args.action,
            login=args.login,
            name=args.nome,
            password=password,
        )
    except (ValueError, ValidationError) as exc:
        print(str(exc) if not isinstance(exc, ValidationError) else "Login inválido.")
        return 1
    except IntegrityError:
        print("Administrador já cadastrado.")
        return 1
    except SQLAlchemyError:
        print("Não foi possível acessar o banco. Confira a API e as migrations.")
        return 1
    print(
        "Administrador criado."
        if args.action == "create"
        else "Senha redefinida; sessões anteriores revogadas."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
