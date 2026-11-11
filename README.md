# Smart Construction

Guia para executar localmente e usar o sistema de serviços, materiais e cadastros de profissionais e empresas.

Este é um ambiente fictício de laboratório. Use somente dados sintéticos; preços e imagens são ilustrativos, sem contratação, pagamento ou envio de mensagens reais.

## Como rodar localmente

### 1. Prepare o computador

- Instale o Git e o Docker com suporte a containers Linux e Docker Compose v2.20 ou superior. No Windows, use Docker Desktop.
- Abra o Docker e aguarde sua inicialização.
- Deixe a porta `8081` disponível e tenha acesso à internet para a primeira execução.

Os comandos abaixo são executados no terminal. Não é necessário instalar Node.js, Python ou PostgreSQL no computador para usar o sistema pelo Docker.

### 2. Abra a pasta do projeto

Se ainda não tiver o projeto, clone o repositório:

```sh
git clone https://github.com/LaercioMLB/smart-construction.git
cd smart-construction
```

Se já tiver os arquivos, abra o terminal na pasta que contém `compose.yaml`. Execute todos os comandos seguintes nessa pasta.

### 3. Prepare a configuração

No Windows, pelo PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

No Linux ou macOS:

```sh
sh scripts/setup.sh
```

O setup cria o arquivo `.env` e a pasta `.secrets/` com as credenciais dos serviços. Você pode executá-lo novamente: ele preserva a configuração e as credenciais existentes. A conta administrativa é criada separadamente no passo 5.

### 4. Inicie o sistema

```sh
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 300
docker compose ps -a
```

O primeiro comando não exibe saída quando a configuração está correta. A primeira inicialização pode levar alguns minutos para baixar as imagens e construir a aplicação.

Na listagem final, `api`, `web`, `gateway`, `db`, `storage` e `private-storage` devem estar em execução e saudáveis (`healthy`). Os serviços `api-migrate`, `storage-init` e `private-storage-init` terminam com `Exited (0)`, indicando que a preparação foi concluída.

Abra **[http://localhost:8081](http://localhost:8081)**.

### 5. Crie o administrador

Na primeira utilização, execute:

```sh
docker compose exec api python -m app.auth.cli create --login admin --nome "Administrador do laboratório"
```

Digite uma senha de 12 a 256 caracteres e repita para confirmar. A senha não aparece no terminal enquanto você digita.

O usuário criado será `admin`, com a senha que você escolheu. Não existe senha padrão. Se a conta já foi criada nesta instalação, use as credenciais existentes e pule este passo; executar `create` novamente não altera sua senha.

### 6. Carregue as profissões

Antes de testar os cadastros, confira a simulação da carga inicial de 25 profissões:

```sh
docker compose exec -T api python -m app.profissoes.cli
```

Depois, aplique a carga usando o administrador criado no passo anterior:

```sh
docker compose exec -T api python -m app.profissoes.cli --apply --admin-login admin
```

Se escolheu outro login, substitua `admin` no comando. A carga preserva as profissões que já existem. Você também pode criar e editar profissões pelo painel administrativo.

## Como usar o sistema

### 1. Explore as páginas públicas

Acesse [http://localhost:8081](http://localhost:8081) e navegue pelo menu:

- **Serviços:** pesquise pelo nome de um serviço ou descreva o que precisa e abra os detalhes.
- **Catálogo:** consulte os materiais, filtre por categoria ou marca e ordene por preço.
- **Portfólio** e **Blog:** explore projetos ilustrativos e conteúdos sobre construção.
- **Profissionais:** consulte os perfis aprovados e publicados. A lista começa vazia em uma instalação nova.

Os botões de orçamento levam à página de atendimento simulado, sem envio externo.

### 2. Envie um cadastro de teste

1. Clique em **Faça Parte**.
2. Escolha o cadastro de **profissional** ou **empresa**.
3. Preencha os campos obrigatórios com dados sintéticos. Os documentos informados precisam passar pelas validações do formulário.
4. No cadastro profissional, selecione as profissões e informe os demais dados solicitados. O envio de imagens é opcional.
5. Leia os textos de laboratório, marque os aceites solicitados e envie o formulário.
6. Guarde o protocolo exibido na confirmação e aguarde a análise administrativa.

Enviar um cadastro não o publica automaticamente.

### 3. Acesse o painel administrativo

1. Clique em **Painel de admin**, no cabeçalho, ou abra [http://localhost:8081/admin/login](http://localhost:8081/admin/login).
2. Entre com o login e a senha definidos no passo 5.
3. Em **Profissões**, crie, edite, ative ou desative as opções disponíveis nos cadastros.
4. Em **Cadastros**, use os filtros para localizar um profissional ou uma empresa e abra seus detalhes.
5. Revise os dados, as imagens e o histórico. Se houver sugestões de profissões pendentes, associe-as a profissões oficiais antes da aprovação.
6. Clique em **Aprovar cadastro** e confirme a ação. Para reprovar, informe o motivo e clique em **Reprovar cadastro**.
7. Após aprovar um profissional, consulte seu perfil na página pública **Profissionais**. Empresas aprovadas permanecem privadas no painel.
8. Use **Sair** ao encerrar a sessão administrativa.

No detalhe de um profissional aprovado, os botões **Despublicar profissional** e **Republicar profissional** permitem controlar sua exibição pública. Contatos pessoais e documentos permanecem restritos à administração.

## Como parar e voltar a usar

Para encerrar os serviços:

```sh
docker compose down
```

Esse comando preserva os volumes com cadastros e imagens. Mantenha também a pasta `.secrets/` para continuar acessando os dados.

Para iniciar novamente, abra o Docker, entre na pasta do projeto e execute:

```sh
docker compose up -d --wait --wait-timeout 300
```

Acesse novamente [http://localhost:8081](http://localhost:8081). Não é necessário recriar o administrador ou carregar novamente as profissões.

Se alterou o código e quer atualizar a aplicação local, use o comando com build do passo 4.

## Se algo não funcionar

- **Docker indisponível:** confira se o Docker Desktop está aberto e usando containers Linux.
- **Porta 8081 ocupada:** altere `HTTP_PORT` no `.env`, execute novamente o passo 4 e acesse o endereço com a nova porta.
- **Formulário indisponível:** confira se os serviços estão saudáveis, se `REGISTRATIONS_UI_ENABLED` e `SMART_API_REGISTRATIONS_ENABLED` estão como `true` no `.env` e se as versões dos aceites correspondem às de `.env.example`. Após ajustar, execute novamente o passo 4.
- **Administrador já existe:** use a conta criada anteriormente. Caso precise trocar a senha, execute o comando abaixo e informe a nova senha no prompt oculto:

```sh
docker compose exec api python -m app.auth.cli reset-password --login admin
```

Para consultar o estado dos serviços e suas últimas mensagens:

```sh
docker compose ps -a
docker compose logs --tail=100
```

Para verificar páginas, API, banco, formulário e proteção administrativa, sem criar cadastros:

```sh
docker compose exec -T -e SMOKE_BASE_URL=http://gateway web node /app/scripts/smoke.mjs
```

O resultado esperado contém `"result":"PASS"`.
