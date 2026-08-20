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

-- ============================================
-- Criação idempotente do usuário da aplicação
-- ============================================
-- NOTA DE SEGURANÇA: A senha 'PLACEHOLDER_TROCAR' é apenas um placeholder.
-- Após criar o usuário, defina a senha real com o comando:
--   \password dinogame_app
-- no psql. Isso evita que a senha fique registrada no histórico de comandos.
-- A senha deve ser a mesma configurada no AWS Secrets Manager.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dinogame_app') THEN
    CREATE ROLE dinogame_app WITH LOGIN PASSWORD 'PLACEHOLDER_TROCAR';
  END IF;
END
$$;

-- ============================================
-- Permissões granulares (princípio de menor privilégio)
-- ============================================

-- Permissão de conexão ao banco
GRANT CONNECT ON DATABASE dinogame TO dinogame_app;

-- Permissão de uso do schema public
GRANT USAGE ON SCHEMA public TO dinogame_app;

-- Permissões em tabelas existentes (CRUD)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dinogame_app;

-- Permissões em sequences existentes (necessário para colunas SERIAL/IDENTITY)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dinogame_app;

-- Permissões padrão para tabelas criadas no futuro pelo admin
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dinogame_app;

-- Permissões padrão para sequences criadas no futuro pelo admin
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO dinogame_app;

-- ============================================
-- Próximos passos:
-- 1. Conectar ao banco dinogame: \c dinogame
-- 2. Executar os scripts de criação de tabelas (02-create-tables.sql, etc.)
-- 3. Definir a senha real do usuário: \password dinogame_app
-- ============================================
