-- ============================================
-- Projeto 3 - Amazon RDS PostgreSQL
-- Script 02: Criação das Tabelas
-- ============================================
-- Execute este script conectado ao banco 'dinogame'

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Tabela: players (perfil dos jogadores)
-- ============================================
CREATE TABLE players (
  player_id    VARCHAR(128) PRIMARY KEY,  -- sub do Cognito
  username     VARCHAR(64) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  best_score   INTEGER DEFAULT 0,
  total_games  INTEGER DEFAULT 0,
  total_wins   INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentários descritivos
COMMENT ON TABLE players IS 'Perfil permanente dos jogadores autenticados pelo Cognito';
COMMENT ON COLUMN players.player_id IS 'Sub (subject) do token JWT do Amazon Cognito';
COMMENT ON COLUMN players.best_score IS 'Maior pontuação atingida pelo jogador (recorde)';

-- ============================================
-- Tabela: matches (histórico de partidas)
-- ============================================
CREATE TABLE matches (
  match_id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id        VARCHAR(128) NOT NULL REFERENCES players(player_id),
  score            INTEGER NOT NULL CHECK (score >= 0),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  started_at       TIMESTAMP WITH TIME ZONE NOT NULL,
  finished_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_new_record    BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE matches IS 'Histórico completo de todas as partidas jogadas';
COMMENT ON COLUMN matches.is_new_record IS 'Indica se esta partida estabeleceu um novo recorde pessoal';

-- ============================================
-- Tabela: ranking_history (snapshots do ranking)
-- ============================================
CREATE TABLE ranking_history (
  id          SERIAL PRIMARY KEY,
  player_id   VARCHAR(128) NOT NULL REFERENCES players(player_id),
  position    INTEGER NOT NULL,
  score       INTEGER NOT NULL,
  snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE ranking_history IS 'Snapshots periódicos do ranking para análise histórica';

-- ============================================
-- Conceder permissões ao usuário da aplicação
-- ============================================
GRANT USAGE ON SCHEMA public TO dinogame_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO dinogame_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dinogame_app;

-- Garantir permissões em tabelas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO dinogame_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO dinogame_app;
