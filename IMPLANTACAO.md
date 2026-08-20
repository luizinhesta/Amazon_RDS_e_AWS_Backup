# 📋 Implantação Completa — Projeto 3: Amazon RDS

Documento único com todo o passo a passo: infraestrutura, banco de dados, build, deploy, backup, testes e exclusão de recursos.

---

## Campos Reservados

> ⚠️ **SEGURANÇA:** Nenhuma credencial real (senhas, tokens, Access Keys) deve ser gravada nestes arquivos. Use os placeholders abaixo e obtenha os valores reais no Console AWS ou Secrets Manager.

Substitua estes placeholders pelos valores reais durante a implantação:

```
<REGIAO_AWS>              = us-east-1
<VPC_ID>                  = (ID da VPC)
<SUBNET_PRIVADA_1>        = (Sub-rede privada AZ-a)
<SUBNET_PRIVADA_2>        = (Sub-rede privada AZ-b)
<SECURITY_GROUP_RDS>      = (SG do RDS - será criado)
<SECURITY_GROUP_PROXY>    = (SG do RDS Proxy - será criado)
<SECURITY_GROUP_BASTION>  = (SG do Bastion - será criado)
<SECURITY_GROUP_LAMBDA>   = (SG da Lambda na VPC)
<RDS_ENDPOINT_PRINCIPAL>  = (Endpoint da instância principal)
<RDS_ENDPOINT_REPLICA>    = (Endpoint da réplica)
<RDS_PROXY_ENDPOINT>      = (Endpoint do RDS Proxy)
<ELASTICACHE_ENDPOINT>    = (Endpoint do ElastiCache)
<API_GATEWAY_URL>         = (URL do API Gateway - stage dev)
<DATABASE_NAME>           = dinogame
<DATABASE_USER>           = dinogame_app
<SECRET_ARN>              = (ARN do segredo no Secrets Manager)
<DB_SUBNET_GROUP>         = dinogame-db-subnet-group
<BUCKET_SITE>             = (Nome do bucket S3 do frontend)
<DISTRIBUTION_ID>         = (ID da distribuição CloudFront)
<INSTANCE_ID_BASTION>     = (ID da instância EC2 bastion)
```

---

## Pré-requisitos

Antes de começar, verifique que existe:
- ✅ VPC com sub-redes públicas e privadas
- ✅ ElastiCache Redis/Valkey funcionando
- ✅ Lambda `dinogame-backend` implantada
- ✅ API Gateway configurado com rotas do Projeto 3
- ✅ EC2 bastion com SSM Agent ativo
- ✅ Cognito User Pool ativo
- ✅ Frontend publicado no S3/CloudFront

---

## Etapa 1 — Criar Security Group para o RDS

### Objetivo
Permitir que apenas o RDS Proxy acesse o banco de dados.

### Acesso pelo Console
Console AWS → VPC → Grupos de segurança → Criar grupo de segurança

### Configuração

| Campo | Valor |
|-------|-------|
| Nome do grupo de segurança | `dinogame-sg-rds` |
| Descrição | Acesso ao RDS apenas pelo Proxy |
| VPC | `<VPC_ID>` |

### Regras de Entrada (Inbound)

| Tipo | Protocolo | Porta | Origem | Descrição |
|------|-----------|-------|--------|-----------|
| PostgreSQL | TCP | 5432 | `<SECURITY_GROUP_PROXY>` | RDS Proxy → RDS Principal |
| PostgreSQL | TCP | 5432 | `<SECURITY_GROUP_LAMBDA>` | Lambda → Réplica (leituras diretas sem Proxy) |
| PostgreSQL | TCP | 5432 | `<SECURITY_GROUP_BASTION>` | Bastion → RDS (testes administrativos, opcional) |

> ℹ️ A Lambda acessa o RDS Principal pelo RDS Proxy, mas acessa a **Réplica diretamente** (sem Proxy) para leituras. Por isso, o SG do RDS precisa aceitar conexões tanto do Proxy quanto da Lambda.

### Regras de Saída (Outbound)
Manter padrão (todo o tráfego permitido).

### Resultado Esperado
Grupo de segurança criado. Anotar o ID: `<SECURITY_GROUP_RDS>`

---

## Etapa 2 — Criar Security Group para o RDS Proxy

### Objetivo
Permitir que a Lambda (backend serverless) e o bastion (testes administrativos) acessem o RDS Proxy.

### Acesso pelo Console
Console AWS → VPC → Grupos de segurança → Criar grupo de segurança

### Configuração

| Campo | Valor |
|-------|-------|
| Nome do grupo de segurança | `dinogame-sg-rds-proxy` |
| Descrição | Acesso ao RDS Proxy pela Lambda e bastion |
| VPC | `<VPC_ID>` |

### Regras de Entrada (Inbound)

| Tipo | Protocolo | Porta | Origem | Descrição |
|------|-----------|-------|--------|-----------|
| PostgreSQL | TCP | 5432 | `<SECURITY_GROUP_LAMBDA>` | Lambda (backend serverless) → Proxy |
| PostgreSQL | TCP | 5432 | `<SECURITY_GROUP_BASTION>` | Bastion (testes administrativos) → Proxy |

### Resultado Esperado
Anotar o ID: `<SECURITY_GROUP_PROXY>`

### Atualizar SG do RDS
Voltar ao `dinogame-sg-rds` e adicionar regra:

| Tipo | Protocolo | Porta | Origem |
|------|-----------|-------|--------|
| PostgreSQL | TCP | 5432 | `<SECURITY_GROUP_PROXY>` |

---

## Etapa 2.1 — Criar Security Group do Bastion

### Objetivo
Criar o Security Group para a EC2 bastion que será usada como ponto de acesso administrativo via Session Manager. O bastion permite conectar ao RDS, Proxy e Réplica via `psql` para executar scripts SQL e realizar manutenção.

### Acesso pelo Console
Console AWS → VPC → Grupos de segurança → Criar grupo de segurança

### Configuração

| Campo | Valor |
|-------|-------|
| Nome do grupo de segurança | `dino-game-bastion-sg` |
| Descrição | SG do bastion administrativo - SSM Session Manager |
| VPC | `<VPC_ID>` |

### Regras de Entrada (Inbound)

Nenhuma regra de entrada obrigatória. O SSM Session Manager não requer portas de entrada abertas — a comunicação é iniciada de dentro da instância para fora (HTTPS/443).

### Regras de Saída (Outbound)

| Tipo | Protocolo | Porta | Destino | Descrição |
|------|-----------|-------|---------|-----------|
| HTTPS | TCP | 443 | 0.0.0.0/0 | SSM Agent → endpoints do Systems Manager |
| PostgreSQL | TCP | 5432 | 0.0.0.0/0 | Bastion → RDS Proxy e RDS direto |

### Resultado Esperado
Grupo de segurança criado. Anotar o ID: `<SECURITY_GROUP_BASTION>`

---

## Etapa 2.2 — Requisitos de Rede para o SSM Session Manager

### Objetivo
Garantir que a EC2 bastion consiga se comunicar com os endpoints do AWS Systems Manager. O SSM Agent na EC2 precisa de **saída HTTPS na porta 443** para funcionar.

### Opções de Conectividade

O SSM Agent precisa alcançar os endpoints do Systems Manager via HTTPS. Existem 3 formas:

| # | Opção | Custo | Complexidade |
|---|-------|-------|--------------|
| 1 | Sub-rede pública + Internet Gateway + IP público | Baixo | Baixa |
| 2 | Sub-rede privada + NAT Gateway | ~$32/mês | Média |
| 3 | VPC Endpoints (PrivateLink) para SSM | ~$7/mês por endpoint (3 necessários) | Média |

### Opção Recomendada para Laboratório: Sub-rede Pública + IGW

Para laboratório/aprendizado, a opção mais simples e econômica é colocar o bastion em uma sub-rede pública:

#### Passo 1 — Criar sub-rede pública para o bastion

Console AWS → VPC → Sub-redes → Criar sub-rede

| Campo | Valor |
|-------|-------|
| VPC | `<VPC_ID>` |
| Nome da sub-rede | `dinogame-subnet-publica-bastion` |
| Zona de disponibilidade | us-east-1a |
| IPv4 CIDR block | (bloco disponível, ex: 10.0.3.0/24) |

#### Passo 2 — Associar ao Internet Gateway

Verificar que a VPC já possui um Internet Gateway (IGW) associado. Se não:
- Console AWS → VPC → Gateways de internet → Criar → Associar à VPC

#### Passo 3 — Configurar tabela de rotas

Console AWS → VPC → Tabelas de rotas → Criar ou editar tabela de rotas da sub-rede pública:

| Destino | Alvo |
|---------|------|
| 10.0.0.0/16 (VPC CIDR) | local |
| 0.0.0.0/0 | igw-xxxxxxxx |

Associar esta tabela de rotas à sub-rede `dinogame-subnet-publica-bastion`.

#### Passo 4 — Habilitar IP público automático

Console AWS → VPC → Sub-redes → `dinogame-subnet-publica-bastion` → Ações → Modificar configurações de atribuição automática de IP → ✅ Habilitar atribuição automática de endereço IPv4 público

#### Passo 5 — Criar instância EC2 bastion

Console AWS → EC2 → Executar instâncias

| Campo | Valor |
|-------|-------|
| Name | `dinogame-bastion` |
| AMI | Amazon Linux 2023 |
| Tipo de instância | t2.micro (Free Tier) |
| Par de chaves | Não é necessário (acesso via SSM) |
| Network | `<VPC_ID>` |
| Subnet | `dinogame-subnet-publica-bastion` |
| Atribuir IP público automaticamente | Habilitar |
| Security group | `dino-game-bastion-sg` |
| Perfil de instância IAM | Perfil com policy `AmazonSSMManagedInstanceCore` |

> ⚠️ O perfil IAM com a policy `AmazonSSMManagedInstanceCore` é **obrigatório** para que o SSM Agent se registre com o Systems Manager.

#### Resultado Esperado
- Instância EC2 criada com status "Running"
- SSM Agent se registra automaticamente (aguardar 2-3 minutos)
- Verificar em: Console AWS → Systems Manager → Gerenciador de frotas → instância aparece como "Online"
- Anotar: `<INSTANCE_ID_BASTION>`

---

## Etapa 3 — Criar DB Subnet Group

### Objetivo
Definir em quais sub-redes privadas o RDS será criado.

### Acesso pelo Console
Console AWS → Amazon RDS → Grupos de sub-redes → Criar grupo de sub-redes de banco de dados

### Configuração

| Campo | Valor |
|-------|-------|
| Name | `dinogame-db-subnet-group` |
| Descrição | Sub-redes privadas para o banco dinogame |
| VPC | `<VPC_ID>` |
| Zonas de disponibilidade | us-east-1a, us-east-1b |
| Sub-redes | `<SUBNET_PRIVADA_1>`, `<SUBNET_PRIVADA_2>` |

### Resultado Esperado
DB Subnet Group criado: `dinogame-db-subnet-group`

---

## Etapa 4 — Criar Segredo no Secrets Manager

### Objetivo
Armazenar a senha do banco de forma segura.

### Acesso pelo Console
Console AWS → AWS Secrets Manager → Armazenar um novo segredo

### Passo 1 — Tipo de segredo

| Campo | Valor |
|-------|-------|
| Tipo de segredo | Credenciais para banco de dados Amazon RDS |
| Username | `dinogame_app` |
| Password | (gerar senha forte de 32+ caracteres) |
| Encryption key | aws/secretsmanager (padrão) |

### Passo 2 — Nome

| Campo | Valor |
|-------|-------|
| Nome do segredo | `dinogame/rds/credentials` |
| Descrição | Credenciais do banco dinogame |

### Passo 3 — Rotação
Não configurar rotação automática (laboratório).

### Resultado Esperado
Segredo criado. Anotar: `<SECRET_ARN>`

---

## Etapa 5 — Criar Instância RDS (PostgreSQL)

### Objetivo
Criar o banco de dados principal.

### Acesso pelo Console
Console AWS → Amazon RDS → Bancos de dados → Criar banco de dados

### Configuração

| Seção | Campo | Valor |
|-------|-------|-------|
| Engine | Engine type | PostgreSQL |
| Engine | Engine version | 15.x (última disponível) |
| Template | Templates | Free tier |
| Settings | DB instance identifier | `dinogame-db` |
| Settings | Master username | `postgres` |
| Settings | Master password | (senha forte, anotar separadamente) |
| Instance | DB instance class | db.t3.micro |
| Storage | Storage type | gp3 |
| Storage | Allocated storage | 20 GiB |
| Storage | Storage autoscaling | ✅ Habilitado (máx 50 GiB) |
| Availability | Multi-AZ | ❌ Não (economia para lab) |
| Connectivity | VPC | `<VPC_ID>` |
| Connectivity | DB subnet group | `dinogame-db-subnet-group` |
| Connectivity | Public access | ❌ Não |
| Connectivity | VPC security group | `dinogame-sg-rds` |
| Authentication | Method | Password authentication |
| Additional | Initial database name | `dinogame` |
| Additional | Backup retention | 7 days |
| Additional | Backup window | 03:00-04:00 UTC |
| Additional | Copy tags to snapshots | ✅ |
| Additional | Encryption | ✅ Habilitar (aws/rds) |
| Additional | Performance Insights | ✅ (7 dias, Free Tier) |
| Additional | Enhanced monitoring | ✅ (60 segundos) |
| Additional | Deletion protection | ✅ Habilitar |

### Resultado Esperado
- Status: "Creating" → aguardar "Available" (5-10 min)
- Anotar endpoint: `<RDS_ENDPOINT_PRINCIPAL>`

---

## Fluxo de Acesso Administrativo

### Visão Geral

O acesso ao banco de dados para tarefas administrativas (executar scripts SQL, verificar dados, sincronizar senhas) segue este fluxo:

```
Computador local (PowerShell/Terminal com AWS CLI)
  → aws ssm start-session --target <INSTANCE_ID_BASTION>
    → EC2 bastion (Amazon Linux 2023)
      → psql "host=<ENDPOINT> dbname=dinogame user=dinogame_app sslmode=require"
        → RDS / RDS Proxy / Réplica
```

### Pré-requisitos no computador local

1. **AWS CLI configurado** (`aws configure` — Access Key, Secret Key, região)
2. **Session Manager Plugin instalado**
   - Windows: baixar e instalar o MSI do [Session Manager Plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)
   - Linux/Mac: seguir documentação AWS

> ℹ️ `aws configure` fornece acesso à API da AWS (Console/CLI), mas **NÃO** cria conectividade de rede entre a EC2 e os serviços na VPC. São conexões independentes: a CLI conecta ao SSM via internet, e a EC2 conecta ao RDS pela rede interna da VPC.

### Comando para iniciar sessão

```bash
aws ssm start-session --target <INSTANCE_ID_BASTION> --region us-east-1
```

Após conectar, você estará no shell da EC2 bastion e pode usar `psql` para acessar o banco.

### Endpoints disponíveis a partir do bastion

| Destino | Endpoint | Quando usar |
|---------|----------|-------------|
| RDS Principal (direto) | `<RDS_ENDPOINT_PRINCIPAL>` | Manutenção como `postgres` |
| RDS Proxy | `<RDS_PROXY_ENDPOINT>` | Testar conexão como a Lambda faz |
| Réplica de Leitura | `<RDS_ENDPOINT_REPLICA>` | Validar replicação |

---

## Etapa 6 — Executar Scripts SQL

### Objetivo
Criar tabelas, índices e dados de teste no banco.

### Passo 1 — Instalar cliente PostgreSQL na EC2

Conectar à EC2 bastion via Session Manager e instalar o cliente:

```bash
sudo dnf install -y postgresql15
```

> ℹ️ É esperado WARNING de versão (psql 15 vs servidor 18). Isso não impede o funcionamento.

### Passo 2 — Clonar o repositório na EC2

```bash
git clone https://github.com/Luizinhesta/Amazon_RDS_e_AWS_Backup.git
cd Amazon_RDS_e_AWS_Backup/sql
```

### Passo 3 — Criar banco e usuário

Conectar como `postgres` no banco padrão:

```bash
psql "host=<RDS_ENDPOINT_PRINCIPAL> port=5432 dbname=postgres user=postgres sslmode=require"
```

Executar o script de criação do banco e usuário:

```sql
\i 01-create-database.sql
```

### Passo 4 — Criar tabelas, índices e dados

Reconectar ao banco `dinogame`:

```sql
\c dinogame
```

Executar na ordem:

```sql
-- 1. Criar tabelas
\i 02-create-tables.sql

-- 2. Criar índices
\i 03-create-indexes.sql

-- 3. (Opcional) Inserir dados de teste
\i 04-insert-test-data.sql
```

### Passo 5 — Definir senha do usuário da aplicação

Usar o comando interativo `\password` (forma segura que não expõe a senha no histórico):

```sql
\password dinogame_app
```

Digitar a **mesma senha** que foi configurada no Secrets Manager (`dinogame/rds/credentials`).

> ⚠️ **Não usar** `ALTER USER ... WITH PASSWORD '...'` — esse comando grava a senha em texto puro no histórico do psql e nos logs do PostgreSQL.

### Validação

```sql
\dt                          -- listar tabelas
\di                          -- listar índices
SELECT COUNT(*) FROM players; -- verificar dados
\du dinogame_app             -- verificar que o usuário existe
```

---

## Sincronização de Senhas (PostgreSQL ↔ Secrets Manager)

### Regra Fundamental

A senha do usuário `dinogame_app` no PostgreSQL e o campo `password` do segredo `dinogame/rds/credentials` no Secrets Manager **devem ser exatamente iguais**. O RDS Proxy não possui senha própria — quando o cliente (Lambda ou bastion) envia a credencial de `dinogame_app`, o Proxy consulta o Secrets Manager para validar.

### Procedimento de Sincronização

1. **Definir a senha no Secrets Manager primeiro:**
   - Console AWS → Secrets Manager → `dinogame/rds/credentials` → Recuperar valor do segredo → Editar
   - Definir o campo `password` com a senha desejada → Salvar

2. **Conectar ao banco como `postgres`:**
   ```bash
   psql "host=<RDS_ENDPOINT_PRINCIPAL> port=5432 dbname=dinogame user=postgres sslmode=require"
   ```

3. **Definir a mesma senha no PostgreSQL:**
   ```sql
   \password dinogame_app
   ```
   Digitar a mesma senha que foi salva no Secrets Manager.

### Diagnóstico de Erro

Se ao conectar via RDS Proxy você receber:

```
FATAL: The password that was provided for the role dinogame_app is wrong
```

Isso significa que a senha no PostgreSQL e no Secrets Manager estão **dessincronizadas**. Execute o procedimento acima para sincronizá-las.

> ℹ️ Após alterar o segredo no Secrets Manager, o RDS Proxy pode levar até 60 segundos para ler a nova credencial.

---

## Etapa 7 — Criar RDS Proxy

### Objetivo
Gerenciar conexões entre backend e RDS usando credenciais do Secrets Manager.

### Acesso pelo Console
Console AWS → Amazon RDS → Proxies → Criar proxy

### Configuração

| Seção | Campo | Valor |
|-------|-------|-------|
| Configuration | Engine family | PostgreSQL |
| Configuration | Proxy identifier | `dinogame-proxy` |
| Configuration | Idle timeout | 1800 seconds |
| Target group | Database | `dinogame-db` |
| Target group | Max connections | 100 |
| Authentication | Secret | `dinogame/rds/credentials` |
| Authentication | IAM role | Create new role |
| Authentication | IAM auth | Not required |
| Connectivity | Require TLS | ✅ |
| Connectivity | Sub-redes | `<SUBNET_PRIVADA_1>`, `<SUBNET_PRIVADA_2>` |
| Connectivity | Security group | `dinogame-sg-rds-proxy` |

### Resultado Esperado
- Status: "Creating" → aguardar "Available" (3-5 min)
- Anotar endpoint: `<RDS_PROXY_ENDPOINT>`

### Validação

```bash
psql "host=<RDS_PROXY_ENDPOINT> port=5432 dbname=dinogame user=dinogame_app sslmode=require"
```

```sql
SELECT 1;
SELECT current_user;  -- deve retornar 'dinogame_app'
```

> ⚠️ Se receber erro `"The password that was provided for the role dinogame_app is wrong"`, isso indica dessincronização entre a senha no PostgreSQL e no Secrets Manager. Consulte a seção **Sincronização de Senhas** acima.

---

## Etapa 8 — Criar Réplica de Leitura

### Objetivo
Escalar leituras (ranking, histórico, estatísticas) sem sobrecarregar a instância principal.

### Acesso pelo Console
Console AWS → Amazon RDS → Bancos de dados → `dinogame-db` → Ações → Criar réplica de leitura

### Configuração

| Campo | Valor |
|-------|-------|
| DB instance identifier | `dinogame-db-replica` |
| DB instance class | db.t3.micro |
| Storage type | gp3 |
| Multi-AZ | ❌ Não |
| Subnet group | `dinogame-db-subnet-group` |
| Public access | ❌ Não |
| Security group | `dinogame-sg-rds` |
| Performance Insights | ✅ |
| Enhanced monitoring | ✅ |
| Deletion protection | ❌ (réplica pode ser recriada) |

### Resultado Esperado
- Status: "Creating" → aguardar "Available"
- Replication state: "Replicating"
- Anotar endpoint: `<RDS_ENDPOINT_REPLICA>`

### Validação

```bash
psql "host=<RDS_ENDPOINT_REPLICA> port=5432 dbname=dinogame user=dinogame_app sslmode=require"
```

```sql
-- Confirmar que está na réplica (deve retornar 't')
SELECT pg_is_in_recovery();

-- Confirmar que é somente leitura (deve retornar 'on')
SHOW transaction_read_only;

-- Verificar que as tabelas estão replicadas
\dt

-- Verificar que os dados da primária aparecem
SELECT COUNT(*) FROM players;
```

> ℹ️ As consultas acima são suficientes para confirmar que a réplica é somente leitura, sem deixar resíduos no banco.

---

## Etapa 8.1 — Configurar Lambda na VPC e API Gateway

### Objetivo
Configurar a Lambda na VPC para acessar o RDS Proxy, definir variáveis de ambiente, e criar as rotas do Projeto 3 no API Gateway.

### Parte A — Configurar Lambda na VPC

Console AWS → Lambda → `dinogame-backend` → Configuração → VPC → Editar

| Campo | Valor |
|-------|-------|
| VPC | `<VPC_ID>` |
| Sub-redes | `<SUBNET_PRIVADA_1>`, `<SUBNET_PRIVADA_2>` (mesmas sub-redes privadas do RDS) |
| Security groups | `<SECURITY_GROUP_LAMBDA>` |

> ⚠️ A Lambda precisa da IAM Policy `AWSLambdaVPCAccessExecutionRole` na execution role para criar ENIs nas sub-redes da VPC. Se a role da Lambda não tiver essa policy, adicione em: Console AWS → IAM → Funções → role da Lambda → Anexar política.

### Parte B — Configurar variáveis de ambiente da Lambda

Console AWS → Lambda → `dinogame-backend` → Configuração → Variáveis de ambiente → Editar

| Chave | Valor |
|-------|-------|
| `RDS_PROXY_ENDPOINT` | `<RDS_PROXY_ENDPOINT>` |
| `RDS_REPLICA_ENDPOINT` | `<RDS_ENDPOINT_REPLICA>` |
| `RDS_PORT` | `5432` |
| `RDS_DATABASE` | `dinogame` |
| `RDS_USER` | `dinogame_app` |
| `RDS_PASSWORD` | (obter do Secrets Manager — mesma senha do banco) |
| `CACHE_ENDPOINT` | `<ELASTICACHE_ENDPOINT>` |
| `CACHE_PORT` | `6379` |
| `CACHE_TLS` | `true` |
| `GAME_SESSION_TTL` | `1800` |
| `ALLOWED_ORIGINS` | `https://<DOMINIO_APLICACAO>` |

Clicar "Salvar".

### Parte C — Criar rotas do Projeto 3 no API Gateway

Console AWS → API Gateway → selecionar a API `dinogame-api` → Recursos

Para cada nova rota do Projeto 3, criar recurso e métodos:

| Recurso | Método | Integração |
|---------|--------|-----------|
| `/player` | — | (recurso pai) |
| `/player/history` | GET + OPTIONS | Lambda Proxy → `dinogame-backend` |
| `/player/stats` | GET + OPTIONS | Lambda Proxy → `dinogame-backend` |
| `/ranking` | — | (recurso pai, se não existe) |
| `/ranking/persistent` | GET + OPTIONS | Lambda Proxy → `dinogame-backend` |
| `/match` | — | (recurso pai) |
| `/match/record` | POST + OPTIONS | Lambda Proxy → `dinogame-backend` |
| `/db` | — | (recurso pai) |
| `/db/health` | GET + OPTIONS | Lambda Proxy → `dinogame-backend` |

Para cada método:
1. Criar recurso → Nome do recurso → Criar
2. Criar método → tipo GET ou POST → Tipo de integração: Função do Lambda → ✅ Usar integração de proxy do Lambda → Region: us-east-1 → Function: `dinogame-backend` → Salvar
3. Criar método → OPTIONS → Tipo de integração: Mock → Salvar (para CORS preflight)

> ℹ️ O método OPTIONS é necessário para que o navegador envie o preflight CORS corretamente.

### Parte D — Deploy do API Gateway

Ações de API → Implantar API → Estágio: `dev` → Deploy

Anotar a URL: `<API_GATEWAY_URL>` (formato: `https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev`)

### Parte E — Validação

```bash
curl https://<API_GATEWAY_URL>/db/health
```

Resposta esperada:
```json
{"services":{"rds_primary":"connected","rds_replica":"connected","elasticache":"connected"},"overall":"healthy"}
```

### Parte F — Troubleshooting do erro 503

Se as rotas do Projeto 3 retornarem 503:

1. Verificar que a Lambda está configurada na VPC (Configuração → VPC deve mostrar sub-redes)
2. Verificar que o Security Group da Lambda permite saída na porta 5432
3. Verificar que as variáveis de ambiente `RDS_PROXY_ENDPOINT` e `RDS_PASSWORD` estão definidas
4. Verificar que a senha no PostgreSQL e no Secrets Manager estão sincronizadas
5. Verificar que o destino do RDS Proxy está AVAILABLE:
   ```bash
   aws rds describe-db-proxy-targets --db-proxy-name dinogame-proxy
   ```

---

## Etapa 9 — Build e Deploy do Backend

### Objetivo
Compilar o backend com as novas rotas RDS e fazer deploy na Lambda.

> ℹ️ O backend roda na AWS Lambda, não na EC2. A EC2 é apenas bastion administrativo para acesso ao banco via SSM.

### Passo 1 — Instalar dependências

```bash
cd backend
npm install
```

### Passo 2 — Compilar

```bash
npm run build
```

Resultado: pasta `dist/` criada sem erros.

### Passo 3 — Gerar pacote (Lambda)

```powershell
# Windows PowerShell
Compress-Archive -Path .\dist, .\node_modules -DestinationPath .\lambda-function.zip -Force
```

```bash
# Linux/Mac
zip -r lambda-function.zip dist/ node_modules/
```

> ℹ️ **Estrutura do ZIP:** O arquivo deve preservar os diretórios `dist/` e `node_modules/` na raiz (não o conteúdo solto). Ao abrir o ZIP, deve-se ver `dist/` e `node_modules/` como pastas de primeiro nível.

### Passo 4 — Deploy na Lambda

Console AWS → Lambda → `dinogame-backend` → Código → Carregar a partir de → Arquivo .zip → Selecionar `lambda-function.zip` → Salvar

### Passo 5 — Variáveis de ambiente

As variáveis de ambiente da Lambda já foram configuradas na **Etapa 8.1 — Parte B**. Se necessário ajustar algum valor:

Console AWS → Lambda → `dinogame-backend` → Configuração → Variáveis de ambiente → Editar

### Validação

```bash
curl https://<API_GATEWAY_URL>/db/health
```

Resposta esperada:
```json
{
  "services": {
    "rds_primary": "connected",
    "rds_replica": "connected",
    "elasticache": "connected"
  },
  "overall": "healthy"
}
```

---

## Etapa 10 — Build e Deploy do Frontend

### Objetivo
Compilar o frontend com as novas páginas e publicar no S3.

### Passo 1 — Instalar dependências

```bash
cd "c:\github\Amazon backup"
npm install
```

### Passo 2 — Configurar variável de ambiente

Criar arquivo `.env` na raiz:

```env
VITE_API_URL=https://<API_GATEWAY_URL>
```

> ⚠️ **SEGURANÇA:** Variáveis `VITE_` são incorporadas ao bundle JavaScript durante o build e ficam visíveis no navegador. Nunca inclua senhas, endpoints privados do RDS, ou chaves AWS neste arquivo.

### Passo 3 — Compilar

```bash
npm run build
```

Resultado: pasta `dist/` criada.

### Passo 4 — Upload para S3

```bash
aws s3 sync dist/ s3://<BUCKET_SITE>/ --delete --region us-east-1
```

### Passo 5 — Invalidar cache do CloudFront

```bash
aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

### Passo 6 — Configurar SPA Routing no CloudFront (se necessário)

Se acessar `/history`, `/stats` ou `/ranking` diretamente dá erro 404:

Console AWS → CloudFront → `<DISTRIBUTION_ID>` → Páginas de erro → Criar resposta de erro personalizada:

| Campo | Valor |
|-------|-------|
| HTTP error code | 404 |
| Personalizar resposta de erro | Sim |
| Caminho da página de resposta | `/index.html` |
| HTTP response code | 200 |

Repetir para erro 403.

### Validação no Navegador

1. Acessar `https://<DOMINIO_APLICACAO>`
2. Fazer login
3. Dashboard mostra botões: Meu perfil, Jogar, Ranking, Histórico, Estatísticas, Sair
4. GamePage tem botão "← Voltar"
5. `/ranking` mostra abas Cache vs Banco
6. `/history` mostra tabela de partidas
7. `/stats` mostra cards + status dos serviços

---

## Etapa 11 — Configurar Backup

### Verificar Backup Automático

Console AWS → Amazon RDS → Bancos de dados → `dinogame-db` → Manutenção e backups

| Item | Valor esperado |
|------|---------------|
| Backup retention period | 7 days |
| Backup window | 03:00-04:00 UTC |
| Latest restore time | < 5 minutos atrás |

### Criar Snapshot Manual

Console AWS → Amazon RDS → Bancos de dados → `dinogame-db` → Ações → Obter snapshot

| Campo | Valor |
|-------|-------|
| Nome do snapshot | `dinogame-snapshot-YYYYMMDD` |

Aguardar status "Available" em RDS → Snapshots → Manual.

### Teste de Restauração

1. Inserir dado de teste:
```sql
INSERT INTO players (player_id, username, email) VALUES ('backup-test', 'BackupTest', 'b@t.com');
```

2. Criar snapshot: `dinogame-teste-restauracao`

3. Inserir outro dado (NÃO deve existir após restaurar):
```sql
INSERT INTO players (player_id, username, email) VALUES ('nao-existe', 'NaoExiste', 'n@t.com');
```

4. Restaurar o snapshot:
   - RDS → Snapshots → `dinogame-teste-restauracao` → Ações → Restaurar snapshot
   - Identifier: `dinogame-db-restored`
   - Classe: db.t3.micro, mesma VPC/SG

5. Validar na instância restaurada:
```sql
SELECT * FROM players WHERE player_id = 'backup-test';      -- DEVE existir
SELECT * FROM players WHERE player_id = 'nao-existe';       -- NÃO deve existir
```

6. Limpar:
   - Excluir instância `dinogame-db-restored`
   - Excluir snapshot `dinogame-teste-restauracao`
   - Remover dados de teste: `DELETE FROM players WHERE player_id IN ('backup-test', 'nao-existe');`

---

## Etapa 12 — Monitoramento

### Criar Dashboard no CloudWatch

Console AWS → CloudWatch → Painéis → Criar painel → `dinogame-rds`

Widgets sugeridos:
1. CPU Utilization (RDS principal + réplica)
2. Database Connections (RDS + Proxy)
3. Read/Write IOPS
4. Replication Lag (réplica)
5. Free Storage Space
6. Cache Hit Rate (ElastiCache)

### Alarmes Recomendados

| Alarme | Métrica | Threshold |
|--------|---------|-----------|
| CPU alta | CPUUtilization | > 80% por 5 min |
| Armazenamento baixo | FreeStorageSpace | < 2 GB |
| Conexões altas | DatabaseConnections | > 80 |
| Lag de replicação | ReplicaLag | > 30 seg |

---

## Etapa 13 — Testes

### Teste 1 — Gravação no banco

1. Jogar uma partida até Game Over
2. Verificar no banco:
```sql
SELECT * FROM matches ORDER BY finished_at DESC LIMIT 1;
```
✅ Registro existe com pontuação e duração corretos.

### Teste 2 — Leitura pela réplica

1. Acessar `/stats` ou `/history` no navegador
2. Verificar que dados carregam
3. Indicador "Fonte: Réplica de leitura RDS" visível

✅ Dados aparecem corretamente.

### Teste 3 — Replicação

1. Inserir na principal:
```sql
INSERT INTO players (player_id, username, email, best_score) VALUES ('teste-rep', 'Rep', 'r@t.com', 100);
```
2. Consultar na réplica (aguardar 1-2 seg):
```sql
SELECT * FROM players WHERE player_id = 'teste-rep';
```
✅ Dado aparece na réplica.

3. Limpar: `DELETE FROM players WHERE player_id = 'teste-rep';`

### Teste 4 — RDS Proxy

1. Console → RDS → Proxies → `dinogame-proxy` → Monitoramento
2. Verificar `ClientConnections` e `DatabaseConnections`
3. Fazer várias requisições rápidas

✅ Sem erro "too many connections".

### Teste 5 — Ranking comparativo

1. Acessar `/ranking`
2. Alternar entre "Tempo Real (Cache)" e "Consolidado (RDS)"
3. Jogar uma partida

✅ Cache atualiza instantaneamente, banco com 1-2 seg de defasagem.

### Teste 6 — Indisponibilidade do banco

1. Remover regra de entrada do SG-RDS (porta 5432)
2. Acessar `/stats` → deve mostrar "Serviço indisponível"
3. Iniciar jogo → deve funcionar (usa apenas cache)
4. Restaurar regra do SG

✅ Jogo funciona sem banco. Estatísticas falham graciosamente.

### Teste 7 — Endpoint de saúde

```bash
curl https://<API_GATEWAY_URL>/db/health
```
✅ Resposta mostra status de cada serviço.

---

## Checklist de Validação Final

Antes de considerar a implantação concluída, verificar todos os itens:

### Infraestrutura e Acesso
- [ ] EC2 bastion aparece Online no Systems Manager
- [ ] Acesso à EC2 funciona sem liberar SSH/22

### Banco de Dados
- [ ] Scripts SQL executados sem erros
- [ ] Tabelas `players`, `matches` e `ranking_history` existem no banco
- [ ] Usuário `dinogame_app` existe com permissões corretas (`\du dinogame_app`)
- [ ] Senha do banco e Secrets Manager estão sincronizadas

### RDS Proxy
- [ ] Destino do RDS Proxy está AVAILABLE
- [ ] `SELECT 1` e consultas às tabelas funcionam pelo Proxy

### Réplica de Leitura
- [ ] Réplica está disponível
- [ ] `pg_is_in_recovery()` retorna `t` na réplica
- [ ] `transaction_read_only` retorna `on` na réplica

### Backend (Lambda)
- [ ] ZIP da Lambda contém `dist/` e `node_modules/` na raiz
- [ ] Lambda está configurada na VPC com sub-redes e SG corretos
- [ ] Variáveis de ambiente da Lambda estão definidas
- [ ] Rotas do Projeto 3 criadas no API Gateway e deployed
- [ ] Lambda utiliza RDS Proxy, não conexão direta com o RDS

### Frontend
- [ ] Frontend utiliza a URL do API Gateway em `VITE_API_URL`
- [ ] Frontend atualizado foi publicado no S3 e invalidado no CloudFront

---

## Etapa 14 — Exclusão de Recursos

⚠️ Seguir ESTA ORDEM para evitar erros de dependência.

### 1. Excluir Réplica de Leitura
Console → RDS → `dinogame-db-replica` → Ações → Excluir
- Snapshot final: ❌ Não
- Digite "delete me"

### 2. Excluir RDS Proxy
Console → RDS → Proxies → `dinogame-proxy` → Ações → Excluir

### 3. Desabilitar Proteção do RDS
Console → RDS → `dinogame-db` → Modificar → Deletion protection: ❌ → Aplicar imediatamente

### 4. Excluir RDS Principal
Console → RDS → `dinogame-db` → Ações → Excluir
- Snapshot final: ❌ (ou ✅ se quiser manter)
- Reter backups automáticos: ❌
- Digite "delete me"

### 5. Excluir Snapshots Manuais
Console → RDS → Snapshots → Manual → Selecionar cada um → Ações → Excluir

### 6. Excluir Segredo
Console → Secrets Manager → `dinogame/rds/credentials` → Ações → Excluir segredo

### 7. Excluir DB Subnet Group
Console → RDS → Grupos de sub-redes → `dinogame-db-subnet-group` → Excluir

### 8. Excluir Security Groups
Console → VPC → Grupos de segurança:
1. Excluir `dinogame-sg-rds-proxy`
2. Excluir `dinogame-sg-rds`

### 9. Excluir Dashboard e Alarmes
Console → CloudWatch → Painéis → `dinogame-rds` → Excluir
Console → CloudWatch → Alarmes → Selecionar → Excluir

### Verificação Final
Console → Billing → Bills → Verificar que não há cobranças de:
- Amazon RDS
- Secrets Manager
- CloudWatch (logs retidos cobram armazenamento)

---

## Políticas IAM Necessárias

### RDS Proxy → Secrets Manager

O RDS Proxy precisa ler as credenciais do banco. Essa role é criada automaticamente ao selecionar "Create new role" na Etapa 7.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": "<SECRET_ARN>"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "*",
      "Condition": {
        "StringEquals": { "kms:ViaService": "secretsmanager.us-east-1.amazonaws.com" }
      }
    }
  ]
}
```

### Backend → Secrets Manager (se buscar senha em runtime)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "<SECRET_ARN>"
    }
  ]
}
```

### Backend → CloudWatch Logs

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:us-east-1:*:log-group:/aws/lambda/dinogame-*"
    }
  ]
}
```

---

## Scripts SQL Disponíveis

| Arquivo | O que faz |
|---------|-----------|
| `sql/01-create-database.sql` | Cria banco e usuário |
| `sql/02-create-tables.sql` | Cria tabelas (players, matches, ranking_history) |
| `sql/03-create-indexes.sql` | Cria índices para performance |
| `sql/04-insert-test-data.sql` | Insere 10 jogadores + partidas para teste |
| `sql/05-queries-ranking.sql` | Consultas de ranking (referência) |
| `sql/06-queries-history.sql` | Consultas de histórico (referência) |
| `sql/07-validate-replica.sql` | Valida que a réplica está funcionando |

---

## Novas Rotas da API (Projeto 3)

| Rota | Método | Descrição | Escrita/Leitura |
|------|--------|-----------|----------------|
| `/player/history` | GET | Histórico de partidas | Réplica (leitura) |
| `/player/stats` | GET | Estatísticas do jogador | Réplica (leitura) |
| `/ranking/persistent` | GET | Ranking consolidado do banco | Réplica (leitura) |
| `/match/record` | POST | Registra partida no banco | Principal (escrita via Proxy) |
| `/db/health` | GET | Status de todos os serviços | Ambos (ping) |

---

## Possíveis Erros e Soluções

| Erro | Causa | Solução |
|------|-------|---------|
| "Connection refused" ao RDS | SG não permite porta 5432 | Verificar regras de entrada do SG-RDS |
| "Password authentication failed" | Senha incorreta | Verificar Secrets Manager |
| "password is wrong" via Proxy | Senha dessincronizada | Sincronizar senha PostgreSQL com Secrets Manager (ver seção Sincronização) |
| "timeout expired" | Backend não alcança RDS | Verificar subnets e rotas |
| "cannot execute in read-only transaction" | Escrevendo na réplica | Usar endpoint do Proxy para escrita |
| "too many connections" | Limite excedido | Usar RDS Proxy para pool |
| "Cannot find module 'pg'" | node_modules não incluído no zip | Refazer zip com node_modules |
| 503 nas rotas do Projeto 3 | Lambda não conecta ao banco | Verificar: Lambda na VPC, SG com saída 5432, variáveis de ambiente, senhas sincronizadas |
| 404 ao acessar /history direto | SPA routing não configurado | Configurar CloudFront error page (Etapa 10) |
| CORS error no navegador | Origin não permitido | Verificar ALLOWED_ORIGINS no backend |
| WARNING psql version mismatch | Cliente psql 15, servidor 18 | Normal — não impede funcionamento. Instalar cliente 18 quando disponível |
