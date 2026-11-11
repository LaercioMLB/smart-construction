# Smart Construction — laboratório de nuvem

Aplicação fictícia para o laboratório de Engenharia de Software do professor Laercio.
Leia README.md, docs/ARQUITETURA.md, docs/STATUS.md e docs/escopo.md.

- A origem SOS Construir e o projeto KubeShop são somente referências de leitura; não alterar seus serviços, arquivos, segredos ou volumes.
- Frontend Next.js em src/app, funcionalidades em src/features e contratos/adaptadores em src/infrastructure. Backend modular FastAPI em backend/; PostgreSQL 17 e SeaweedFS.
- Dados pessoais e empresas exclusivamente sintéticos. Não copiar bancos, contas ou credenciais de outros ambientes.
- Preservar tipagem estrita, isolamento de imagens privadas, autenticação/CSRF e aprovação antes da publicação de profissionais. Empresas permanecem privadas.
- Catálogo editorial local de 93 soluções e 186 produtos, sem compra/pagamento real. Não importar fixtures automaticamente para o banco.
- Cadastro habilitado apenas no laboratório por configuração explícita; textos legais são simulações versionadas. Não usar este Compose como implantação pública pronta.
- Não adicionar WhatsApp, telefones, e-mails, CNPJ ou marca da empresa de origem. Atendimento em /contato é uma simulação local.
- Conta administrativa criada manualmente, senha por prompt oculto; setup idempotente preserva credenciais.
- Use apenas volumes/projeto smart-construction para execução local. Testes de integração criam bancos smart_test_<uuid>; não usar dados da instalação como fixture.
- Antes de alterar Next.js, leia a documentação relevante em node_modules/next/dist/docs.
- Verificar typecheck, lint, testes unitários, build, setup e E2E; backend com Ruff, mypy e pytest. Registrar o que foi executado em docs/STATUS.md.
- Não criar commits, fazer push, publicar ou executar em nuvem sem pedido explícito.
- A solução de infraestrutura e seus pipelines fazem parte da tarefa dos alunos; não entregar automaticamente Terraform/deploy resolvido.
