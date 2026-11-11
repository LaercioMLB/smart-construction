# Estado do laboratório — 11/11/2026

Base preparada como projeto independente, a partir do commit registrado em ORIGEM.json. Interface adaptada para a empresa fictícia Smart Construction; identidade, contatos, identificação cadastral e textos institucionais da origem foram substituídos. Preservados catálogo, preços, rotas de serviços, imagens e proveniência técnica, sem alegar equivalência integral com a origem.

## Verificações executadas

| Verificação    | Resultado                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Instalação npm | `npm ci` com cache local e `--offline`, 480 pacotes                                                                       |
| Formatação     | `npm run format:fix`                                                                                                      |
| TypeScript     | `npm run typecheck`, aprovado; também conferido pelo build final                                                          |
| ESLint         | `npm run lint`, aprovado                                                                                                  |
| Frontend       | 85 testes unitários, 9 arquivos, aprovados                                                                                |
| Setup          | 2 testes aprovados: preservação de .env/senhas/identidades e recusa de segredo inválido                                   |
| Build          | Next.js 16.4.2, aprovado; home dinâmica para refletir profissionais publicados                                            |
| Navegador      | 6 testes Chromium sobre build de produção temporário, sem API; busca, filtros, canal local, textos, menu e responsividade |
| Telas          | Sem overflow horizontal nas rotas /, /servicos, /catalogo, /sobre e /contato, em 1440 e 390px                             |
| Python         | Ruff check/format e mypy aprovados, 56 arquivos de código tipados                                                         |
| Backend local  | 77 testes aprovados; 52 de integração não selecionados                                                                    |
| Lock Python    | `uv lock --check --offline` com Python 3.12 e uv 0.13.5, aprovado                                                         |
| Contrato       | `python scripts/validate-openapi.py`, 31 testes aprovados, ferramentas isoladas                                           |
| Compose        | `docker-compose config --quiet`, aprovado; sem iniciar serviços                                                           |
| Proveniência   | Cinco JSON originais de fontes/geração de imagens preservados byte a byte                                                 |

As verificações usaram a cópia de preparação, antes da transferência para o repositório. O manifesto da transferência confere SHA-256 de cada arquivo. Nenhum teste usa banco, conta, segredo ou volume da aplicação de origem.

As capturas da home estão em [desktop](evidence/laboratory/home-1440.png) e [celular](evidence/laboratory/home-390.png). Elas documentam a interface desta versão; não são baselines de comparação com a SOS Construir. Os testes também verificam ausência de requisições externas no navegador e de erros de execução/hidratação.

## Execução local

Na execução local de 11/11/2026, o Docker Engine estava ativo. Foram executados o setup documentado, os dois testes de setup, `docker compose -p smart-construction config --quiet` e `docker compose -p smart-construction up -d --build --wait --wait-timeout 300`, todos com sucesso. O build Linux da API e do frontend foi concluído; o build Next.js também aprovou a verificação TypeScript. API, frontend, gateway, PostgreSQL 17 e os dois armazenamentos ficaram saudáveis. A migration e a inicialização dos buckets terminaram com código 0, usando somente a rede e os três volumes `smart-construction`.

O endereço `http://localhost:8081` retornou HTTP 200 com a página Smart Construction. O smoke passou pelo host (`node scripts/smoke.mjs`) e pelo container web (`docker compose -p smart-construction exec -T -e SMOKE_BASE_URL=http://gateway web node /app/scripts/smoke.mjs`), verificando páginas, API/banco, disponibilidade do formulário, versões dos aceites e resposta 401 da área administrativa sem autenticação. Esses checks não gravam cadastros. Os containers permaneceram em execução para acesso local.

## Atualização visual e acesso administrativo — 11/11/2026

Adicionado o botão **Painel de admin** ao cabeçalho, visível em computador e celular, com acesso a `/admin/login`. O rodapé usa o mesmo nome. A autenticação continua obrigatória. A navegação completa entra no menu móvel abaixo de 1280 px para acomodar as ações do cabeçalho.

A identidade visual usa verde `#166534`, vermelho `#c62828` e branco, com variações centralizadas nos tokens `brand` e `accent`. Aplicada às páginas públicas, formulários e administração, incluindo logo, favicon, foco de teclado e seleção de texto. Os cards com fotografias usam ícones vermelhos sobre fundo claro e links brancos para manter a leitura. A home também foi ajustada para não exceder a largura em telas de 320 px.

| Verificação            | Resultado                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependências           | `npm ci --cache .cache/npm`, 480 pacotes; Chromium instalado no cache do projeto                                                                                                                          |
| Formatação             | `npx prettier --check src tests/e2e/laboratory.spec.ts`, aprovado                                                                                                                                         |
| TypeScript e lint      | `npm run typecheck` e `npm run lint`, aprovados                                                                                                                                                           |
| Frontend e setup       | `npm test`: 85 testes em 9 arquivos; `npm run test:setup`: 2 testes, todos aprovados                                                                                                                      |
| Build e execução       | Build de produção Next.js pelo Docker, com TypeScript aprovado; frontend e gateway atualizados e saudáveis em `http://localhost:8081`                                                                     |
| Navegador              | `TEST_BASE_URL=http://127.0.0.1:8081 npm run test:e2e`: 6 testes Chromium aprovados; o teste administrativo clica no novo botão em computador e celular                                                   |
| Responsividade e cores | Conferência adicional no Chromium em 320, 375, 390, 768, 1024, 1279, 1280 e 1440 px, sem overflow, cortes ou sobreposição do cabeçalho; cores renderizadas de títulos, botões, rodapé e fundo confirmadas |
| Backend                | Container `api-test`: `ruff check .`, `ruff format --check .` (74 arquivos), `mypy` (56 arquivos) e `pytest` (129 testes, incluindo os 52 de integração), todos aprovados                                 |
| Smoke final            | `node scripts/smoke.mjs`, PASS com API/banco e proteção administrativa ativos                                                                                                                             |

Capturas atualizadas: [computador](evidence/laboratory/home-green-red-1440.png) e [celular](evidence/laboratory/home-green-red-390.png). O E2E usa o seletor de ordenação acessível por função para interagir com o controle visível durante a navegação. Os testes de integração usaram bancos isolados `smart_test_<uuid>`, sem usar os dados da instalação como fixtures.

## Conta administrativa local — 11/11/2026

Criada manualmente, a pedido do usuário, a conta `admin` com nome sintético Administrador do laboratório, usando `docker compose -p smart-construction exec api python -m app.auth.cli create --login admin --nome "Administrador do laboratório"`. A senha aleatória foi informada e confirmada pelo prompt oculto do CLI, sem ser gravada no código ou nesta documentação. O setup permanece sem criação automática de administradores.

Login validado pelo Chromium em `http://localhost:8081/admin/login`: acesso ao painel de profissões e resposta HTTP 200 da consulta administrativa de cadastros. A sessão de verificação foi encerrada pelo botão Sair; a consulta voltou a responder HTTP 401. Nenhum cadastro ou profissão foi criado nessa verificação.

## README de execução e uso local — 11/11/2026

README reescrito como guia de execução local e utilização: requisitos, setup para Windows e Linux/macOS, inicialização pelo Docker, criação manual do administrador, carga manual de profissões, navegação, cadastros, análise administrativa, encerramento e retomada. Incluídas orientações para falhas comuns, redefinição de senha por prompt oculto e smoke. Comandos e comportamentos conferidos com os scripts, Compose, CLI e componentes existentes; nenhuma credencial foi incluída no guia.

Alteração somente de documentação. `npx prettier --check README.md docs/STATUS.md`, `docker compose -p smart-construction config --quiet` e o smoke documentado pelo container web aprovados (PASS). Suítes de frontend/backend e build não foram repetidos; nenhum cadastro, profissão ou credencial foi alterado nessa revisão.

## Escopo e identidade da Bubikas Holdings — 11/11/2026

O escopo apresenta o Smart Construction como um projeto da Bubikas Holdings, holding fictícia conhecida pelo sucesso do Organizadin. Atualizados o contexto, o objetivo da contratação e a identificação da contratante na proposta de custos; preservados os requisitos de infraestrutura, entregas, critérios de aceite e limites do exercício.

Criada com a ferramenta nativa imagegen uma logo minimalista de coruja, com assinatura Bubikas Holdings em vermelho e transparência preservada. O arquivo está em `docs/branding/bubikas-holdings-logo.png`; o briefing e o prompt completo estão em `docs/branding/README.md`. A identidade vermelha e branca foi aplicada à capa, aos cabeçalhos, aos títulos e aos rodapés de `escopo.pdf`, com quatro páginas A4. O conteúdo-fonte permanece em `docs/escopo.md`.

O gerador `scripts/render-escopo.py` usa ReportLab, lê o Markdown e a logo local e incorpora fontes Vera. Dependências de geração em `docs/pdf-requirements.txt`. Validados sintaxe Python, Ruff check/format do gerador, geração do PDF, revisão visual das quatro páginas, metadados da Bubikas Holdings, presença integral das oito seções e de todos os parágrafos/itens, paginação, limites de texto e canal alpha da logo. O PDF regenerado após a formatação manteve o texto integral da versão revisada. Formatação da documentação conferida com Prettier. Ferramentas de leitura/renderização instaladas somente no cache do projeto.

Alterações restritas ao escopo, às peças de identidade e às ferramentas de geração do documento. Suítes e build da aplicação não foram repetidos; serviços, dados e credenciais não foram alterados.

Na revisão seguinte, por solicitação do usuário, retiradas as qualificações “fictícia” do contexto e “cenário fictício” do rodapé da capa. Atualizados o Markdown e o gerador, e regenerado `escopo.pdf`. A extração do texto e dos metadados confirmou a ausência dessas qualificações; as quatro páginas e as margens foram preservadas. Revisadas visualmente capa e página de contexto; sintaxe Python, Ruff check/format e Prettier aprovados.

## Diagramas de conexões no escopo — 11/11/2026

Incluídas as subseções 3.1 e 3.2 no escopo, com mapas vetoriais de operação e de preparação/ferramentas. O PDF atualizado tem seis páginas. Os mapas mostram navegador, Nginx, Next.js, FastAPI, PostgreSQL, SeaweedFS editorial e privado, volumes, migrações, setup, cargas iniciais, comandos manuais e testes; identificam portas, protocolos, direção das requisições e operações sobre arquivos locais. Conferidos os 13 serviços declarados no Compose, as regras do Nginx/Next.js e os adaptadores de banco/S3.

Os arquivos SVG e Mermaid estão em `docs/diagrams/`, com fonte em `scripts/escopo_diagrams.py`; a geração do PDF atualiza os dois formatos usando os mesmos nós e conexões. Atualizados o gerador do escopo e a referência em `docs/ARQUITETURA.md`. A topologia documentada é a do ambiente local; a proposta de VMs e rede de nuvem permanece parte da atividade.

Validados sintaxe Python, Ruff check/format dos dois geradores, Prettier da documentação, geração e revisão visual do PDF, presença integral das oito seções e das duas novas subseções, paginação, margens, rótulos dos diagramas, origem/destino das setas, cobertura dos serviços do Compose e estrutura dos SVGs. Confirmada a ausência das qualificações retiradas na revisão anterior. Suítes e build da aplicação não foram repetidos; configuração, serviços, dados e credenciais não foram alterados.

## Versionamento local — 11/11/2026

Por solicitação do usuário, mudanças organizadas em dois commits locais: aplicação e execução local; escopo da Bubikas Holdings, identidade e mapas de conexões. Revisados 670 arquivos elegíveis para versionamento, com `.env`, `.secrets/`, caches, dependências e resultados temporários fora do índice. A comparação com as credenciais locais dos serviços não encontrou correspondências nos arquivos selecionados.

Conferidos os arquivos do índice contra as listas revisadas e executado `git diff --cached --check` em cada grupo. O PDF foi marcado como binário em `.gitattributes` para preservar seu conteúdo durante a normalização de finais de linha; conferida a igualdade dos bytes entre arquivo local e índice. A formatação da documentação foi aprovada com Prettier. As suítes e o build não foram repetidos nesta etapa; as verificações da aplicação e do PDF estão registradas acima. Nenhum push ou publicação foi solicitado.

## Pendências reais

O CI não foi executado no GitHub. O fluxo persistente completo de cadastro/empresa/aprovação pelo navegador continua pendente; o E2E e o smoke desta alteração não criam cadastros.

Próximo passo: carregar manualmente as 25 profissões e validar cadastro, imagem, aprovação, publicação e persistência após reinício. A conta administrativa local já foi criada manualmente, conforme registrado acima; nenhuma profissão foi carregada nesta execução.

Nenhum banco, administrador ou dado privado foi copiado. Sem push, publicação ou implantação em nuvem. O cenário de infraestrutura de duas VMs é uma tarefa a ser desenvolvida pelos alunos, não uma configuração já entregue.
