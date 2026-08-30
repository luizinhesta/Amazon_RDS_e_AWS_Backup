# 🦖 Dino Game — Amazon RDS, Réplica e Backup - Parte 3 - 3

![Descrição da imagem](<imagens/imagem%20(1).png>)

Jogo web do dinossauro com persistência de dados na AWS, usando **Amazon RDS (PostgreSQL)**, **RDS Proxy**, **Réplica de Leitura** e **backup automático**. Este projeto adiciona a camada de dados durável e escalável sobre uma stack serverless (S3, CloudFront, Cognito, API Gateway, Lambda e ElastiCache).

> Projeto de laboratório focado em praticar a camada de persistência da AWS: banco relacional, separação leitura/escrita, pool de conexões, backup e recuperação de desastres.

<p align="center">
  <img src="imagens/imagem%20(31).png" width="30%" />
  <img src="imagens/imagem%20(32).png" width="30%" />
  <img src="imagens/imagem%20(33).png" width="30%" />
</p>
<p align="center">
  <img src="imagens/imagem%20(34).png" width="30%" />
  <img src="imagens/imagem%20(35).png" width="30%" />
  <img src="imagens/imagem%20(36).png" width="30%" />
</p>
<p align="center">
  <img src="imagens/imagem%20(37).png" width="30%" />
</p>

---

## 📑 Sumário

- [Sobre o Projeto](#-sobre-o-projeto)
- [Principais Recursos](#-principais-recursos)
- [Visão Geral da Arquitetura](#-visão-geral-da-arquitetura)
- [Tecnologias](#-tecnologias)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [Como Rodar / Implantar](#-como-rodar--implantar)
- [Documentação](#-documentação)
- [Custos Estimados](#-custos-estimados)
- [Segurança](#-segurança)
- [Licença](#-licença)

---

## 🎯 Sobre o Projeto

O objetivo é armazenar os dados do jogo (partidas, recordes, perfis e estatísticas) de forma durável e segura, complementando o cache volátil do ElastiCache. A arquitetura separa **escritas** (RDS Principal) de **leituras pesadas** (RDS Réplica), usa **RDS Proxy** para gerenciar conexões e failover, e mantém **backups automáticos** com Point-in-Time Recovery.

O que este projeto demonstra na prática:

- Persistência relacional com **PostgreSQL** no Amazon RDS
- **Separação leitura/escrita** com réplica de leitura
- **Pool de conexões** e failover transparente com RDS Proxy
- **Rotação de credenciais** via AWS Secrets Manager
- **Backup e recuperação** (automático + snapshots manuais)
- Integração com uma stack **serverless** já existente (Cognito, API Gateway, Lambda, ElastiCache)

---

## ✨ Principais Recursos

| Camada | O que faz |
|--------|-----------|
| 🖥️ **Cliente & Frontend** | Navegador acessa via HTTPS → CloudFront (CDN global) → S3 (React estático) |
| ⚙️ **Backend Serverless** | API Gateway (REST) → Lambda (Node.js) com validação de token via Cognito |
| 🗄️ **Camada de Dados** | ElastiCache (Redis) para dados em tempo real, RDS Proxy, RDS Principal (writer) e RDS Réplica (reader) |
| 🔐 **Acesso Administrativo** | AWS Systems Manager (Session Manager) → EC2 Bastion, sem SSH exposto |
| 💾 **Backup & Recuperação** | Backup automático (retenção de 7 dias) + snapshots manuais sob demanda |

Para o detalhamento completo de cada camada, fluxos de dados e princípios de segurança, veja **[ARQUITETURA.md](./ARQUITETURA.md)**.

![Descrição da imagem](<imagens/imagem%20(5).png>)

---

## 🏗️ Visão Geral da Arquitetura

```
Jogador → CloudFront → S3 (Frontend React)
Jogador → Cognito (Autenticação)
Jogador → API Gateway → Lambda (Node.js) → ElastiCache (dados temporários)
                                          → RDS Proxy → RDS Principal (escrita)
                                          → RDS Réplica (leitura)
Admin  → SSM Session Manager → EC2 Bastion → RDS / Proxy / Réplica
```

Fluxo resumido de uma requisição: o usuário acessa a aplicação, os arquivos vêm do S3 via CloudFront, o Cognito valida o token JWT, a Lambda processa a requisição e os dados são salvos no RDS (via Proxy) ou no cache Redis. Todas as conexões sensíveis usam TLS (HTTPS 443, Redis 6379, PostgreSQL 5432) dentro da VPC privada.

📐 **Diagramas Mermaid completos** (arquitetura, fluxo de partida, backup e segurança) estão em **[ARQUITETURA.md](./ARQUITETURA.md)**.

![Descrição da imagem](<imagens/imagem%20(2).png>)

---

## 🛠️ Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + TypeScript (AWS Lambda)
- **Autenticação**: AWS Amplify + Amazon Cognito
- **Cache**: Redis (Amazon ElastiCache)
- **Banco de dados**: PostgreSQL 15 (Amazon RDS)
- **Pool de conexões**: Amazon RDS Proxy
- **Infra AWS**: S3, CloudFront, API Gateway, Secrets Manager, KMS, CloudWatch, VPC, Security Groups, EC2 Bastion, Systems Manager

---

## 📁 Estrutura do Repositório

```
├── src/                # Frontend React (TypeScript + Vite)
├── backend/            # Backend Node.js (AWS Lambda)
├── sql/                # Scripts SQL (banco, tabelas, índices, dados de teste)
├── imagens/            # Screenshots e diagramas
├── ARQUITETURA.md      # Arquitetura do projeto: diagramas, fluxos e segurança
├── IMPLANTACAO.md      # Passo a passo de implantação pelo Console AWS
└── README.md           # Apresentação do projeto (este arquivo)
```

---

## � Como Rodar / Implantar

A implantação é feita **manualmente pelo Console AWS** (sem Terraform/CDK), seguindo um guia detalhado passo a passo.

Resumo das etapas (o passo a passo completo está em **[IMPLANTACAO.md](./IMPLANTACAO.md)**):

1. **Rede e segurança** — criar Security Groups (RDS, Proxy, Bastion), DB Subnet Group e configurar o SSM Session Manager
2. **Credenciais** — criar o segredo no AWS Secrets Manager
3. **Banco de dados** — criar a instância RDS (PostgreSQL) e executar os [scripts SQL](./sql)
4. **Conexões e réplica** — configurar o RDS Proxy e a Réplica de Leitura
5. **Backend** — build e deploy da Lambda + API Gateway
6. **Frontend** — build e deploy no S3 + CloudFront
7. **Backup e monitoramento** — configurar backup automático e dashboards no CloudWatch
8. **Testes e validação** — validar gravação, leitura e ranking
9. **Exclusão** — remover todos os recursos ao final para evitar cobranças

> 📖 Cada etapa tem instruções detalhadas, campos reservados (placeholders) e telas do Console em **[IMPLANTACAO.md](./IMPLANTACAO.md)**.

---

## 📋 Documentação

| Documento | Conteúdo | Quando usar |
|-----------|----------|-------------|
| **[ARQUITETURA.md](./ARQUITETURA.md)** | Arquitetura do projeto: diagramas Mermaid, responsabilidade de cada serviço, fluxos de dados, backup e segurança | Para **entender** como o projeto foi desenhado |
| **[IMPLANTACAO.md](./IMPLANTACAO.md)** | Passo a passo completo de implantação: infraestrutura, banco, build, deploy, backup, testes e exclusão | Para **construir e implantar** o projeto na AWS |

---

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

---

## 🔒 Segurança

- Nenhuma senha, chave ou endpoint real está no código — tudo usa variáveis de ambiente ou campos reservados
- RDS e ElastiCache em **sub-redes privadas**, sem acesso público
- **Criptografia** em trânsito (TLS/SSL) e em repouso (AES-256 via KMS)
- **Rotação de credenciais** automática com Secrets Manager
- Acesso administrativo via **SSM Session Manager** (sem SSH exposto)
- Security Groups encadeados aplicando o **princípio do menor privilégio**

Detalhes e princípios completos em **[ARQUITETURA.md](./ARQUITETURA.md#6-segurança)**.

---

## 📄 Licença

Distribuído sob a licença MIT. Veja [LICENSE](./LICENSE) para mais informações.
