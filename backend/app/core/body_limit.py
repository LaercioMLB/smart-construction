from asyncio import Semaphore
from tempfile import SpooledTemporaryFile

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import error_response
from app.core.settings import Settings


class AdminBodyLimit:
    """Limita bytes antes do parser e usa spool em disco para multipart."""

    def __init__(self, app: ASGIApp, settings: Settings) -> None:
        self.app = app
        self.settings = settings
        self.upload_slots = Semaphore(4)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope["path"]
        registration = scope["method"] == "POST" and path in (
            "/api/v1/cadastros/profissionais",
            "/api/v1/cadastros/empresas",
        )
        if registration:
            if (
                not self.settings.registrations_enabled
                or not self.settings.terms_version
                or not self.settings.privacy_version
            ):
                await error_response(
                    503,
                    "REGISTRATIONS_DISABLED",
                    "Cadastros online temporariamente indisponíveis.",
                )(scope, receive, send)
                return
            if self.upload_slots.locked():
                await error_response(
                    429,
                    "UPLOAD_BUSY",
                    "Há outros envios em andamento. Aguarde e tente novamente.",
                )(scope, receive, send)
                return
            async with self.upload_slots:
                maximum = (40 if path.endswith("profissionais") else 7) * 1024 * 1024
                await self.buffer(scope, receive, send, maximum)
        elif path.startswith("/api/v1/admin/"):
            upload = (
                scope["method"] == "POST"
                and path.startswith("/api/v1/admin/cadastros/")
                and path.endswith("/arquivos")
            )
            if upload:
                if self.upload_slots.locked():
                    await error_response(
                        429, "UPLOAD_BUSY", "Há outros envios em andamento."
                    )(scope, receive, send)
                    return
                async with self.upload_slots:
                    await self.buffer(scope, receive, send, 7 * 1024 * 1024)
            else:
                await self.buffer(scope, receive, send, 16 * 1024)
        else:
            await self.app(scope, receive, send)

    async def buffer(
        self, scope: Scope, receive: Receive, send: Send, maximum: int
    ) -> None:
        with SpooledTemporaryFile(max_size=512 * 1024, mode="w+b") as spool:
            size = 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                size += len(chunk)
                if size > maximum:
                    await error_response(
                        413, "BODY_TOO_LARGE", "Requisição acima do limite permitido."
                    )(scope, receive, send)
                    return
                spool.write(chunk)
                if not message.get("more_body", False):
                    break
            spool.seek(0)
            consumed = False

            async def buffered() -> Message:
                nonlocal consumed
                if consumed:
                    return await receive()
                data = spool.read(128 * 1024)
                more = spool.tell() < size
                consumed = not more
                return {"type": "http.request", "body": data, "more_body": more}

            await self.app(scope, buffered, send)
