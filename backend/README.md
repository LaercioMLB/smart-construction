# API Smart Construction

FastAPI modular, PostgreSQL 17, Alembic e SeaweedFS privado. Execução completa e criação do administrador: [README da raiz](../README.md).

As variáveis da API usam `SMART_API_`. O runtime acessa o schema `smart` como `smart_api`; migrations usam `smart_migrator`. O banco local é `smart_construction` e não publica porta no host. Não existem conta administrativa ou profissões preenchidas automaticamente.

Contrato: [OpenAPI](../docs/api/openapi.json). Autenticação, profissões, cadastros, análise, histórico, publicação e imagens foram reaproveitados da base. Cadastros são exclusivamente sintéticos; empresas e contatos ficam privados. Aceites de laboratório: `termos-lab-2026-11-11` e `privacidade-lab-2026-11-11`.

## Checks locais

Com Python 3.12 e uv 0.13.5, dentro de `backend/`:

```sh
uv sync --locked
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked mypy
uv run --locked pytest -m "not integration"
```

Suíte completa, na raiz, com os serviços do laboratório já disponíveis:

```sh
docker compose --profile tools build api-test
docker compose --profile tools run --rm api-test
```

Os testes PostgreSQL criam bancos `smart_test_<uuid>` e objetos aleatórios somente nesses bancos, sem limpar o banco da instalação. Não substituir PostgreSQL por SQLite. O CLI `app.retencao.cli` permanece ferramenta manual; não há cron nem exclusão automática.
