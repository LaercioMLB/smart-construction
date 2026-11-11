from collections.abc import Callable, Iterator
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response, Security
from fastapi.security import APIKeyCookie, APIKeyHeader
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.arquivos.models import PrivateFile
from app.arquivos.storage import PrivateStorage
from app.auditoria.schemas import HistoricoPagina
from app.auth.schemas import Login, Sessao
from app.auth.security import COOKIE, COOKIE_PATH, SESSION_SECONDS
from app.auth.service import Principal, authenticate, check_csrf, login_session
from app.cadastros.models import Registration
from app.cadastros.review_routes import review_router
from app.core.errors import Erro
from app.core.problems import ApiProblem
from app.core.settings import Settings
from app.profissoes.schemas import (
    ProfissaoAdministrativa,
    ProfissaoAlteracao,
    ProfissaoCriacao,
    ProfissoesAdministrativas,
    ProfissoesPublicas,
)
from app.profissoes.service import (
    create_profession,
    edit_profession,
    list_professions,
    profession_history,
)


def admin_router(
    settings: Settings,
    engine: Callable[[], Engine],
    storage: Callable[[], PrivateStorage],
) -> APIRouter:
    router = APIRouter(
        prefix="/api/v1",
        responses={
            status: {"model": Erro}
            for status in (401, 403, 404, 409, 412, 413, 422, 428, 429, 503)
        },
    )
    cookie = APIKeyCookie(name=COOKIE, auto_error=False, scheme_name="AdminSession")
    csrf = APIKeyHeader(name="X-CSRF-Token", auto_error=False, scheme_name="CsrfToken")

    def connection() -> Iterator[Session]:
        with Session(engine()) as session, session.begin():
            yield session

    def origin(request: Request) -> None:
        supplied = request.headers.get("origin")
        if supplied not in settings.allowed_origins or (
            settings.environment == "production" and not supplied.startswith("https://")
        ):
            raise ApiProblem(
                403, "ORIGIN_INVALID", "Origem da requisição não autorizada."
            )

    def principal(
        request: Request,
        token: Annotated[str | None, Security(cookie)],
        session: Annotated[Session, Depends(connection, scope="function")],
    ) -> Principal:
        return authenticate(session, token)

    def writer(
        request: Request,
        user: Annotated[Principal, Depends(principal)],
        supplied: Annotated[str | None, Security(csrf)],
    ) -> Principal:
        origin(request)
        check_csrf(user, supplied)
        return user

    @router.post(
        "/admin/sessao",
        response_model=Sessao,
        operation_id="criarSessao",
        dependencies=[Depends(origin)],
    )
    def login(data: Login, request: Request, response: Response) -> Sessao:
        result, token = login_session(
            engine(),
            data.login,
            data.senha.get_secret_value(),
            request.cookies.get(COOKIE),
        )
        response.set_cookie(
            COOKIE,
            token,
            max_age=SESSION_SECONDS,
            path=COOKIE_PATH,
            httponly=True,
            secure=settings.environment == "production",
            samesite="lax",
        )
        return result

    @router.get("/admin/sessao", response_model=Sessao, operation_id="consultarSessao")
    def current(user: Annotated[Principal, Depends(principal)]) -> Sessao:
        return user.response()

    @router.delete(
        "/admin/sessao",
        status_code=204,
        operation_id="encerrarSessao",
        openapi_extra={"security": [{"AdminSession": [], "CsrfToken": []}]},
    )
    def logout(
        response: Response,
        user: Annotated[Principal, Depends(writer)],
        session: Annotated[Session, Depends(connection, scope="function")],
    ) -> None:
        session.delete(user.session)
        response.delete_cookie(
            COOKIE,
            path=COOKIE_PATH,
            httponly=True,
            secure=settings.environment == "production",
            samesite="lax",
        )

    @router.get(
        "/profissoes",
        response_model=ProfissoesPublicas,
        operation_id="listarProfissoesAtivas",
    )
    def public_list(
        session: Annotated[Session, Depends(connection, scope="function")],
        page: Annotated[int, Query(ge=1)] = 1,
        limit: Annotated[int, Query(ge=1, le=100)] = 20,
        search: Annotated[str, Query(max_length=120)] = "",
    ) -> ProfissoesAdministrativas | ProfissoesPublicas:
        return list_professions(
            session, page=page, limit=limit, search=search, active=True, public=True
        )

    @router.get(
        "/admin/profissoes",
        response_model=ProfissoesAdministrativas,
        operation_id="listarProfissoesAdministrativas",
        dependencies=[Depends(principal)],
    )
    def admin_list(
        session: Annotated[Session, Depends(connection, scope="function")],
        page: Annotated[int, Query(ge=1)] = 1,
        limit: Annotated[int, Query(ge=1, le=100)] = 20,
        search: Annotated[str, Query(max_length=120)] = "",
        ativo: bool | None = None,
    ) -> ProfissoesAdministrativas | ProfissoesPublicas:
        return list_professions(
            session, page=page, limit=limit, search=search, active=ativo, public=False
        )

    @router.post(
        "/admin/profissoes",
        status_code=201,
        response_model=ProfissaoAdministrativa,
        operation_id="criarProfissao",
        openapi_extra={"security": [{"AdminSession": [], "CsrfToken": []}]},
    )
    def create(
        data: ProfissaoCriacao,
        response: Response,
        user: Annotated[Principal, Depends(writer)],
        session: Annotated[Session, Depends(connection, scope="function")],
    ) -> ProfissaoAdministrativa:
        result = create_profession(session, data, user.administrator.id)
        response.headers["ETag"] = f'"{result.versao}"'
        return result

    @router.patch(
        "/admin/profissoes/{profissao_id}",
        response_model=ProfissaoAdministrativa,
        operation_id="editarProfissao",
        openapi_extra={"security": [{"AdminSession": [], "CsrfToken": []}]},
    )
    def edit(
        profissao_id: UUID,
        data: ProfissaoAlteracao,
        request: Request,
        response: Response,
        user: Annotated[Principal, Depends(writer)],
        session: Annotated[Session, Depends(connection, scope="function")],
        if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    ) -> ProfissaoAdministrativa:
        result = edit_profession(
            session,
            profissao_id,
            data,
            user.administrator.id,
            if_match,
        )
        response.headers["ETag"] = f'"{result.versao}"'
        return result

    @router.get(
        "/admin/profissoes/{profissao_id}/historico",
        response_model=HistoricoPagina,
        operation_id="consultarHistoricoProfissao",
        dependencies=[Depends(principal)],
    )
    def history(
        profissao_id: UUID,
        session: Annotated[Session, Depends(connection, scope="function")],
        page: Annotated[int, Query(ge=1)] = 1,
        limit: Annotated[int, Query(ge=1, le=100)] = 20,
    ) -> HistoricoPagina:
        return profession_history(session, profissao_id, page, limit)

    @router.get(
        "/admin/arquivos/{arquivo_id}",
        operation_id="consultarImagemPrivada",
        response_class=Response,
        responses={
            200: {
                "content": {
                    "image/jpeg": {"schema": {"type": "string", "format": "binary"}},
                    "image/png": {"schema": {"type": "string", "format": "binary"}},
                }
            }
        },
        dependencies=[Depends(principal)],
    )
    def private_image(
        arquivo_id: UUID,
        session: Annotated[Session, Depends(connection, scope="function")],
    ) -> Response:
        record = session.get(PrivateFile, arquivo_id)
        if record is None or record.estado != "pronto":
            raise ApiProblem(404, "NOT_FOUND", "Arquivo não encontrado.")
        registration = session.get(Registration, record.cadastro_id)
        if registration is None or registration.encerrado_em is not None:
            raise ApiProblem(404, "NOT_FOUND", "Arquivo não encontrado.")
        store = storage()
        if record.bucket != store.bucket:
            raise ApiProblem(404, "NOT_FOUND", "Arquivo não encontrado.")
        content = store.get(record.chave, record.tamanho_bytes, record.sha256)
        extension = "jpg" if record.content_type == "image/jpeg" else "png"
        filename = f"imagem-{record.id}.{extension}"
        return Response(
            content,
            media_type=record.content_type,
            headers={
                "X-Content-Type-Options": "nosniff",
                "Content-Disposition": f'inline; filename="{filename}"',
            },
        )

    router.include_router(review_router(connection, principal, writer, storage, engine))
    return router
