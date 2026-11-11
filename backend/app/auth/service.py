import hmac
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from threading import BoundedSemaphore

from sqlalchemy import Engine, case, delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth.models import Administrator, AdminSession, LoginLimit
from app.auth.schemas import Administrador, Sessao
from app.auth.security import (
    SESSION_SECONDS,
    csrf_token,
    password_matches,
    session_hash,
    valid_session_token,
)
from app.core.problems import ApiProblem

_password_slots = BoundedSemaphore(2)


@dataclass(frozen=True)
class Principal:
    administrator: Administrator
    session: AdminSession
    token: str

    def response(self) -> Sessao:
        return Sessao(
            administrador=Administrador.model_validate(self.administrator),
            expira_em=self.session.expira_em,
            csrf_token=csrf_token(self.token),
        )


def authenticate(session: Session, token: str | None) -> Principal:
    if token is None or not valid_session_token(token):
        raise ApiProblem(
            401, "UNAUTHENTICATED", "Entre com sua conta de administrador."
        )
    result = session.execute(
        select(Administrator, AdminSession)
        .join(AdminSession, AdminSession.administrador_id == Administrator.id)
        .where(
            AdminSession.token_hash == session_hash(token),
            AdminSession.expira_em > datetime.now(UTC),
            Administrator.ativo.is_(True),
        )
    ).one_or_none()
    if result is None:
        raise ApiProblem(401, "UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.")
    return Principal(result[0], result[1], token)


def check_csrf(principal: Principal, supplied: str | None) -> None:
    if (
        not supplied
        or not re.fullmatch(r"[a-f0-9]{64}", supplied)
        or not hmac.compare_digest(csrf_token(principal.token), supplied)
    ):
        raise ApiProblem(403, "CSRF_INVALID", "Atualize a página e tente novamente.")


def reserve_attempt(engine: Engine, login: str) -> None:
    now = datetime.now(UTC)
    limited = False
    with Session(engine) as session, session.begin():
        admin_id = session.scalar(
            select(Administrator.id).where(Administrator.login == login)
        )
        # Contas existentes e dois buckets fixos, sem guardar IP/login nas chaves.
        for key, maximum in (
            ("global", 60),
            (str(admin_id) if admin_id else "unknown", 10),
        ):
            expired = LoginLimit.inicio <= now - timedelta(minutes=15)
            statement = insert(LoginLimit).values(chave=key, inicio=now, tentativas=1)
            count = session.scalar(
                statement.on_conflict_do_update(
                    index_elements=[LoginLimit.chave],
                    set_={
                        "inicio": case((expired, now), else_=LoginLimit.inicio),
                        "tentativas": case(
                            (expired, 1), else_=LoginLimit.tentativas + 1
                        ),
                    },
                ).returning(LoginLimit.tentativas)
            )
            if count is None or count > maximum:
                limited = True
    if limited:
        raise ApiProblem(
            429,
            "LOGIN_LIMIT",
            "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
        )


def login_session(
    engine: Engine, login: str, password: str, old_token: str | None
) -> tuple[Sessao, str]:
    login = login.strip().casefold()
    reserve_attempt(engine, login)
    with Session(engine, expire_on_commit=False) as session, session.begin():
        administrator = session.scalar(
            select(Administrator).where(Administrator.login == login).with_for_update()
        )
        with _password_slots:
            matches = password_matches(
                password, administrator.senha_hash if administrator else None
            )
        if administrator is None or not matches or not administrator.ativo:
            raise ApiProblem(401, "INVALID_CREDENTIALS", "Login ou senha inválidos.")
        now = datetime.now(UTC)
        session.execute(delete(AdminSession).where(AdminSession.expira_em <= now))
        if old_token and valid_session_token(old_token):
            session.execute(
                delete(AdminSession).where(
                    AdminSession.token_hash == session_hash(old_token)
                )
            )
        token = secrets.token_urlsafe(48)
        record = AdminSession(
            token_hash=session_hash(token),
            administrador_id=administrator.id,
            expira_em=now + timedelta(seconds=SESSION_SECONDS),
        )
        session.add(record)
        session.flush()
        return Principal(administrator, record, token).response(), token
