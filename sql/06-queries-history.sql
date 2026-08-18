-- ============================================
-- Projeto 3 - Amazon RDS PostgreSQL
-- Script 06: Consultas de Histórico
-- ============================================
-- Estas queries são executadas pela RÉPLICA DE LEITURA

-- Histórico de partidas de um jogador (últimas 20)
-- Substituir $1 pelo player_id real
SELECT 
  match_id,
  score as pontuacao,
  duration_seconds as duracao_segundos,
  started_at as inicio,
  finished_at as fim,
  is_new_record as novo_recorde
FROM matches
WHERE player_id = $1
ORDER BY finished_at DESC
LIMIT 20;

-- Estatísticas detalhadas do jogador
SELECT 
  p.player_id,
  p.username as jogador,
  p.best_score as melhor_pontuacao,
  p.total_games as total_partidas,
  p.total_wins as vitorias,
  p.total_losses as derrotas,
  COALESCE(AVG(m.score), 0)::INTEGER as media_pontuacao,
  COALESCE(SUM(m.duration_seconds), 0)::INTEGER as tempo_total_segundos,
  MAX(m.finished_at) as ultima_partida
FROM players p
LEFT JOIN matches m ON p.player_id = m.player_id
WHERE p.player_id = $1
GROUP BY p.player_id, p.username, p.best_score, 
         p.total_games, p.total_wins, p.total_losses;

-- Evolução de pontuação ao longo do tempo
SELECT 
  DATE(finished_at) as dia,
  MAX(score) as melhor_do_dia,
  AVG(score)::INTEGER as media_do_dia,
  COUNT(*) as partidas_no_dia
FROM matches
WHERE player_id = $1
GROUP BY DATE(finished_at)
ORDER BY dia DESC
LIMIT 30;

-- Atualização de recorde
-- Esta query é executada na INSTÂNCIA PRINCIPAL (escrita)
UPDATE players SET
  best_score = CASE WHEN $2 > best_score THEN $2 ELSE best_score END,
  total_games = total_games + 1,
  updated_at = NOW()
WHERE player_id = $1;
