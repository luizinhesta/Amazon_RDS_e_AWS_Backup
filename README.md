# 🦖 AWS Dino Game — Projeto 3: Amazon RDS, Réplica e Backup

Jogo web do dinossauro com persistência de dados usando Amazon RDS (PostgreSQL), RDS Proxy, Réplica de Leitura e Backup automático.

## 🎯 Objetivo

Praticar a camada de persistência da AWS com banco de dados relacional, separação de leitura/escrita, backup e recuperação.

## 🏗️ Arquitetura Completa

```
Jogador → CloudFront → S3 (Frontend React)
Jogador → Cognito (Autenticação)
Jogador → API Gateway → Lambda (Node.js) → ElastiCache (dados temporários)
                                          → RDS Proxy → RDS Principal (escrita)
                                          → RDS Réplica (leitura)
Admin → SSM Session Manager → EC2 Bastion → RDS / Proxy / Réplica
```

## 📦 O Que Cada Serviço Faz

| Serviço | Responsabilidade |
|---------|-----------------|
| **Cognito** | Login, cadastro, recuperação de senha |
| **S3 + CloudFront** | Hospeda o frontend (HTML/CSS/JS) |
| **API Gateway** | Expõe a API REST para o frontend (HTTPS) |
| **Lambda** | Lógica de negócio, API REST (serverless) |
| **ElastiCache (Redis)** | Sessões de jogo, ranking tempo real, jogadores online |
| **RDS Principal** | Armazena permanentemente: partidas, recordes, perfis |
| **RDS Réplica** | Leitura escalável: ranking consolidado, histórico, estatísticas |
| **RDS Proxy** | Pool de conexões, failover, integração Secrets Manager |
| **Secrets Manager** | Guarda senha do banco com segurança |
| **CloudWatch** | Monitoramento e alertas |
| **EC2 Bastion (SSM)** | Acesso administrativo ao RDS via Session Manager |

## 🛠️ Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + TypeScript (AWS Lambda)
- **Autenticação**: AWS Amplify + Amazon Cognito
- **Cache**: Redis (Amazon ElastiCache)
- **Banco de dados**: PostgreSQL 15 (Amazon RDS)
- **Pool de conexões**: Amazon RDS Proxy

## 📁 Estrutura do Projeto

```
├── src/                # Frontend React
├── backend/            # Backend Node.js (Lambda)
├── sql/                # Scripts SQL (banco, tabelas, índices, dados de teste)
├── imagens/            # Screenshots e diagramas
├── ARQUITETURA.md      # Diagramas e explicações técnicas
├── IMPLANTACAO.md      # Passo a passo completo pelo Console AWS
└── README.md           # Este arquivo
```

## 📋 Documentação

| Arquivo | Conteúdo |
|---------|----------|
| [IMPLANTACAO.md](./IMPLANTACAO.md) | Passo a passo completo: infraestrutura, banco, build, deploy, backup, testes e exclusão |
| [ARQUITETURA.md](./ARQUITETURA.md) | Diagramas Mermaid, fluxos, segurança e responsabilidades de cada serviço |

## 🚀 Início Rápido

1. Leia o `IMPLANTACAO.md` e siga as etapas na ordem
2. Configure a infraestrutura na AWS (VPC, Security Groups, RDS, Proxy, Réplica)
3. Execute os scripts SQL para criar o banco
4. Faça build e deploy do backend e frontend
5. Teste as funcionalidades
6. Ao terminar, exclua todos os recursos para evitar cobranças

## 💰 Custos Estimados (se NÃO excluir)

| Recurso | Custo/mês aproximado |
|---------|---------------------|
| RDS db.t3.micro | ~$12 |
| RDS Réplica db.t3.micro | ~$12 |
| RDS Proxy | ~$10 |
| ElastiCache cache.t3.micro | ~$12 |
| API Gateway | ~$1 (pay-per-request, mínimo em lab) |
| NAT Gateway | ~$32 |
| Secrets Manager | ~$0.40 |
| **Total estimado** | **~$80/mês** |

⚠️ Valores aproximados para us-east-1. Consulte a [Calculadora AWS](https://calculator.aws/) para valores atualizados.

## ⚠️ Importante

- Nenhuma senha, chave ou endpoint real está no código
- Todos os valores sensíveis usam variáveis de ambiente ou campos reservados
- A implantação é feita **manualmente pelo Console AWS** (sem Terraform/CDK)
- Exclua TODOS os recursos ao terminar para não ter cobrança
