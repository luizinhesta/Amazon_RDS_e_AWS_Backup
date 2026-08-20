# Documento de Requisitos

## Introdução

Este documento especifica as correções necessárias na documentação de implantação e nos arquivos do Projeto 3 (Amazon RDS, RDS Proxy, Réplica e AWS Backup). As correções foram identificadas durante a implantação real em laboratório e visam eliminar instruções incorretas, ambíguas ou inseguras. O Projeto 3 é uma continuação dos Projetos 1 e 2, portanto deve preservar os recursos existentes (Cognito, S3 frontend, CloudFront, Route 53, API Gateway).

## Glossário

- **Bastion**: Instância EC2 utilizada exclusivamente como ponto de acesso administrativo ao ambiente privado da VPC, acessada via AWS Systems Manager Session Manager.
- **SSM**: AWS Systems Manager — serviço que permite acesso remoto à EC2 sem necessidade de SSH ou chaves privadas.
- **RDS_Proxy**: Amazon RDS Proxy — serviço gerenciado que fornece pool de conexões entre a aplicação e o banco de dados RDS.
- **Réplica**: RDS Read Replica — instância de leitura assíncrona do banco de dados principal.
- **Secrets_Manager**: AWS Secrets Manager — serviço para armazenamento e rotação de credenciais.
- **Security_Group**: Grupo de segurança da VPC — firewall virtual que controla tráfego de entrada e saída de recursos AWS.
- **Lambda**: AWS Lambda — serviço serverless que executa o backend da aplicação.
- **API_Gateway**: Amazon API Gateway — serviço que expõe a API REST para o frontend.
- **IMPLANTACAO_MD**: Arquivo `IMPLANTACAO.md` — documento principal de passo a passo de implantação.
- **ARQUITETURA_MD**: Arquivo `ARQUITETURA.md` — documento de arquitetura com diagramas Mermaid.
- **Script_SQL**: Arquivo SQL no diretório `sql/` do projeto.
- **ZIP_Lambda**: Pacote `.zip` contendo o código compilado e dependências para deploy na Lambda.
- **VITE_API_URL**: Variável de ambiente do Vite que define a URL base da API consumida pelo frontend.

## Requisitos

### Requisito 1: EC2 como bastion administrativo via SSM

**User Story:** Como administrador do laboratório, eu quero que a documentação defina a EC2 exclusivamente como bastion administrativo via SSM, para que não haja confusão sobre o papel da EC2 (que não executa o backend).

#### Critérios de Aceitação

1. WHEN a documentação IMPLANTACAO_MD descreve o papel da EC2, THE IMPLANTACAO_MD SHALL defini-la exclusivamente como bastion administrativo para acesso ao RDS, Proxy e Réplica via Session Manager.
2. THE IMPLANTACAO_MD SHALL remover todos os comandos de implantação de backend na EC2, incluindo `cd /home/ec2-user/app`, `npm install --production`, `npm run build` e `pm2 restart all`.
3. THE IMPLANTACAO_MD SHALL remover qualquer referência ao PM2 como gerenciador de processos.
4. THE IMPLANTACAO_MD SHALL indicar explicitamente que o backend roda na AWS Lambda, não na EC2.

---

### Requisito 2: Rede correta para SSM

**User Story:** Como administrador, eu quero que a documentação explique corretamente os requisitos de rede para o Session Manager funcionar, para que eu consiga conectar ao bastion sem falhas.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL documentar que o SSM Agent na EC2 precisa de saída HTTPS na porta 443 para os endpoints do Systems Manager.
2. THE IMPLANTACAO_MD SHALL listar as três opções de conectividade para o SSM: sub-rede pública com Internet Gateway e IP público, sub-rede privada com NAT Gateway, ou VPC Endpoints do SSM.
3. WHEN a opção de sub-rede pública for utilizada, THE IMPLANTACAO_MD SHALL documentar a criação da sub-rede pública, associação ao Internet Gateway, configuração da tabela de rotas com rota `0.0.0.0/0 → igw`, e habilitação de IP público automático na instância.
4. THE IMPLANTACAO_MD SHALL documentar a criação do Security Group do bastion (`dino-game-bastion-sg`) com regra de saída HTTPS/443 para `0.0.0.0/0` e nenhuma regra de entrada obrigatória.

---

### Requisito 3: Security Groups separados por camada

**User Story:** Como administrador, eu quero que os Security Groups estejam corretamente separados por camada de serviço, para que o princípio de menor privilégio seja respeitado.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL documentar quatro Security Groups distintos: bastion (`dino-game-bastion-sg`), Lambda (SG da Lambda na VPC), RDS Proxy (`dinogame-sg-rds-proxy`), e RDS (`dinogame-sg-rds`).
2. THE IMPLANTACAO_MD SHALL especificar que o Security Group do RDS Proxy aceita conexões na porta 5432 vindas da Lambda E do bastion (para testes administrativos).
3. THE IMPLANTACAO_MD SHALL especificar que o Security Group do RDS aceita conexões na porta 5432 vindas do RDS Proxy somente.
4. THE IMPLANTACAO_MD SHALL manter a configuração de "Publicamente acessível: Não" para o RDS principal e a réplica.
5. THE IMPLANTACAO_MD SHALL remover referências ao `<SECURITY_GROUP_BACKEND>` genérico e substituir pelos nomes específicos de cada Security Group.

---

### Requisito 4: Script SQL idempotente para criação do usuário

**User Story:** Como administrador do banco de dados, eu quero um script idempotente para criação do usuário `dinogame_app`, para que eu possa executá-lo múltiplas vezes sem erros.

#### Critérios de Aceitação

1. THE Script_SQL SHALL criar o usuário `dinogame_app` de forma idempotente, utilizando padrão `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object ... END $$` ou equivalente.
2. THE Script_SQL SHALL conceder permissões mínimas ao usuário: CONNECT no database, USAGE ON SCHEMA public, SELECT/INSERT/UPDATE/DELETE em todas as tabelas do schema, USAGE e SELECT em todas as sequences, e ALTER DEFAULT PRIVILEGES para tabelas e sequences futuras.
3. THE IMPLANTACAO_MD SHALL documentar que o comando `\password dinogame_app` no psql é a forma segura de definir a senha (não exibe a senha no histórico de comandos).
4. THE IMPLANTACAO_MD SHALL documentar a ordem correta de execução: primeiro criar o banco e o usuário, depois conectar ao banco `dinogame` com `\c dinogame`, e então executar os scripts de tabelas e permissões.

---

### Requisito 5: Sincronização de senha PostgreSQL e Secrets Manager

**User Story:** Como administrador, eu quero documentação clara sobre a sincronização de senhas entre PostgreSQL e Secrets Manager, para que o RDS Proxy funcione corretamente.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL explicar que a senha definida para o usuário `dinogame_app` no PostgreSQL e o campo `password` do segredo `dinogame/rds/credentials` no Secrets Manager DEVEM ser exatamente iguais.
2. THE IMPLANTACAO_MD SHALL documentar o procedimento de sincronização: primeiro definir a senha no Secrets Manager, depois usar `\password dinogame_app` no psql para definir a mesma senha no PostgreSQL.
3. THE IMPLANTACAO_MD SHALL documentar que o erro "IAM authentication failed" ou "password is wrong" ao conectar via RDS Proxy indica dessincronização entre a senha no PostgreSQL e no Secrets Manager.

---

### Requisito 6: Correção dos testes de RDS Proxy e réplica

**User Story:** Como administrador, eu quero comandos de validação corretos e não destrutivos, para que eu possa testar o Proxy e a réplica sem riscos.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL documentar o uso de `sslmode=require` na string de conexão com o RDS Proxy (exemplo: `psql "host=<RDS_PROXY_ENDPOINT> dbname=dinogame user=dinogame_app sslmode=require"`).
2. THE IMPLANTACAO_MD SHALL usar `SELECT pg_is_in_recovery()` (retorno esperado: `t`) e `SHOW transaction_read_only` (retorno esperado: `on`) para validar que a réplica é somente leitura.
3. THE IMPLANTACAO_MD SHALL remover o teste de INSERT destrutivo na réplica como método de validação de read-only.
4. THE IMPLANTACAO_MD SHALL documentar que o erro "password is wrong" ao conectar via Proxy indica dessincronização de senha entre Secrets Manager e PostgreSQL.

---

### Requisito 7: Comando PowerShell correto para ZIP da Lambda

**User Story:** Como desenvolvedor, eu quero o comando correto de criação do ZIP da Lambda, para que a estrutura de diretórios esteja correta no pacote.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL substituir o comando `Compress-Archive -Path dist\*, node_modules\*` pelo comando correto: `Compress-Archive -Path .\dist, .\node_modules -DestinationPath .\lambda-function.zip -Force`.
2. THE IMPLANTACAO_MD SHALL explicar que a estrutura do ZIP deve preservar os diretórios `dist/` e `node_modules/` na raiz do arquivo (não o conteúdo solto dos diretórios).
3. THE IMPLANTACAO_MD SHALL manter o comando alternativo para Linux/Mac: `zip -r lambda-function.zip dist/ node_modules/`.

---

### Requisito 8: VITE_API_URL correto

**User Story:** Como desenvolvedor frontend, eu quero que a documentação indique a URL correta para a variável VITE_API_URL, para que o frontend conecte à API corretamente.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL substituir `VITE_API_URL=https://<ALB_DNS>` por `VITE_API_URL=https://<URL_DA_API_GATEWAY>`.
2. THE IMPLANTACAO_MD SHALL remover todas as referências a ALB (Application Load Balancer) como ponto de entrada da API.
3. THE IMPLANTACAO_MD SHALL incluir aviso de segurança explicando que variáveis `VITE_` são incorporadas ao bundle JavaScript durante o build e ficam visíveis no navegador — portanto, nunca devem conter senhas, endpoints privados ou chaves AWS.

---

### Requisito 9: Transferência de scripts SQL para EC2

**User Story:** Como administrador, eu quero documentação sobre como ter acesso aos scripts SQL dentro da EC2 bastion, para que eu possa executá-los contra o banco de dados.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL documentar o uso de `git clone` do repositório público na EC2 via Session Manager para obter os scripts SQL.
2. WHEN o repositório for privado, THE IMPLANTACAO_MD SHALL mencionar a opção de usar Personal Access Token com `git clone https://<TOKEN>@github.com/...` sem registrar o token real na documentação.
3. THE IMPLANTACAO_MD SHALL indicar o diretório esperado dos scripts após o clone (exemplo: `~/Amazon_RDS_e_AWS_Backup/sql/`).

---

### Requisito 10: Instalação do cliente PostgreSQL

**User Story:** Como administrador, eu quero saber o comando correto para instalar o cliente PostgreSQL na EC2, para que eu possa conectar ao RDS.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL documentar o comando `sudo dnf install -y postgresql15` para Amazon Linux 2023.
2. THE IMPLANTACAO_MD SHALL substituir o comando antigo `sudo yum install -y postgresql15` pelo comando correto com `dnf`.
3. THE IMPLANTACAO_MD SHALL mencionar que é esperado um aviso de versão ("WARNING: psql major version 15, server major version 18") quando o cliente 15 conecta em servidor PostgreSQL 18, e que o aviso não impede o funcionamento.

---

### Requisito 11: Correção do diagrama de arquitetura

**User Story:** Como leitor da documentação, eu quero diagramas de arquitetura corretos, para que o fluxo real do sistema esteja representado sem ambiguidades.

#### Critérios de Aceitação

1. THE ARQUITETURA_MD SHALL atualizar o diagrama para refletir o fluxo: Frontend (CloudFront/S3) → API Gateway → Lambda → RDS Proxy → RDS Principal.
2. THE ARQUITETURA_MD SHALL remover ALB, EC2 e ECS do diagrama como componentes de backend.
3. THE ARQUITETURA_MD SHALL adicionar o bastion (EC2 via SSM) como caminho de acesso administrativo ao RDS, Proxy e Réplica.
4. THE README_MD SHALL atualizar a seção de arquitetura para refletir o mesmo fluxo correto, removendo referências a ALB e EC2/ECS como backend.
5. THE ARQUITETURA_MD SHALL manter os serviços preservados dos projetos anteriores: Cognito, S3, CloudFront, Route 53.

---

### Requisito 12: Fluxo administrativo documentado

**User Story:** Como administrador, eu quero o fluxo administrativo completo documentado, para que eu entenda como acessar os recursos de banco de dados.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL documentar o fluxo completo de acesso administrativo: computador local (PowerShell/Terminal com AWS CLI) → Systems Manager Session Manager → EC2 bastion → RDS/Proxy/Réplica.
2. THE IMPLANTACAO_MD SHALL explicar que o login da AWS CLI no computador local (`aws configure`) fornece acesso à API da AWS (Console/CLI), mas NÃO cria conectividade de rede entre a EC2 e os serviços internos da VPC.
3. THE IMPLANTACAO_MD SHALL documentar o comando para iniciar sessão via SSM: `aws ssm start-session --target <INSTANCE_ID>`.

---

### Requisito 13: Validação final completa

**User Story:** Como administrador, eu quero um checklist de validação final, para confirmar que todos os componentes estão funcionando após a implantação.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL incluir um checklist de validação final com os seguintes itens verificáveis: EC2 online e acessível via Session Manager, scripts SQL executados com sucesso, tabelas existem no banco `dinogame`, usuário `dinogame_app` criado com permissões corretas, senhas sincronizadas entre PostgreSQL e Secrets Manager.
2. THE IMPLANTACAO_MD SHALL incluir no checklist os itens de infraestrutura de dados: RDS Proxy com status AVAILABLE, SELECT funcional conectando pelo Proxy, réplica retornando `pg_is_in_recovery() = t`.
3. THE IMPLANTACAO_MD SHALL incluir no checklist os itens de aplicação: ZIP da Lambda com estrutura correta (`dist/` e `node_modules/` na raiz), Lambda configurada para usar endpoint do RDS Proxy, frontend compilado com `VITE_API_URL` apontando para API Gateway.

---

### Requisito 14: Configuração do API Gateway e Lambda na VPC

**User Story:** Como desenvolvedor, eu quero que a documentação inclua a etapa de configuração do API Gateway com as novas rotas do Projeto 3 e a configuração da Lambda na VPC, para que o backend consiga acessar o RDS Proxy e a Réplica.

#### Critérios de Aceitação

1. THE IMPLANTACAO_MD SHALL incluir uma nova etapa (entre a criação do RDS Proxy/Réplica e o Build/Deploy) documentando a criação das rotas do Projeto 3 no API Gateway: `/player/history` (GET), `/player/stats` (GET), `/ranking/persistent` (GET), `/match/record` (POST), `/db/health` (GET).
2. THE IMPLANTACAO_MD SHALL documentar que cada recurso no API Gateway deve ter: o método HTTP correspondente com integração Lambda Proxy, e o método OPTIONS para CORS (preflight).
3. THE IMPLANTACAO_MD SHALL documentar a configuração da Lambda na VPC: selecionar as sub-redes privadas do RDS e o Security Group da Lambda (`<SECURITY_GROUP_LAMBDA>`) para que a Lambda tenha conectividade de rede com o RDS Proxy e a Réplica.
4. THE IMPLANTACAO_MD SHALL documentar que a Lambda precisa da IAM Policy `AWSLambdaVPCAccessExecutionRole` para criar ENIs nas sub-redes da VPC.
5. THE IMPLANTACAO_MD SHALL documentar as variáveis de ambiente da Lambda necessárias para o Projeto 3: `RDS_PROXY_ENDPOINT`, `RDS_REPLICA_ENDPOINT`, `RDS_PORT`, `RDS_DATABASE`, `RDS_USER`, `RDS_PASSWORD`.
6. THE IMPLANTACAO_MD SHALL documentar a necessidade de fazer deploy do API Gateway após criar as novas rotas (Actions → Deploy API → stage: dev).
7. THE IMPLANTACAO_MD SHALL indicar que o erro 503 na rota `/ranking/persistent` (ou outras rotas do Projeto 3) geralmente indica que a Lambda não consegue conectar ao banco — verificar: Lambda na VPC, Security Groups, variáveis de ambiente e sincronização de senhas.

---

### Requisito 15: Segurança de credenciais nos arquivos versionados

**User Story:** Como desenvolvedor, eu quero garantir que nenhuma credencial real seja versionada no repositório, para evitar exposição de dados sensíveis.

#### Critérios de Aceitação

1. THE Repositório SHALL manter o arquivo `.env` listado no `.gitignore`.
2. THE IMPLANTACAO_MD SHALL não conter senhas reais, tokens, Access Keys ou endpoints privados sensíveis — somente placeholders delimitados por `<` e `>`.
3. THE IMPLANTACAO_MD SHALL incluir aviso explícito na seção de pré-requisitos ou campos reservados alertando que nenhuma credencial real deve ser gravada nos arquivos versionados.
4. IF um placeholder de credencial é utilizado na documentação, THEN THE IMPLANTACAO_MD SHALL indicar onde o valor real deve ser obtido (Console AWS, Secrets Manager, etc.).
