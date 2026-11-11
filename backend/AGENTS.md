# Backend Smart Construction

Leia ../AGENTS.md, ../docs/ARQUITETURA.md e ../docs/STATUS.md.
Python 3.12, uv 0.13.5, FastAPI, PostgreSQL 17 e Alembic. Preserve Ruff/mypy estritos.
Runtime smart_api separado de smart_migrator; schema smart; env SMART_API_.
Não aplicar migrations durante startup da API. Segredos em arquivos; nenhuma conta padrão.
Autenticação administrativa com cookie HttpOnly, CSRF/Origin e versionamento If-Match.
Somente dados sintéticos. Imagens privadas no bucket smart-cadastros-private; só profissionais aprovados/publicados têm projeção pública.
Testes de integração criam/removem somente smart_test_<uuid>. CLI de retenção permanece manual, em simulação por padrão; não agendar limpeza.
Não importar fixtures, administradores ou dados da aplicação de origem.
