-- ============================================
-- Projeto 3 - Amazon RDS PostgreSQL
-- Script 01: Criação do Banco de Dados
-- ============================================
-- Execute este script conectado ao banco 'postgres' (padrão)
-- como usuário administrador (master user do RDS)

-- Criar banco de dados da aplicação
CREATE DATABASE dinogame
  WITH ENCODING = 'UTF8'
       LC_COLLATE = 'en_US.UTF-8'
       LC_CTYPE = 'en_US.UTF-8'
       TEMPLATE = template0;

-- Criar usuário da aplicação (senha será gerenciada pelo Secrets Manager)
-- IMPORTANTE: Substitua <SENHA_SEGURA> pela senha gerada pelo Secrets Manager
CREATE USER dinogame_app WITH PASSWORD '<SENHA_SEGURA>';

-- Conceder permissões ao usuário da aplicação
GRANT CONNECT ON DATABASE dinogame TO dinogame_app;

-- Conectar ao banco dinogame antes de executar os próximos scripts
-- \c dinogame
