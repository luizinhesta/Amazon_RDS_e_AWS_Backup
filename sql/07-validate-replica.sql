-- ============================================
-- Projeto 3 - Amazon RDS PostgreSQL
-- Script 07: Validação da Réplica de Leitura
-- ============================================
-- Execute estas queries para validar que a réplica está funcionando

-- 1. Verificar lag de replicação (executar na réplica)
SELECT 
  CASE 
    WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() 
    THEN '0 seconds'
    ELSE EXTRACT(EPOCH FROM NOW() - pg_last_xact_replay_timestamp())::TEXT || ' seconds'
  END AS replication_lag;

-- 2. Verificar se está em modo standby (réplica)
SELECT pg_is_in_recovery();
-- TRUE = é uma réplica de leitura
-- FALSE = é a instância principal

-- 3. Contar registros (deve ser igual na principal e réplica)
SELECT 'players' as tabela, COUNT(*) as registros FROM players
UNION ALL
SELECT 'matches' as tabela, COUNT(*) as registros FROM matches
UNION ALL
SELECT 'ranking_history' as tabela, COUNT(*) as registros FROM ranking_history;

-- 4. Testar que a réplica NÃO aceita escrita
-- Este comando DEVE falhar na réplica:
-- INSERT INTO players (player_id, username, email) VALUES ('test', 'test', 'test@test.com');
-- Erro esperado: cannot execute INSERT in a read-only transaction

-- 5. Verificar tamanho das tabelas
SELECT 
  relname as tabela,
  pg_size_pretty(pg_total_relation_size(relid)) as tamanho_total
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- 6. Verificar índices
SELECT 
  indexname as indice,
  tablename as tabela,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as tamanho
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
