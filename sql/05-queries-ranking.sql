-- ============================================
-- Projeto 3 - Amazon RDS PostgreSQL
-- Script 05: Consultas de Ranking
-- ============================================
-- Estas queries são executadas pela RÉPLICA DE LEITURA

-- Ranking Top 10 (consulta principal)
SELECT 
  ROW_NUMBER() OVER (ORDER BY best_score DESC) as posicao,
  username as jogador,
  best_score as melhor_pontuacao,
  total_games as total_partidas
FROM players
WHERE best_score > 0
ORDER BY best_score DESC
LIMIT 10;

-- Ranking com média de pontuação
SELECT 
  ROW_NUMBER() OVER (ORDER BY p.best_score DESC) as posicao,
  p.username as jogador,
  p.best_score as melhor_pontuacao,
  p.total_games as total_partidas,
  COALESCE(AVG(m.score)::INTEGER, 0) as media_pontuacao
FROM players p
LEFT JOIN matches m ON p.player_id = m.player_id
WHERE p.best_score > 0
GROUP BY p.player_id, p.username, p.best_score, p.total_games
ORDER BY p.best_score DESC
LIMIT 10;

-- Ranking por total de partidas (jogadores mais ativos)
SELECT 
  ROW_NUMBER() OVER (ORDER BY total_games DESC) as posicao,
  username as jogador,
  total_games as total_partidas,
  best_score as melhor_pontuacao
FROM players
WHERE total_games > 0
ORDER BY total_games DESC
LIMIT 10;

-- Jogadores que bateram recorde recentemente
SELECT 
  p.username as jogador,
  m.score as pontuacao_recorde,
  m.finished_at as data_recorde
FROM matches m
JOIN players p ON m.player_id = p.player_id
WHERE m.is_new_record = TRUE
ORDER BY m.finished_at DESC
LIMIT 5;
