# 📋 Implantação Completa — Projeto 3: Amazon RDS

Documento único com todo o passo a passo: infraestrutura, banco de dados, build, deploy, backup, testes e exclusão de recursos.

---

## Campos Reservados

Substitua estes placeholders pelos valores reais durante a implantação:

```
<REGIAO_AWS>              = us-east-1
<VPC_ID>                  = (ID da VPC)
<SUBNET_PRIVADA_1>        = (Sub-rede privada AZ-a)
<SUBNET_PRIVADA_2>        = (Sub-rede privada AZ-b)
<SECURITY_GROUP_BACKEND>  = (SG do backend)
<SECURITY_GROUP_RDS>      = (SG do RDS - será criado)
<SECURITY_GROUP_PROXY>    = (SG do RDS Proxy - será criado)
<RDS_ENDPOINT_PRINCIPAL>  = (Endpoint da instância principal)
<RDS_ENDPOINT_REPLICA>    = (Endpoint da réplica)
<RDS_PROXY_ENDPOINT>      = (Endpoint do RDS Proxy)
<ELASTICACHE_ENDPOINT>    = (Endpoint do ElastiCache)
<DATABASE_NAME>           = dinogame
<DATABASE_USER>           = dinogame_app
<SECRET_ARN>              = (ARN do segredo no Secrets Manager)
<DB_SUBNET_GROUP>         = dinogame-db-subnet-group
<BUCKET_SITE>             = (Nome do bucket S3 do frontend)
<DISTRIBUTION_ID>         = (ID da distribuição CloudFront)
<ALB_DNS>                 = (DNS do Application Load Balancer)
```

---

## Pré-requisitos

Antes de começar, verifique que existe:
- ✅ VPC com sub-redes públicas e privadas
- ✅ Security Group do backend
- ✅ ElastiCache Redis/Valkey funcionando
- ✅ Backend rodando (EC2/Lambda/ECS)
- ✅ ALB configurado
- ✅ Cognito User Pool ativo
- ✅ Frontend publicado no S3/CloudFront

---

## Etapa 1 — Criar Security Group para o RDS

### Objetivo
Permitir que apenas o backend e o proxy acessem o banco de dados.

### Acesso pelo Console
Console AWS → VPC → Security Groups → Create security group

### Configuração

| Campo | Valor |
|-------|-------|
| Security group name | `dinogame-sg-rds` |
| Description | Acesso ao RDS apenas pelo backend e proxy |
| VPC | `<VPC_ID>` |

### Regras de Entrada (Inbound)

| Tipo | Protocolo | Porta | Origem | Descrição |
|------|-----------|-------|--------|-----------|
| PostgreSQL | TCP | 5432 | `<SECURITY_GROUP_BACKEND>` | Backend → RDS |

### Regras de Saída (Outbound)
Manter padrão (todo o tráfego permitido).

### Resultado Esperado
Security Group criado. Anotar o ID: `<SECURITY_GROUP_RDS>`

---

## Etapa 2 — Criar Security Group para o RDS Proxy

### Objetivo
Permitir que apenas o backend acesse o RDS Proxy.

### Acesso pelo Console
Console AWS → VPC → Security Groups → Create security group

### Configuração

| Campo | Valor |
|-------|-------|
| Security group name | `dinogame-sg-rds-proxy` |
| Description | Acesso ao RDS Proxy apenas pelo backend |
| VPC | `<VPC_ID>` |

### Regras de Entrada (Inbound)

| Tipo | Protocolo | Porta | Origem |
|------|-----------|-------|--------|
| PostgreSQL | TCP | 5432 | `<SECURITY_GROUP_BACKEND>` |

### Resultado Esperado
Anotar o ID: `<SECURITY_GROUP_PROXY>`

### Atualizar SG do RDS
Voltar ao `dinogame-sg-rds` e adicionar regra:

| Tipo | Protocolo | Porta | Origem |
|------|-----------|-------|--------|
| PostgreSQL | TCP | 5432 | `<SECURITY_GROUP_PROXY>` |

---

## Etapa 3 — Criar DB Subnet Group

### Objetivo
Definir em quais sub-redes privadas o RDS será criado.

### Acesso pelo Console
Console AWS → Amazon RDS → Subnet groups → Create DB subnet group

### Configuração

| Campo | Valor |
|-------|-------|
| Name | `dinogame-db-subnet-group` |
| Description | Sub-redes privadas para o banco dinogame |
| VPC | `<VPC_ID>` |
| Availability Zones | us-east-1a, us-east-1b |
| Subnets | `<SUBNET_PRIVADA_1>`, `<SUBNET_PRIVADA_2>` |

### Resultado Esperado
DB Subnet Group criado: `dinogame-db-subnet-group`

---

## Etapa 4 — Criar Segredo no Secrets Manager

### Objetivo
Armazenar a senha do banco de forma segura.

### Acesso pelo Console
Console AWS → AWS Secrets Manager → Store a new secret

### Passo 1 — Tipo de segredo

| Campo | Valor |
|-------|-------|
| Secret type | Credentials for Amazon RDS database |
| Username | `dinogame_app` |
| Password | (gerar senha forte de 32+ caracteres) |
| Encryption key | aws/secretsmanager (padrão) |

### Passo 2 — Nome

| Campo | Valor |
|-------|-------|
| Secret name | `dinogame/rds/credentials` |
| Description | Credenciais do banco dinogame |

### Passo 3 — Rotação
Não configurar rotação automática (laboratório).

### Resultado Esperado
Segredo criado. Anotar: `<SECRET_ARN>`

---

## Etapa 5 — Criar Instância RDS (PostgreSQL)

### Objetivo
Criar o banco de dados principal.

### Acesso pelo Console
Console AWS → Amazon RDS → Databases → Create database

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
| Connectivity | Public access | ❌ No |
| Connectivity | VPC security group | `dinogame-sg-rds` |
| Authentication | Method | Password authentication |
| Additional | Initial database name | `dinogame` |
| Additional | Backup retention | 7 days |
| Additional | Backup window | 03:00-04:00 UTC |
| Additional | Copy tags to snapshots | ✅ |
| Additional | Encryption | ✅ Enable (aws/rds) |
| Additional | Performance Insights | ✅ (7 dias, Free Tier) |
| Additional | Enhanced monitoring | ✅ (60 segundos) |
| Additional | Deletion protection | ✅ Enable |

### Resultado Esperado
- Status: "Creating" → aguardar "Available" (5-10 min)
- Anotar endpoint: `<RDS_ENDPOINT_PRINCIPAL>`

---

## Etapa 6 — Executar Scripts SQL

### Objetivo
Criar tabelas, índices e dados de teste no banco.

### Acesso
Conectar ao banco via EC2 na mesma VPC (Session Manager):

```bash
sudo yum install -y postgresql15
psql -h <RDS_ENDPOINT_PRINCIPAL> -U postgres -d dinogame
```

### Procedimento

Executar na ordem:

```bash
# 1. Criar tabelas
\i sql/02-create-tables.sql

# 2. Criar índices
\i sql/03-create-indexes.sql

# 3. (Opcional) Inserir dados de teste
\i sql/04-insert-test-data.sql
```

### Configurar usuário da aplicação

```sql
-- Definir senha para o usuário da aplicação (mesma senha do Secrets Manager)
ALTER USER dinogame_app WITH PASSWORD '<MESMA_SENHA_DO_SECRETS_MANAGER>';
```

### Validação

```sql
\dt                          -- listar tabelas
\di                          -- listar índices
SELECT COUNT(*) FROM players; -- verificar dados
```

---

## Etapa 7 — Criar RDS Proxy

### Objetivo
Gerenciar conexões entre backend e RDS usando credenciais do Secrets Manager.

### Acesso pelo Console
Console AWS → Amazon RDS → Proxies → Create proxy

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
| Connectivity | Subnets | `<SUBNET_PRIVADA_1>`, `<SUBNET_PRIVADA_2>` |
| Connectivity | Security group | `dinogame-sg-rds-proxy` |

### Resultado Esperado
- Status: "Creating" → aguardar "Available" (3-5 min)
- Anotar endpoint: `<RDS_PROXY_ENDPOINT>`

### Validação

```bash
psql -h <RDS_PROXY_ENDPOINT> -U dinogame_app -d dinogame
SELECT 1;
```

---

## Etapa 8 — Criar Réplica de Leitura

### Objetivo
Escalar leituras (ranking, histórico, estatísticas) sem sobrecarregar a instância principal.

### Acesso pelo Console
Console AWS → Amazon RDS → Databases → `dinogame-db` → Actions → Create read replica

### Configuração

| Campo | Valor |
|-------|-------|
| DB instance identifier | `dinogame-db-replica` |
| DB instance class | db.t3.micro |
| Storage type | gp3 |
| Multi-AZ | ❌ Não |
| Subnet group | `dinogame-db-subnet-group` |
| Public access | ❌ No |
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
psql -h <RDS_ENDPOINT_REPLICA> -U dinogame_app -d dinogame

-- Deve retornar 't' (é réplica)
SELECT pg_is_in_recovery();

-- Tentar escrita (DEVE falhar)
INSERT INTO players (player_id, username, email) VALUES ('test', 'test', 'test@t.com');
-- Erro esperado: cannot execute INSERT in a read-only transaction
```

---

## Etapa 9 — Build e Deploy do Backend

### Objetivo
Compilar o backend com as novas rotas RDS e fazer deploy.

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

```bash
# Windows PowerShell
Compress-Archive -Path dist\*, node_modules\* -DestinationPath lambda-function.zip -Force

# Linux/Mac
zip -r lambda-function.zip dist/ node_modules/
```

### Passo 4 — Deploy

**Lambda:**
Console AWS → Lambda → `dinogame-backend` → Code → Upload from → .zip file → Selecionar `lambda-function.zip` → Save

**EC2:**
```bash
# No servidor
cd /home/ec2-user/app
npm install --production
npm run build
pm2 restart all
```

### Passo 5 — Configurar variáveis de ambiente

**Lambda:** Console AWS → Lambda → `dinogame-backend` → Configuration → Environment variables → Edit

| Chave | Valor |
|-------|-------|
| `RDS_PROXY_ENDPOINT` | `<RDS_PROXY_ENDPOINT>` |
| `RDS_PORT` | `5432` |
| `RDS_DATABASE` | `dinogame` |
| `RDS_USER` | `dinogame_app` |
| `RDS_PASSWORD` | `<senha_do_secrets_manager>` |
| `RDS_REPLICA_ENDPOINT` | `<RDS_ENDPOINT_REPLICA>` |
| `CACHE_ENDPOINT` | `<ELASTICACHE_ENDPOINT>` |
| `CACHE_PORT` | `6379` |
| `CACHE_TLS` | `true` |
| `GAME_SESSION_TTL` | `1800` |
| `ALLOWED_ORIGINS` | `https://<DOMINIO_APLICACAO>` |

Clicar "Save".

### Validação

```bash
curl https://<ALB_DNS>/db/health
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
VITE_API_URL=https://<ALB_DNS>
```

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

Console AWS → CloudFront → `<DISTRIBUTION_ID>` → Error pages → Create custom error response:

| Campo | Valor |
|-------|-------|
| HTTP error code | 404 |
| Customize error response | Yes |
| Response page path | `/index.html` |
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

Console AWS → Amazon RDS → Databases → `dinogame-db` → Maintenance & backups

| Item | Valor esperado |
|------|---------------|
| Backup retention period | 7 days |
| Backup window | 03:00-04:00 UTC |
| Latest restore time | < 5 minutos atrás |

### Criar Snapshot Manual

Console AWS → Amazon RDS → Databases → `dinogame-db` → Actions → Take snapshot

| Campo | Valor |
|-------|-------|
| Snapshot name | `dinogame-snapshot-YYYYMMDD` |

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
   - RDS → Snapshots → `dinogame-teste-restauracao` → Actions → Restore snapshot
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

Console AWS → CloudWatch → Dashboards → Create dashboard → `dinogame-rds`

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

1. Console → RDS → Proxies → `dinogame-proxy` → Monitoring
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
curl https://<ALB_DNS>/db/health
```
✅ Resposta mostra status de cada serviço.

---

## Etapa 14 — Exclusão de Recursos

⚠️ Seguir ESTA ORDEM para evitar erros de dependência.

### 1. Excluir Réplica de Leitura
Console → RDS → `dinogame-db-replica` → Actions → Delete
- Final snapshot: ❌ Não
- Type "delete me"

### 2. Excluir RDS Proxy
Console → RDS → Proxies → `dinogame-proxy` → Actions → Delete

### 3. Desabilitar Proteção do RDS
Console → RDS → `dinogame-db` → Modify → Deletion protection: ❌ → Apply immediately

### 4. Excluir RDS Principal
Console → RDS → `dinogame-db` → Actions → Delete
- Final snapshot: ❌ (ou ✅ se quiser manter)
- Retain automated backups: ❌
- Type "delete me"

### 5. Excluir Snapshots Manuais
Console → RDS → Snapshots → Manual → Selecionar cada um → Actions → Delete

### 6. Excluir Segredo
Console → Secrets Manager → `dinogame/rds/credentials` → Actions → Delete secret

### 7. Excluir DB Subnet Group
Console → RDS → Subnet groups → `dinogame-db-subnet-group` → Delete

### 8. Excluir Security Groups
Console → VPC → Security Groups:
1. Excluir `dinogame-sg-rds-proxy`
2. Excluir `dinogame-sg-rds`

### 9. Excluir Dashboard e Alarmes
Console → CloudWatch → Dashboards → `dinogame-rds` → Delete
Console → CloudWatch → Alarms → Selecionar → Delete

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
| "Connection refused" ao RDS | SG não permite porta 5432 | Verificar inbound rules do SG-RDS |
| "Password authentication failed" | Senha incorreta | Verificar Secrets Manager |
| "timeout expired" | Backend não alcança RDS | Verificar subnets e rotas |
| "cannot execute in read-only transaction" | Escrevendo na réplica | Usar endpoint do Proxy para escrita |
| "too many connections" | Limite excedido | Usar RDS Proxy para pool |
| "Cannot find module 'pg'" | node_modules não incluído no zip | Refazer zip com node_modules |
| 404 ao acessar /history direto | SPA routing não configurado | Configurar CloudFront error page (Etapa 10) |
| CORS error no navegador | Origin não permitido | Verificar ALLOWED_ORIGINS no backend |
