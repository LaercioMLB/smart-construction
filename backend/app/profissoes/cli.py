"""Carga manual do catálogo inicial aprovado; simulação por padrão."""

import argparse
from pathlib import Path
from typing import Literal, Self

from pydantic import Field, TypeAdapter, ValidationError, model_validator
from sqlalchemy import Engine, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.models import Administrator
from app.auth.schemas import Contract, LoginName
from app.core.database import create_database_engine
from app.core.problems import ApiProblem
from app.core.settings import Settings
from app.profissoes.models import Profession
from app.profissoes.schemas import ProfissaoCriacao, profession_slug
from app.profissoes.service import create_profession


class CatalogEntry(ProfissaoCriacao):
    servicos_referencia: list[str] = Field(min_length=1)


class InitialCatalog(Contract):
    status: Literal["base_aprovada"]
    versao: str = Field(min_length=1, max_length=80)
    origem: str
    observacao: str
    profissoes: list[CatalogEntry] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_names(self) -> Self:
        slugs = [profession_slug(item.nome) for item in self.profissoes]
        if len(set(slugs)) != len(slugs) or "outra" in slugs:
            raise ValueError("Catálogo com nomes equivalentes ou opção Outra.")
        return self


class CatalogResult(Contract):
    modo: Literal["simulacao", "aplicacao"]
    catalogo_versao: str
    existentes: int
    inativas_preservadas: int
    criadas: int
    a_criar: list[str]


def load_initial_catalog() -> InitialCatalog:
    path = Path(__file__).with_name("catalogo-inicial.json")
    return InitialCatalog.model_validate_json(path.read_text(encoding="utf-8"))


def populate_catalog(
    engine: Engine,
    catalog: InitialCatalog,
    *,
    apply: bool = False,
    admin_login: str | None = None,
) -> CatalogResult:
    login = (
        TypeAdapter(LoginName).validate_python(admin_login).casefold()
        if admin_login is not None
        else None
    )
    with Session(engine) as session, session.begin():
        administrator = None
        if apply:
            if login is None:
                raise ValueError("Informe --admin-login ao aplicar o catálogo.")
            administrator = session.scalar(
                select(Administrator)
                .where(Administrator.login == login, Administrator.ativo.is_(True))
                .with_for_update(read=True)
            )
            if administrator is None:
                raise ValueError("Administrador ativo não encontrado.")
            # Serializa duas cargas; criação pelo painel mantém sua unicidade normal.
            session.execute(text("SELECT pg_advisory_xact_lock(27182424)"))
        else:
            session.execute(text("SET TRANSACTION READ ONLY"))
        slugs = [profession_slug(item.nome) for item in catalog.profissoes]
        existing = {
            item.slug: item
            for item in session.scalars(
                select(Profession).where(Profession.slug.in_(slugs))
            )
        }
        missing = [
            item
            for item in catalog.profissoes
            if profession_slug(item.nome) not in existing
        ]
        created = 0
        if administrator is not None:
            for item in missing:
                create_profession(
                    session,
                    ProfissaoCriacao(nome=item.nome, ativo=True),
                    administrator.id,
                )
                created += 1
        return CatalogResult(
            modo="aplicacao" if apply else "simulacao",
            catalogo_versao=catalog.versao,
            existentes=len(existing),
            inativas_preservadas=sum(not item.ativo for item in existing.values()),
            criadas=created,
            a_criar=[] if apply else [item.nome for item in missing],
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Gravar com auditoria.")
    parser.add_argument("--admin-login", help="Administrador ativo autor da carga.")
    args = parser.parse_args()
    engine = None
    try:
        catalog = load_initial_catalog()
        if args.apply and args.admin_login is None:
            raise ValueError("Informe --admin-login ao aplicar o catálogo.")
        engine = create_database_engine(Settings())
        result = populate_catalog(
            engine, catalog, apply=args.apply, admin_login=args.admin_login
        )
        print(result.model_dump_json(indent=2))
    except ValidationError:
        print("Catálogo ou login inválido; nenhuma carga confirmada.")
        return 1
    except ApiProblem:
        print("Conflito na carga; nenhuma criação confirmada. Simule novamente.")
        return 1
    except (OSError, RuntimeError, SQLAlchemyError):
        print("Carga não confirmada. Confira banco e catálogo; simule novamente.")
        return 1
    except ValueError as exc:
        print(str(exc))
        return 1
    finally:
        if engine is not None:
            engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
