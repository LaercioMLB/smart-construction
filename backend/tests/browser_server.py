"""API real com banco descartável, usada exclusivamente pela suíte de navegador."""

import os
from uuid import uuid4

import uvicorn
from alembic import command
from conftest import temporary_database
from registration_samples import company_data, professional_data
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session
from test_private_storage_integration import remove_test_objects, storage_settings
from test_registration_validation import png_bytes

from app.arquivos.images import prepare_image
from app.arquivos.models import UploadJournal
from app.arquivos.storage import S3PrivateStorage
from app.auth.cli import manage_admin
from app.cadastros.schemas import EmpresaDadosEntrada, ProfissionalDadosEntrada
from app.cadastros.service import accept_registration
from app.core.database import create_database_engine
from app.core.settings import Settings
from app.main import create_app
from app.profissoes.models import Profession


def main() -> None:
    if os.environ.get("SMART_BROWSER_TESTS") != "1":
        raise SystemExit("Defina SMART_BROWSER_TESTS=1 no serviço api-test.")
    password = os.environ.get("SMART_BROWSER_PASSWORD")
    if not password:
        raise SystemExit("Defina uma senha sintética em SMART_BROWSER_PASSWORD.")
    with temporary_database() as database:
        command.upgrade(database.config(), "head")
        settings = Settings(
            **(
                storage_settings(database).model_dump()
                | {
                    "environment": "test",
                    "terms_version": os.environ.get(
                        "SMART_BROWSER_TERMS_VERSION", "teste-v1"
                    ),
                    "privacy_version": os.environ.get(
                        "SMART_BROWSER_PRIVACY_VERSION", "teste-v1"
                    ),
                    "registrations_enabled": os.environ.get("SMART_BROWSER_PUBLIC")
                    == "1",
                    "allowed_origins": [
                        os.environ.get("SMART_BROWSER_ORIGIN", "http://127.0.0.1:3005")
                    ],
                }
            )
        )
        manage_admin(
            settings,
            action="create",
            login="admin.e2e",
            name="Administrador de Teste",
            password=password,
        )
        engine = create_database_engine(settings)
        store = S3PrivateStorage(settings)
        try:
            with Session(engine) as session, session.begin():
                session.add(
                    Profession(
                        nome="Pintor de Análise E2E",
                        slug="pintor-analise-e2e",
                        ativo=True,
                    )
                )
            if not settings.registrations_enabled:
                seed_registrations(engine, settings, store)
            uvicorn.run(
                create_app(settings, storage=store),
                host="0.0.0.0",
                port=8000,
                access_log=False,
                log_level="warning",
            )
        finally:
            with Session(engine) as session:
                keys = list(session.scalars(select(UploadJournal.chave)))
            remove_test_objects(store, keys)
            store.close()
            engine.dispose()


def seed_registrations(
    engine: Engine, settings: Settings, store: S3PrivateStorage
) -> None:
    accept_registration(
        engine,
        settings,
        store,
        ProfissionalDadosEntrada.model_validate(professional_data()),
        [
            prepare_image(
                png_bytes(),
                content_type="image/png",
                purpose="foto_perfil",
                order=0,
            )
        ],
        uuid4(),
    )
    accept_registration(
        engine,
        settings,
        store,
        EmpresaDadosEntrada.model_validate(company_data()),
        [],
        uuid4(),
    )


if __name__ == "__main__":
    main()
