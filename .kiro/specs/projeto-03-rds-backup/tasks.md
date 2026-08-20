# Implementation Plan: Correções de Documentação Projeto 03

## Overview

Correções em arquivos de documentação Markdown, script SQL e verificação de segurança. Todas as tarefas envolvem edição de arquivos existentes — preservar conteúdo correto e corrigir apenas as seções com erros.

## Tasks

- [ ] 1. Corrigir script SQL de criação do banco
  - [ ] 1.1 Tornar criação do usuário `dinogame_app` idempotente em `sql/01-create-database.sql`
    - Substituir `CREATE USER dinogame_app WITH PASSWORD '<SENHA_SEGURA>'` pelo padrão `DO $$ BEGIN IF NOT EXISTS ... END $$`
    - Adicionar permissões granulares: USAGE ON SCHEMA, SELECT/INSERT/UPDATE/DELETE em tabelas, USAGE/SELECT em sequences, ALTER DEFAULT PRIVILEGES
    - Adicionar comentário explicando que a senha real deve ser definida com `\password` no psql
    - Manter o `CREATE DATABASE` inalterado (já é correto)
    - _Requisitos: 4.1, 4.2_

- [ ] 2. Corrigir IMPLANTACAO.md — Seções iniciais e Security Groups
  - [ ] 2.1 Atualizar seção "Campos Reservados" de `IMPLANTACAO.md`
    - Remover placeholders `<SECURITY_GROUP_BACKEND>` e `<ALB_DNS>`
    - Adicionar: `<SECURITY_GROUP_BASTION>`, `<SECURITY_GROUP_LAMBDA>`, `<API_GATEWAY_URL>`, `<INSTANCE_ID_BASTION>`
    - Adicionar aviso de segurança: "⚠️ SEGURANÇA: Nenhuma credencial real (senhas, tokens, Access Keys) deve ser gravada nestes arquivos. Use os placeholders abaixo e obtenha os valores reais no Console AWS ou Secrets Manager."
    - _Requisitos: 14.3, 14.4, 8.2_

  - [ ] 2.2 Atualizar seção "Pré-requisitos" de `IMPLANTACAO.md`
    - Remover: "Backend rodando (EC2/Lambda/ECS)", "ALB configurado"
    - Adicionar: "Lambda implantada com API Gateway configurado", "EC2 bastion com SSM Agent ativo"
    - _Requisitos: 1.4, 8.2_

  - [ ] 2.3 Corrigir Etapa 1 (SG do RDS) em `IMPLANTACAO.md`
    - Alterar origem da regra inbound de `<SECURITY_GROUP_BACKEND>` para `<SECURITY_GROUP_PROXY>` (RDS só aceita do Proxy)
    - _Requisitos: 3.3, 3.5_

  - [ ] 2.4 Corrigir Etapa 2 (SG do RDS Proxy) em `IMPLANTACAO.md`
    - Adicionar duas origens na regra inbound: `<SECURITY_GROUP_LAMBDA>` (backend) E `<SECURITY_GROUP_BASTION>` (acesso admin)
    - Remover referência a `<SECURITY_GROUP_BACKEND>`
    - _Requisitos: 3.2, 3.5_

  - [ ] 2.5 Adicionar nova etapa em `IMPLANTACAO.md`: Security Group do Bastion
    - Inserir entre as etapas de SG existentes e o DB Subnet Group
    - Nome: `dino-game-bastion-sg`, saída HTTPS/443 para 0.0.0.0/0, sem regras de entrada obrigatórias
    - _Requisitos: 2.4, 3.1_

  - [ ] 2.6 Adicionar nova seção em `IMPLANTACAO.md`: Requisitos de rede para SSM
    - Documentar que SSM Agent precisa saída HTTPS/443
    - Listar 3 opções: sub-rede pública + IGW, sub-rede privada + NAT, VPC Endpoints
    - Detalhar opção de sub-rede pública (criação, tabela de rotas 0.0.0.0/0 → igw, IP público)
    - _Requisitos: 2.1, 2.2, 2.3_

- [ ] 3. Checkpoint — Verificar consistência das seções iniciais
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Corrigir IMPLANTACAO.md — Etapas de execução SQL e Proxy
  - [ ] 4.1 Corrigir Etapa 6 (Scripts SQL) em `IMPLANTACAO.md`
    - Substituir `sudo yum install -y postgresql15` por `sudo dnf install -y postgresql15`
    - Adicionar aviso sobre versão: "É esperado WARNING de versão (psql 15 vs servidor 18)"
    - Documentar transferência de scripts: `git clone` do repositório, diretório `~/Amazon_RDS_e_AWS_Backup/sql/`
    - Documentar uso de `\password dinogame_app` como forma segura de definir senha
    - Documentar ordem correta: criar banco → `\c dinogame` → scripts de tabelas → permissões
    - _Requisitos: 9.1, 9.3, 10.1, 10.2, 10.3, 4.3, 4.4_

  - [ ] 4.2 Adicionar seção de sincronização de senhas em `IMPLANTACAO.md`
    - Explicar que senha no PostgreSQL e campo password no Secrets Manager DEVEM ser iguais
    - Documentar procedimento: primeiro Secrets Manager, depois `\password` no psql
    - Documentar que erro "password is wrong" via Proxy indica dessincronização
    - _Requisitos: 5.1, 5.2, 5.3_

  - [ ] 4.3 Corrigir validação do RDS Proxy (Etapa 7) em `IMPLANTACAO.md`
    - Adicionar `sslmode=require` no comando psql: `psql "host=<RDS_PROXY_ENDPOINT> dbname=dinogame user=dinogame_app sslmode=require"`
    - Documentar erro de dessincronização de senha
    - _Requisitos: 6.1, 6.4_

  - [ ] 4.4 Corrigir validação da réplica (Etapa 8) em `IMPLANTACAO.md`
    - Substituir teste INSERT destrutivo por: `SELECT pg_is_in_recovery()` (esperado: `t`) e `SHOW transaction_read_only` (esperado: `on`)
    - Remover o bloco INSERT como método de validação
    - _Requisitos: 6.2, 6.3_

- [ ] 5. Corrigir IMPLANTACAO.md — API Gateway, Lambda na VPC, Build, Deploy e Frontend
  - [ ] 5.1 Adicionar nova etapa em `IMPLANTACAO.md`: Configurar Lambda na VPC e API Gateway
    - Inserir entre a Etapa 8 (Réplica) e a Etapa 9 (Build/Deploy) — será a nova Etapa 8.5 ou renumerar
    - Parte A: Documentar configuração da Lambda na VPC (sub-redes privadas, Security Group da Lambda, IAM Policy `AWSLambdaVPCAccessExecutionRole`)
    - Parte B: Documentar variáveis de ambiente da Lambda: `RDS_PROXY_ENDPOINT`, `RDS_REPLICA_ENDPOINT`, `RDS_PORT`, `RDS_DATABASE`, `RDS_USER`, `RDS_PASSWORD`
    - Parte C: Documentar criação das rotas do Projeto 3 no API Gateway: `/player/history` (GET), `/player/stats` (GET), `/ranking/persistent` (GET), `/match/record` (POST), `/db/health` (GET) — cada um com OPTIONS para CORS
    - Parte D: Documentar deploy do API Gateway (Actions → Deploy API → stage: dev)
    - Parte E: Documentar validação com `curl https://<URL_DA_API_GATEWAY>/db/health`
    - Parte F: Documentar troubleshooting do erro 503 (Lambda fora da VPC, SG sem saída 5432, variáveis ausentes, senhas dessincronizadas)
    - _Requisitos: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [ ] 5.2 Corrigir Etapa 9 (Build/Deploy Backend) em `IMPLANTACAO.md`
    - Remover bloco EC2 inteiro: `cd /home/ec2-user/app`, `npm install --production`, `npm run build`, `pm2 restart all`
    - Adicionar indicação explícita: "O backend roda na AWS Lambda, não na EC2"
    - Corrigir comando ZIP PowerShell: `Compress-Archive -Path .\dist, .\node_modules -DestinationPath .\lambda-function.zip -Force`
    - Adicionar explicação: "A estrutura do ZIP deve preservar os diretórios dist/ e node_modules/ na raiz"
    - Manter comando Linux/Mac inalterado
    - _Requisitos: 1.2, 1.3, 1.4, 7.1, 7.2, 7.3_

  - [ ] 5.3 Corrigir variáveis de ambiente do backend em `IMPLANTACAO.md`
    - Remover referências a ALB nas variáveis e validação
    - _Requisitos: 8.2_

  - [ ] 5.4 Corrigir Etapa 10 (Frontend) em `IMPLANTACAO.md`
    - Substituir `VITE_API_URL=https://<ALB_DNS>` por `VITE_API_URL=https://<URL_DA_API_GATEWAY>`
    - Adicionar aviso: "⚠️ Variáveis VITE_ são incorporadas ao bundle JavaScript e ficam visíveis no navegador. Nunca inclua senhas, endpoints privados ou chaves AWS."
    - _Requisitos: 8.1, 8.3_

  - [ ] 5.5 Corrigir Etapa 13 (Testes) em `IMPLANTACAO.md`
    - Substituir `curl https://<ALB_DNS>/db/health` por `curl https://<URL_DA_API_GATEWAY>/db/health`
    - _Requisitos: 8.2_

  - [ ] 5.6 Adicionar seção de fluxo administrativo em `IMPLANTACAO.md`
    - Documentar: computador local → AWS CLI → SSM Session Manager → EC2 bastion → psql → RDS/Proxy/Réplica
    - Documentar comando `aws ssm start-session --target <INSTANCE_ID_BASTION>`
    - Explicar que `aws configure` dá acesso à API AWS mas NÃO cria conectividade de rede entre EC2 e serviços
    - _Requisitos: 12.1, 12.2, 12.3_

  - [ ] 5.7 Adicionar checklist de validação final em `IMPLANTACAO.md`
    - Itens de infraestrutura: EC2 acessível via SSM, scripts SQL executados, tabelas existem, usuário criado com permissões, senhas sincronizadas
    - Itens de dados: RDS Proxy AVAILABLE, SELECT funcional pelo Proxy, réplica com `pg_is_in_recovery() = t`
    - Itens de aplicação: ZIP correto, Lambda na VPC com SG correto, variáveis de ambiente definidas, rotas no API Gateway criadas e deployed, frontend com VITE_API_URL apontando para API Gateway
    - _Requisitos: 13.1, 13.2, 13.3_

- [ ] 6. Checkpoint — Verificar que IMPLANTACAO.md não contém mais referências incorretas
  - Ensure all tests pass, ask the user if questions arise.
  - Executar busca por: "ALB", "Application Load Balancer", "pm2", "ec2-user/app", "yum install", "<SECURITY_GROUP_BACKEND>"

- [ ] 7. Corrigir ARQUITETURA.md
  - [ ] 7.1 Atualizar diagrama Mermaid principal (seção 2) em `ARQUITETURA.md`
    - Remover subgraph "Backend (EC2 / ECS)" com ALB e App
    - Adicionar subgraph "Backend Serverless" com API Gateway e Lambda
    - Adicionar subgraph "Acesso Administrativo" com SSM e EC2 Bastion
    - Ajustar todas as conexões: Cliente → API Gateway → Lambda → RDS Proxy / ElastiCache
    - _Requisitos: 11.1, 11.2, 11.3, 11.5_

  - [ ] 7.2 Atualizar diagrama de segurança (seção 6) em `ARQUITETURA.md`
    - Remover SG-ALB e SG-Backend
    - Adicionar SG-Lambda e SG-Bastion
    - Ajustar fluxo: Internet → API Gateway → Lambda → Proxy → RDS
    - _Requisitos: 11.2, 3.1_

  - [ ] 7.3 Atualizar tabela de serviços (seção 7) em `ARQUITETURA.md`
    - Remover linhas: Application Load Balancer, Amazon EC2 / ECS
    - Adicionar: Amazon API Gateway (expõe API REST para frontend), AWS Lambda (executa backend Node.js), EC2 Bastion (acesso administrativo ao RDS via SSM)
    - _Requisitos: 11.1, 11.2_

  - [ ] 7.4 Atualizar diagrama de sequência (seção 4) em `ARQUITETURA.md`
    - Substituir participante "B" de "Backend (Node.js)" para "Lambda (Node.js)"
    - Remover qualquer referência a ALB no fluxo
    - _Requisitos: 11.1, 11.2_

- [ ] 8. Corrigir README.md
  - [ ] 8.1 Atualizar diagrama texto e tabelas em `README.md`
    - Substituir `Jogador → ALB → Backend (Node.js)` por `Jogador → API Gateway → Lambda (Node.js)`
    - Remover linha ALB da tabela "O Que Cada Serviço Faz"
    - Alterar "Backend (EC2/Lambda)" para "AWS Lambda"
    - Adicionar linha API Gateway na tabela
    - Adicionar linha EC2 Bastion (SSM) na tabela
    - _Requisitos: 11.4_

  - [ ] 8.2 Atualizar seção de tecnologias e custos em `README.md`
    - Alterar "Backend: Node.js + TypeScript (Lambda ou EC2)" para "Backend: Node.js + TypeScript (AWS Lambda)"
    - Remover linha ALB (~$16) da tabela de custos
    - Adicionar nota sobre API Gateway (pay-per-request)
    - _Requisitos: 11.4_

- [ ] 9. Verificação de segurança
  - [ ] 9.1 Verificar `.gitignore` e ausência de credenciais
    - Confirmar que `.env` está listado no `.gitignore` (já está — apenas documentar a verificação)
    - Verificar que nenhum arquivo versionado contém senhas reais, tokens ou Access Keys
    - Verificar que todos os valores sensíveis usam placeholders `<...>`
    - _Requisitos: 14.1, 14.2_

- [ ] 10. Checkpoint final — Validação completa
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que `grep -ri "ALB\|Application Load Balancer" IMPLANTACAO.md ARQUITETURA.md README.md` retorna 0 resultados
  - Verificar que diagramas Mermaid não têm erros de sintaxe
  - Verificar que nenhuma credencial real está nos arquivos versionados

## Notes

- Preservar o conteúdo existente que já está correto — não reescrever do zero
- Todas as correções são em arquivos de documentação (Markdown) e um script SQL
- Não há alterações de código de aplicação (backend/frontend)
- A linguagem dos documentos é Português Brasileiro; termos AWS em inglês quando são nomes de serviço

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2"],
      "description": "Script SQL e seções iniciais do IMPLANTACAO.md (independentes)"
    },
    {
      "wave": 2,
      "tasks": ["3"],
      "description": "Checkpoint inicial após correções de SGs e SQL"
    },
    {
      "wave": 3,
      "tasks": ["4", "5"],
      "description": "Correções de etapas de execução SQL/Proxy e Build/Deploy"
    },
    {
      "wave": 4,
      "tasks": ["6"],
      "description": "Checkpoint de verificação do IMPLANTACAO.md completo"
    },
    {
      "wave": 5,
      "tasks": ["7", "8"],
      "description": "Correções em ARQUITETURA.md e README.md (independentes)"
    },
    {
      "wave": 6,
      "tasks": ["9"],
      "description": "Verificação de segurança (.gitignore e credenciais)"
    },
    {
      "wave": 7,
      "tasks": ["10"],
      "description": "Checkpoint final — validação completa de todos os arquivos"
    }
  ]
}
```
