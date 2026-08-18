-- ============================================
-- Projeto 3 - Amazon RDS PostgreSQL
-- Script 03: Criação dos Índices
-- ============================================
-- Execute este script conectado ao banco 'dinogame'

-- Índice para ranking (consulta mais frequente)
CREATE INDEX idx_players_best_score 
  ON players(best_score DESC) 
  WHERE best_score > 0;

-- Índice para busca de jogador por email
CREATE INDEX idx_players_email 
  ON players(email);

-- Índice para histórico de partidas por jogador (ordenado por data)
CREATE INDEX idx_matches_player_finished 
  ON matches(player_id, finished_at DESC);

-- Índice para consultas de pontuação
CREATE INDEX idx_matches_score 
  ON matches(score DESC);

-- Índice para ranking_history por data
CREATE INDEX idx_ranking_history_snapshot 
  ON ranking_history(snapshot_at DESC);

-- Índice para ranking_history por jogador
CREATE INDEX idx_ranking_history_player 
  ON ranking_history(player_id, snapshot_at DESC);

-- Análise: verificar que os índices foram criados
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
