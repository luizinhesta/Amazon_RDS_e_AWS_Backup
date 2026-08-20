# 🏗️ Arquitetura do Projeto 3 — Amazon RDS, RDS Proxy, Réplica e Backup

## 1. Visão Geral

O **Projeto 3** adiciona a camada de **persistência de dados** ao jogo web de dinossauros na AWS. Enquanto os projetos anteriores tratavam do frontend estático (S3 + CloudFront), autenticação (Cognito) e cache em tempo real (ElastiCache), este projeto introduz:

- **Amazon RDS (PostgreSQL)** como banco de dados relacional principal
- **RDS Read Replica** para distribuir leituras pesadas (ranking, histórico, estatísticas)
- **RDS Proxy** para gerenciamento eficiente de conexões e failover transparente
- **Backups automatizados e snapshots manuais** para recuperação de desastres
- **AWS Secrets Manager** para rotação segura de credenciais

A arquitetura garante que os dados do jogo (partidas, recordes, perfis) sejam armazenados de forma durável, segura e escalável, complementando o cache volátil do ElastiCache.

---

## 2. Diagrama Completo

```mermaid
graph TB
    %% Cliente
    Cliente[🦕 Jogador - Browser]

    %% Frontend
    subgraph Frontend["Frontend (Estático)"]
        CloudFront[CloudFront CDN]
        S3[S3 Bucket]
    end

    %% Autenticação
    subgraph Auth["Autenticação"]
        Cognito[Amazon Cognito]
    end

    %% Backend Serverless
    subgraph BackendServerless["Backend Serverless"]
        APIGateway[API Gateway]
        Lambda[AWS Lambda - Node.js]
    end

    %% Cache
    subgraph Cache["Cache em Memória"]
        ElastiCache[Amazon ElastiCache - Redis]
    end

    %% Banco de Dados
    subgraph Database["Banco de Dados"]
        RDSProxy[RDS Proxy]
        RDSPrincipal[RDS Principal - Writer]
        RDSReplica[RDS Réplica - Reader]
    end

    %% Acesso Administrativo
    subgraph Admin["Acesso Administrativo"]
        SSM[Systems Manager]
        Bastion[EC2 Bastion]
    end

    %% Segurança e Monitoramento
    subgraph Seguranca["Segurança"]
        SecretsManager[Secrets Manager]
        SGGroups[Security Groups]
    end

    subgraph Monitoramento["Monitoramento"]
        CloudWatch[Amazon CloudWatch]
    end

    subgraph BackupLayer["Backup"]
        BackupAuto[Backup Automático - 7 dias]
        Snapshot[Snapshot Manual]
    end

    %% Conexões do Cliente
    Cliente -->|HTTPS| CloudFront
    CloudFront --> S3
    Cliente -->|Auth| Cognito
    Cliente -->|API REST| APIGateway

    %% Backend Serverless
    APIGateway --> Lambda
    Lambda --> ElastiCache
    Lambda --> RDSProxy
    Lambda -->|Leituras pesadas| RDSReplica

    %% Banco de Dados
    RDSProxy --> RDSPrincipal
    RDSPrincipal -->|Replicação Assíncrona| RDSReplica

    %% Acesso Administrativo
    SSM --> Bastion
    Bastion -->|psql via Proxy| RDSProxy
    Bastion -->|psql direto| RDSReplica

    %% Segurança
    SecretsManager -.->|Credenciais| RDSProxy
    SGGroups -.->|Regras| Lambda
    SGGroups -.->|Regras| Bastion
    SGGroups -.->|Regras| ElastiCache
    SGGroups -.->|Regras| RDSProxy
    SGGroups -.->|Regras| RDSPrincipal

    %% Backup
    RDSPrincipal --> BackupAuto
    RDSPrincipal --> Snapshot

    %% Monitoramento
    Lambda -.->|Métricas/Logs| CloudWatch
    RDSPrincipal -.->|Métricas| CloudWatch
    ElastiCache -.->|Métricas| CloudWatch
```

---

## 3. Responsabilidade de Cada Serviço

### 🟢 ElastiCache (Redis) — Dados Temporários

| Dado | Tipo | TTL | Motivo |
|------|------|-----|--------|
| Sessões de jogo ativas | Hash | 30 min | Estado volátil da partida em andamento |
| Jogadores online | Set | 5 min | Lista em tempo real, muda constantemente |
| Ranking em tempo real | Sorted Set | 60 seg | Atualização frequente durante partidas |
| Salas abertas | Hash | 15 min | Temporário até a partida iniciar |
| Cache de consultas | String | 30 seg | Evitar queries repetidas ao banco |

### 🔵 RDS Principal (Writer) — Escritas Persistentes

| Operação | Tipo SQL | Exemplo |
|----------|----------|---------|
| Registrar partida | INSERT | `INSERT INTO matches (player_id, score, duration, dino_type)` |
| Atualizar recorde | UPDATE | `UPDATE player_stats SET best_score = $1 WHERE player_id = $2` |
| Salvar perfil | INSERT/UPDATE | `INSERT INTO players (cognito_id, nickname) ON CONFLICT UPDATE` |
| Registrar conquista | INSERT | `INSERT INTO achievements (player_id, achievement_type)` |

### 🟣 RDS Réplica (Reader) — Leituras Pesadas

| Consulta | Tipo | Frequência |
|----------|------|------------|
| Ranking global (top 100) | SELECT + ORDER BY | Alta — página de ranking |
| Histórico de partidas | SELECT + JOIN | Média — perfil do jogador |
| Estatísticas do jogador | SELECT + Agregações | Média — dashboard pessoal |
| Relatórios gerais | SELECT + GROUP BY | Baixa — painéis administrativos |

### 🟠 RDS Proxy — Gerenciamento de Conexões

| Função | Descrição |
|--------|-----------|
| Connection Pooling | Mantém pool de conexões reutilizáveis com o banco |
| Reutilização de conexões | Multiplica conexões entre múltiplas instâncias do backend |
| Failover transparente | Redireciona automaticamente para nova instância em caso de falha |
| Integração com Secrets Manager | Obtém e rotaciona credenciais sem alterar código da aplicação |
| Redução de overhead | Evita custo de abrir/fechar conexões TCP+SSL a cada request |

---

## 4. Fluxo de uma Partida

```mermaid
sequenceDiagram
    participant J as 🦕 Jogador
    participant F as Frontend (React)
    participant B as Lambda (Node.js)
    participant C as ElastiCache (Redis)
    participant P as RDS Proxy
    participant DB as RDS Principal
    participant R as RDS Réplica

    Note over J,R: 📍 FASE 1 — Iniciar Partida

    J->>F: Clica "Iniciar Jogo"
    F->>B: POST /api/game/start (token JWT)
    B->>B: Valida token Cognito
    B->>C: SET game:{id} {estado inicial}
    C-->>B: OK
    B-->>F: 200 {gameId, config}
    F-->>J: Tela do jogo carregada

    Note over J,R: 📍 FASE 2 — Fim da Partida (Salvar Pontuação)

    J->>F: Dinossauro morre (fim de jogo)
    F->>B: POST /api/game/score {gameId, score, duration}
    B->>C: GET game:{id} (valida sessão)
    C-->>B: {estado da partida}
    B->>C: ZADD ranking:global score playerId
    B->>P: INSERT INTO matches (player_id, score, duration, dino_type)
    P->>DB: Executa INSERT
    DB-->>P: OK (match_id retornado)
    P-->>B: Confirmação
    B->>P: UPDATE player_stats SET matches_played = matches_played + 1
    P->>DB: Executa UPDATE
    DB-->>P: OK
    P-->>B: Confirmação
    B->>C: DEL game:{id}
    B-->>F: 200 {matchId, newRecord: true/false}
    F-->>J: Tela de resultado

    Note over J,R: 📍 FASE 3 — Consultar Estatísticas

    J->>F: Acessa "Meu Perfil"
    F->>B: GET /api/player/stats (token JWT)
    B->>R: SELECT * FROM player_stats WHERE player_id = $1
    R-->>B: {stats do jogador}
    B->>R: SELECT * FROM matches WHERE player_id = $1 ORDER BY created_at DESC LIMIT 10
    R-->>B: {últimas 10 partidas}
    B-->>F: 200 {stats, recentMatches}
    F-->>J: Dashboard com estatísticas
```

---

## 5. Fluxo de Backup e Restauração

```mermaid
graph LR
    subgraph RDS["RDS Principal"]
        DB[(PostgreSQL)]
    end

    subgraph Automatico["Backup Automático"]
        BA[Backup Diário]
        Retencao[Retenção: 7 dias]
        PITR[Point-in-Time Recovery]
    end

    subgraph Manual["Snapshot Manual"]
        SM[Snapshot sob demanda]
        Permanente[Retenção: Permanente]
    end

    subgraph Restauracao["Restauração"]
        NovaInstancia[Nova Instância RDS]
    end

    DB -->|Diariamente às 03:00 UTC| BA
    BA --> Retencao
    BA --> PITR
    DB -->|Antes de deploy/migração| SM
    SM --> Permanente

    Retencao -->|Restaurar para qualquer ponto| NovaInstancia
    PITR -->|Restaurar até 5 min atrás| NovaInstancia
    Permanente -->|Restaurar snapshot completo| NovaInstancia

    style BA fill:#4CAF50,color:#fff
    style SM fill:#2196F3,color:#fff
    style NovaInstancia fill:#FF9800,color:#fff
```

### Configuração de Backup

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| Backup automático | Habilitado | Ativado por padrão |
| Janela de backup | 03:00–04:00 UTC | Horário de menor tráfego |
| Retenção automática | 7 dias | Últimos 7 backups disponíveis |
| Point-in-Time Recovery | Habilitado | Restaurar para qualquer segundo nos últimos 7 dias |
| Snapshots manuais | Antes de deploys | Retenção permanente até exclusão manual |
| Criptografia | AES-256 (KMS) | Backups criptografados em repouso |

---

## 6. Segurança

```mermaid
graph LR
    subgraph Internet
        User[🌐 Usuário]
    end

    APIGW[API Gateway<br/>Serviço gerenciado - sem SG]

    subgraph SG_Lambda["SG-Lambda"]
        Lambda[Lambda<br/>← API Gateway]
    end

    subgraph SG_Bastion["SG-Bastion"]
        Bastion[EC2 Bastion<br/>← SSM Session Manager]
    end

    subgraph SG_Cache["SG-Cache"]
        Redis[ElastiCache<br/>Porta 6379 ← SG-Lambda]
    end

    subgraph SG_Proxy["SG-Proxy"]
        Proxy[RDS Proxy<br/>Porta 5432 ← SG-Lambda, SG-Bastion]
    end

    subgraph SG_RDS["SG-RDS"]
        RDS[RDS Principal + Réplica<br/>Porta 5432 ← SG-Proxy]
    end

    User -->|HTTPS 443| APIGW
    APIGW --> Lambda
    Lambda -->|6379| Redis
    Lambda -->|5432| Proxy
    Bastion -->|5432| Proxy
    Proxy -->|5432| RDS
```

### Princípios de Segurança Aplicados

1. **Princípio do menor privilégio** — Cada Security Group permite apenas o tráfego estritamente necessário
2. **Defesa em profundidade** — Múltiplas camadas de segurança (SG → Subnets privadas → Criptografia)
3. **Sem acesso público ao banco** — RDS e ElastiCache em subnets privadas, sem IP público
4. **Criptografia em trânsito** — TLS/SSL em todas as conexões (API Gateway→Lambda, Lambda→Cache, Proxy→RDS)
5. **Criptografia em repouso** — AES-256 via AWS KMS para dados no RDS e backups
6. **Rotação de credenciais** — Secrets Manager rotaciona senhas do banco automaticamente
7. **Autenticação IAM** — RDS Proxy usa IAM Authentication, eliminando senhas hardcoded
8. **Isolamento de rede** — VPC com subnets privadas (Lambda, Cache, DB) e acesso administrativo via SSM
9. **Logs de auditoria** — CloudTrail registra todas as chamadas de API aos recursos

---

## 7. Recursos AWS Utilizados

| Serviço AWS | Função no Projeto |
|-------------|-------------------|
| Amazon S3 | Hospedagem dos arquivos estáticos do frontend (HTML, CSS, JS, assets) |
| Amazon CloudFront | CDN para distribuição global com baixa latência e cache de borda |
| Amazon Cognito | Autenticação e gerenciamento de usuários (sign-up, login, JWT) |
| Amazon API Gateway | Expõe a API REST para o frontend |
| AWS Lambda | Executa o backend Node.js (serverless) |
| Amazon EC2 (Bastion) | Acesso administrativo ao RDS via Systems Manager Session Manager |
| Amazon ElastiCache (Redis) | Cache em memória para dados temporários e real-time |
| Amazon RDS (PostgreSQL) | Banco de dados relacional principal para persistência |
| RDS Read Replica | Réplica de leitura para consultas pesadas (ranking, histórico) |
| Amazon RDS Proxy | Pool de conexões, failover transparente e integração com Secrets Manager |
| AWS Secrets Manager | Armazenamento e rotação automática de credenciais do banco |
| AWS KMS | Gerenciamento de chaves para criptografia de dados em repouso |
| Amazon CloudWatch | Monitoramento de métricas, logs e alarmes de todos os serviços |
| AWS CloudTrail | Auditoria de chamadas de API e ações em recursos AWS |
| Amazon VPC | Isolamento de rede com subnets públicas e privadas |
| Security Groups | Firewall virtual com regras de entrada/saída por serviço |

---

## 8. Benefícios da Arquitetura

1. **Alta disponibilidade** — RDS Multi-AZ com failover automático via RDS Proxy garante continuidade mesmo com falha de uma zona de disponibilidade

2. **Performance otimizada** — Separação de leituras (Réplica) e escritas (Principal) evita contenção e melhora tempo de resposta

3. **Escalabilidade horizontal** — Possibilidade de adicionar mais réplicas de leitura conforme o número de jogadores cresce

4. **Eficiência de conexões** — RDS Proxy reutiliza conexões, suportando milhares de requisições simultâneas sem esgotar o limite do banco

5. **Recuperação de desastres** — Backups automáticos diários + Point-in-Time Recovery permitem restaurar dados de qualquer momento nos últimos 7 dias

6. **Segurança em camadas** — Security Groups encadeados + subnets privadas + criptografia + rotação de credenciais formam defesa em profundidade

7. **Custo otimizado** — ElastiCache absorve consultas frequentes, reduzindo carga (e custo) no RDS; réplica de leitura é mais barata que escalar o principal

8. **Operação simplificada** — Secrets Manager rotaciona credenciais automaticamente, backups são automáticos, e CloudWatch alerta sobre anomalias antes que se tornem incidentes
