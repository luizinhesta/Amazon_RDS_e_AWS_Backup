-- ============================================
-- Projeto 3 - Amazon RDS PostgreSQL
-- Script 04: Dados de Teste
-- ============================================
-- Execute este script conectado ao banco 'dinogame'
-- ATENÇÃO: Use apenas em ambiente de laboratório/teste

-- Jogadores de teste
INSERT INTO players (player_id, username, email, best_score, total_games, total_wins, total_losses) VALUES
  ('test-user-001', 'DinoRex', 'rex@teste.com', 1500, 25, 10, 15),
  ('test-user-002', 'VelociRaptor', 'raptor@teste.com', 2300, 40, 20, 20),
  ('test-user-003', 'TriceraTop', 'tricera@teste.com', 1800, 30, 15, 15),
  ('test-user-004', 'PteroVoador', 'ptero@teste.com', 950, 15, 5, 10),
  ('test-user-005', 'BrontoSauro', 'bronto@teste.com', 3100, 55, 30, 25),
  ('test-user-006', 'StegoPlaca', 'stego@teste.com', 2700, 45, 22, 23),
  ('test-user-007', 'AnkyloTanque', 'ankylo@teste.com', 1200, 20, 8, 12),
  ('test-user-008', 'CompyVeloz', 'compy@teste.com', 600, 10, 3, 7),
  ('test-user-009', 'SpinoDorsal', 'spino@teste.com', 4200, 70, 40, 30),
  ('test-user-010', 'ParaCresta', 'para@teste.com', 1950, 35, 18, 17)
ON CONFLICT (player_id) DO NOTHING;

-- Partidas de teste para test-user-001
INSERT INTO matches (player_id, score, duration_seconds, started_at, finished_at, is_new_record) VALUES
  ('test-user-001', 500, 45, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '45 seconds', FALSE),
  ('test-user-001', 800, 62, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '62 seconds', FALSE),
  ('test-user-001', 1200, 90, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '90 seconds', TRUE),
  ('test-user-001', 900, 70, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '70 seconds', FALSE),
  ('test-user-001', 1500, 120, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '120 seconds', TRUE),
  ('test-user-001', 1100, 85, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '85 seconds', FALSE),
  ('test-user-001', 1350, 100, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '100 seconds', FALSE);

-- Partidas de teste para test-user-005 (melhor jogador)
INSERT INTO matches (player_id, score, duration_seconds, started_at, finished_at, is_new_record) VALUES
  ('test-user-005', 2500, 180, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '180 seconds', TRUE),
  ('test-user-005', 2800, 200, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days' + INTERVAL '200 seconds', TRUE),
  ('test-user-005', 3100, 240, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '240 seconds', TRUE),
  ('test-user-005', 2900, 210, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '210 seconds', FALSE),
  ('test-user-005', 3050, 230, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '230 seconds', FALSE);

-- Verificar inserção
SELECT 'Jogadores inseridos: ' || COUNT(*)::TEXT FROM players;
SELECT 'Partidas inseridas: ' || COUNT(*)::TEXT FROM matches;
