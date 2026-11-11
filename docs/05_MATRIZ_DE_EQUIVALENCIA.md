# Seleção da base e adaptação para laboratório

Preparação em 11/11/2026, a partir do commit registrado em [ORIGEM.json](ORIGEM.json). Esta cópia é uma adaptação didática; não afirma equivalência integral com o site de origem.

| Área             | Reaproveitado                                                       | Adaptação                                                                         |
| ---------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Frontend         | Rotas, busca, filtros, catálogo, formulários e painel               | Marca Smart Construction, home/sobre/rodapé e contato simulado                    |
| Catálogo         | 93 soluções, 186 produtos, IDs, rotas, preços e capas               | Uso ilustrativo; nenhuma oferta comercial real                                    |
| Pessoas/empresas | Contratos e fluxo de cadastro/análise/publicação                    | Banco vazio, somente dados sintéticos inseridos no exercício                      |
| API              | FastAPI modular, migrações, autenticação, CSRF, auditoria e imagens | Namespace SMART_API_, schema smart, usuários e bancos próprios                    |
| Storage          | SeaweedFS editorial e privado separados                             | Volumes e segredos novos; sem copiar objetos privados                             |
| Identidade       | Public Sans, paleta azul/laranja                                    | Novos vetores, sem logo, contatos, CNPJ e controlador originais                   |
| Termos           | Contrato de versões e aceites                                       | Textos fictícios de laboratório, versões lab-2026-11-11                           |
| Operação         | Dockerfiles, bootstrap e testes                                     | Compose local único, Nginx, setup idempotente e CI                                |
| Histórico        | Proveniência técnica/licenças dos assets                            | Sem snapshots, backups, .git, contas, segredos ou evidências operacionais antigas |
| Nuvem            | Cenário de contratação inspirado no KubeShop                        | Escopo próprio; solução de infraestrutura a cargo dos alunos                      |

Evidências atuais e limitações: [STATUS.md](STATUS.md). A fonte permanece preservada.
