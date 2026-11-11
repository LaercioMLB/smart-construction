from collections.abc import Callable, Iterator
from typing import Annotated, Literal
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    Query,
    Request,
    Response,
    UploadFile,
)
from sqlalchemy import Engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.arquivos.images import MAX_FILE_BYTES, prepare_image
from app.arquivos.models import PrivateFile
from app.arquivos.storage import PrivateStorage
from app.auth.service import Principal
from app.cadastros import analysis
from app.cadastros.admin_schemas import (
    ArquivoRemocaoResultado,
    ArquivoResultado,
    CadastroAdministrativo,
    CadastroAlteracao,
    CadastrosPagina,
    HistoricoCadastrosPagina,
    Motivo,
    Status,
    Tipo,
)
from app.cadastros.file_changes import add_file, remove_file
from app.cadastros.models import Professional
from app.cadastros.publication import (
    ProfissionaisPagina,
    ProfissionalPublico,
    list_public,
    projection,
    published_person,
)
from app.cadastros.schemas import UF
from app.core.problems import ApiProblem


def review_router(
    connection: Callable[[], Iterator[Session]],
    principal: Callable[..., Principal],
    writer: Callable[..., Principal],
    storage: Callable[[], PrivateStorage],
    engine: Callable[[], Engine],
) -> APIRouter:
    router = APIRouter()

    def respond(
        response: Response, result: CadastroAdministrativo
    ) -> CadastroAdministrativo:
        response.headers["ETag"] = f'"{result.versao}"'
        return result

    @router.get(
        "/admin/cadastros",
        response_model=CadastrosPagina,
        operation_id="listarCadastros",
        dependencies=[Depends(principal)],
    )
    def listing(
        session: Annotated[Session, Depends(connection, scope="function")],
        page: Annotated[int, Query(ge=1)] = 1,
        limit: Annotated[int, Query(ge=1, le=100)] = 20,
        search: Annotated[str, Query(max_length=120)] = "",
        tipo: Tipo | None = None,
        status: Status | None = None,
    ) -> CadastrosPagina:
        return analysis.list_registrations(
            session, page=page, limit=limit, search=search, tipo=tipo, status=status
        )

    @router.get(
        "/admin/cadastros/{cadastro_id}",
        response_model=CadastroAdministrativo,
        operation_id="consultarCadastro",
        dependencies=[Depends(principal)],
    )
    def get(
        cadastro_id: UUID,
        response: Response,
        session: Annotated[Session, Depends(connection, scope="function")],
    ) -> CadastroAdministrativo:
        return respond(
            response,
            analysis.detail(session, analysis.registration(session, cadastro_id)),
        )

    @router.patch(
        "/admin/cadastros/{cadastro_id}",
        response_model=CadastroAdministrativo,
        operation_id="editarCadastro",
    )
    def edit(
        cadastro_id: UUID,
        data: CadastroAlteracao,
        response: Response,
        user: Annotated[Principal, Depends(writer)],
        session: Annotated[Session, Depends(connection, scope="function")],
        if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    ) -> CadastroAdministrativo:
        record = analysis.registration(session, cadastro_id, if_match, lock=True)
        try:
            return respond(
                response,
                analysis.edit(session, record, data, user.administrator.id, storage()),
            )
        except IntegrityError:
            raise ApiProblem(
                409, "DOCUMENT_CONFLICT", "Já existe um cadastro com esse documento."
            ) from None

    @router.get(
        "/admin/cadastros/{cadastro_id}/historico",
        response_model=HistoricoCadastrosPagina,
        operation_id="listarHistoricoCadastro",
        dependencies=[Depends(principal)],
    )
    def history(
        cadastro_id: UUID,
        session: Annotated[Session, Depends(connection, scope="function")],
        page: Annotated[int, Query(ge=1)] = 1,
        limit: Annotated[int, Query(ge=1, le=100)] = 20,
    ) -> HistoricoCadastrosPagina:
        return analysis.history(session, cadastro_id, page, limit)

    def decision_route(action: str, operation: str) -> None:
        def decide(
            cadastro_id: UUID,
            response: Response,
            user: Annotated[Principal, Depends(writer)],
            session: Annotated[Session, Depends(connection, scope="function")],
            if_match: Annotated[str | None, Header(alias="If-Match")] = None,
        ) -> CadastroAdministrativo:
            record = analysis.registration(session, cadastro_id, if_match, lock=True)
            return respond(
                response,
                analysis.decide(
                    session, record, action, user.administrator.id, storage()
                ),
            )

        router.add_api_route(
            f"/admin/cadastros/{{cadastro_id}}/{action}",
            decide,
            methods=["POST"],
            response_model=CadastroAdministrativo,
            operation_id=operation,
        )

    decision_route("aprovar", "aprovarCadastro")
    decision_route("reabrir", "reabrirCadastro")

    @router.post(
        "/admin/cadastros/{cadastro_id}/reprovar",
        response_model=CadastroAdministrativo,
        operation_id="reprovarCadastro",
    )
    def reject(
        cadastro_id: UUID,
        data: Motivo,
        response: Response,
        user: Annotated[Principal, Depends(writer)],
        session: Annotated[Session, Depends(connection, scope="function")],
        if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    ) -> CadastroAdministrativo:
        record = analysis.registration(session, cadastro_id, if_match, lock=True)
        return respond(
            response,
            analysis.decide(
                session,
                record,
                "reprovar",
                user.administrator.id,
                storage(),
                data.motivo,
            ),
        )

    def publication_route(action: str, operation: str) -> None:
        def publish(
            profissional_id: UUID,
            response: Response,
            user: Annotated[Principal, Depends(writer)],
            session: Annotated[Session, Depends(connection, scope="function")],
            if_match: Annotated[str | None, Header(alias="If-Match")] = None,
        ) -> CadastroAdministrativo:
            person = session.get(Professional, profissional_id)
            if person is None:
                raise ApiProblem(404, "NOT_FOUND", "Profissional não encontrado.")
            record = analysis.registration(
                session, person.cadastro_id, if_match, lock=True
            )
            return respond(
                response,
                analysis.decide(
                    session, record, action, user.administrator.id, storage()
                ),
            )

        router.add_api_route(
            f"/admin/profissionais/{{profissional_id}}/{action}",
            publish,
            methods=["POST"],
            response_model=CadastroAdministrativo,
            operation_id=operation,
        )

    publication_route("publicar", "publicarProfissional")
    publication_route("despublicar", "despublicarProfissional")

    @router.get(
        "/profissionais",
        response_model=ProfissionaisPagina,
        operation_id="listarProfissionaisPublicos",
    )
    def public_list(
        session: Annotated[Session, Depends(connection, scope="function")],
        page: Annotated[int, Query(ge=1)] = 1,
        limit: Annotated[int, Query(ge=1, le=100)] = 20,
        search: Annotated[str, Query(max_length=120)] = "",
        cidade: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
        uf: UF | None = None,
        profissao_id: Annotated[list[UUID] | None, Query(max_length=5)] = None,
        sort_by: Literal["relevancia", "nome"] = "relevancia",
    ) -> ProfissionaisPagina:
        return list_public(
            session,
            page=page,
            limit=limit,
            search=search,
            city=cidade,
            uf=uf,
            professions=profissao_id or [],
            sort=sort_by,
        )

    @router.get(
        "/profissionais/{profissional_id}",
        response_model=ProfissionalPublico,
        operation_id="consultarProfissionalPublico",
    )
    def public_detail(
        profissional_id: UUID,
        session: Annotated[Session, Depends(connection, scope="function")],
    ) -> ProfissionalPublico:
        return projection(session, published_person(session, profissional_id))

    @router.get(
        "/profissionais/{profissional_id}/imagens/{arquivo_id}",
        operation_id="consultarImagemPublicada",
        response_class=Response,
        responses={
            200: {
                "content": {
                    "image/jpeg": {"schema": {"type": "string", "format": "binary"}},
                    "image/png": {"schema": {"type": "string", "format": "binary"}},
                }
            }
        },
    )
    def public_image(
        profissional_id: UUID,
        arquivo_id: UUID,
        session: Annotated[Session, Depends(connection, scope="function")],
    ) -> Response:
        person = published_person(session, profissional_id)
        record = session.scalar(
            select(PrivateFile).where(
                PrivateFile.id == arquivo_id,
                PrivateFile.cadastro_id == person.cadastro_id,
                PrivateFile.estado == "pronto",
                PrivateFile.finalidade.in_(["foto_perfil", "foto_trabalho"]),
            )
        )
        store = storage()
        if record is None or record.bucket != store.bucket:
            raise ApiProblem(404, "NOT_FOUND", "Imagem não encontrada.")
        return Response(
            store.get(record.chave, record.tamanho_bytes, record.sha256),
            media_type=record.content_type,
            headers={
                "X-Content-Type-Options": "nosniff",
                "Content-Disposition": f'inline; filename="imagem-{record.id}"',
            },
        )

    async def validate_upload(request: Request) -> None:
        form = await request.form(max_files=1, max_fields=1)
        if set(form.keys()) != {"arquivo", "finalidade"} or any(
            len(form.getlist(key)) != 1 for key in form.keys()
        ):
            raise ApiProblem(
                422, "INVALID_UPLOAD", "Informe somente uma imagem e sua finalidade."
            )

    @router.post(
        "/admin/cadastros/{cadastro_id}/arquivos",
        response_model=ArquivoResultado,
        status_code=201,
        operation_id="adicionarArquivoCadastro",
        dependencies=[Depends(validate_upload)],
    )
    def upload(
        cadastro_id: UUID,
        response: Response,
        user: Annotated[Principal, Depends(writer)],
        session: Annotated[Session, Depends(connection, scope="function")],
        arquivo: Annotated[UploadFile, File()],
        finalidade: Annotated[Literal["foto_perfil", "foto_trabalho", "logo"], Form()],
        if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    ) -> ArquivoResultado:
        record = analysis.registration(session, cadastro_id, if_match, lock=True)
        image = prepare_image(
            arquivo.file.read(MAX_FILE_BYTES + 1),
            content_type=arquivo.content_type or "",
            purpose=finalidade,
            order=0,
        )
        result = add_file(
            session, engine(), record, user.administrator.id, storage(), image
        )
        response.headers["ETag"] = f'"{record.versao}"'
        return ArquivoResultado(
            arquivo=analysis.file_response(result), versao_cadastro=record.versao
        )

    @router.delete(
        "/admin/cadastros/{cadastro_id}/arquivos/{arquivo_id}",
        response_model=ArquivoRemocaoResultado,
        operation_id="removerArquivoCadastro",
    )
    def remove(
        cadastro_id: UUID,
        arquivo_id: UUID,
        response: Response,
        user: Annotated[Principal, Depends(writer)],
        session: Annotated[Session, Depends(connection, scope="function")],
        if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    ) -> ArquivoRemocaoResultado:
        record = analysis.registration(session, cadastro_id, if_match, lock=True)
        remove_file(session, record, arquivo_id, user.administrator.id, storage())
        response.headers["ETag"] = f'"{record.versao}"'
        return ArquivoRemocaoResultado(
            arquivo_id=arquivo_id, versao_cadastro=record.versao
        )

    return router
