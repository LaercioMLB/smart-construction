# Conexões do Smart Construction

Os mapas descrevem a configuração local entregue no Compose, com as portas padrão e a identidade visual da Bubikas Holdings. Estão incluídos nas seções 3.1 e 3.2 do [escopo](../escopo.md).

| Vista                                                                         | Diagrama vetorial                  | Fonte Mermaid                          |
| ----------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------- |
| Operação: navegador, gateway, frontend, API, banco, armazenamentos e volumes  | [SVG](runtime-connections.svg)     | [Mermaid](runtime-connections.mmd)     |
| Preparação: migrações, carga inicial, comandos manuais, testes e configuração | [SVG](preparation-connections.svg) | [Mermaid](preparation-connections.mmd) |

As setas vermelhas indicam o iniciador de uma requisição; a resposta retorna pelo mesmo caminho. As setas cinzas tracejadas representam operações locais sobre arquivos ou volumes. Os nomes dos volumes omitem o prefixo `smart-construction_` para facilitar a leitura.

As informações foram conferidas em:

- `compose.yaml`: serviços, endereços internos, portas, volumes, ferramentas e condições de inicialização.
- `docker/nginx/default.conf`: encaminhamento de `/api/v1` para a API e das demais rotas para o Next.js.
- `next.config.ts` e `src/infrastructure/public-server.ts`: proxy de imagens editoriais, proxy da API e consultas do servidor Next.js à API.
- `backend/app/core/database.py` e `backend/app/arquivos/storage.py`: conexões da API com PostgreSQL e S3 privado.
- Scripts de armazenamento e `.github/workflows/ci.yaml`: cargas locais, manutenção e execução dos testes no runner.

Os dados e o desenho estão em [scripts/escopo_diagrams.py](../../scripts/escopo_diagrams.py). Executar `python scripts/render-escopo.py` regenera o PDF, os SVGs e os arquivos Mermaid a partir dos mesmos nós e conexões. O PDF incorpora os diagramas como vetores com texto selecionável.
