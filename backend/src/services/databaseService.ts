// Database Service - Amazon RDS (PostgreSQL) via RDS Proxy
// Separação de leitura/escrita: principal para escrita, réplica para leitura

import { logError, logSafe } from '../utils/logger';

declare const process: { env: Record<string, string | undefined> };

// Endpoints configuráveis por variáveis de ambiente
const RDS_PROXY_ENDPOINT = process.env.RDS_PROXY_ENDPOINT || 'localhost';
const RDS_REPLICA_ENDPOINT = process.env.RDS_REPLICA_ENDPOINT || RDS_PROXY_ENDPOINT;
const RDS_PORT = parseInt(process.env.RDS_PORT || '5432', 10);
const RDS_DATABASE = process.env.RDS_DATABASE || 'dinogame';
const RDS_USER = process.env.RDS_USER || 'dinogame_app';
// Senha obtida do Secrets Manager - NUNCA no código
const RDS_PASSWORD = process.env.RDS_PASSWORD || '';

// Interface para resultados de query
interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

// Simula pool de conexões via RDS Proxy
// Em produção, usar pg (node-postgres) com Pool
interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

function getWriteConfig(): ConnectionConfig {
  return {
    host: RDS_PROXY_ENDPOINT,
    port: RDS_PORT,
    database: RDS_DATABASE,
    user: RDS_USER,
    password: RDS_PASSWORD,
    ssl: true,
  };
}

function getReadConfig(): ConnectionConfig {
  return {
    host: RDS_REPLICA_ENDPOINT,
    port: RDS_PORT,
    database: RDS_DATABASE,
    user: RDS_USER,
    password: RDS_PASSWORD,
    ssl: true,
  };
}

// Tipos do banco de dados
export interface PlayerProfile {
  player_id: string;
  username: string;
  email: string;
  best_score: number;
  total_games: number;
  total_wins: number;
  total_losses: number;
  created_at: string;
  updated_at: string;
}

export interface GameMatch {
  match_id: string;
  player_id: string;
  score: number;
  duration_seconds: number;
  started_at: string;
  finished_at: string;
  is_new_record: boolean;
}

export interface RankingRecord {
  position: number;
  username: string;
  best_score: number;
  total_games: number;
}

export interface PlayerStats {
  player_id: string;
  username: string;
  best_score: number;
  total_games: number;
  total_wins: number;
  total_losses: number;
  average_score: number;
  total_play_time_seconds: number;
  last_played_at: string | null;
}

// ============================================
// Database Service - Operações CRUD
// ============================================

export const databaseService = {
  // ---- ESCRITA (via RDS Proxy → Instância Principal) ----

  /**
   * Registra ou atualiza perfil do jogador no banco permanente
   */
  async upsertPlayer(playerId: string, username: string, email: string): Promise<PlayerProfile> {
    const config = getWriteConfig();
    logSafe('DB Write: upsertPlayer', { host: config.host, playerId });

    // Em produção: INSERT ... ON CONFLICT (player_id) DO UPDATE
    // Retorna o perfil atualizado
    const query = `
      INSERT INTO players (player_id, username, email, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (player_id) DO UPDATE SET
        username = EXCLUDED.username,
        updated_at = NOW()
      RETURNING *;
    `;

    try {
      const result = await executeWrite<PlayerProfile>(query, [playerId, username, email]);
      return result.rows[0];
    } catch (error) {
      logError('DB Error: upsertPlayer', { playerId, error: (error as Error).message });
      throw error;
    }
  },

  /**
   * Registra uma partida finalizada
   */
  async recordMatch(
    playerId: string,
    score: number,
    durationSeconds: number,
    isNewRecord: boolean
  ): Promise<GameMatch> {
    const config = getWriteConfig();
    logSafe('DB Write: recordMatch', { host: config.host, playerId, score: String(score) });

    const query = `
      INSERT INTO matches (player_id, score, duration_seconds, started_at, finished_at, is_new_record)
      VALUES ($1, $2, $3, NOW() - INTERVAL '1 second' * $3, NOW(), $4)
      RETURNING *;
    `;

    try {
      const result = await executeWrite<GameMatch>(query, [playerId, score, durationSeconds, isNewRecord]);

      // Atualizar estatísticas do jogador
      await this.updatePlayerStats(playerId, score, isNewRecord);

      return result.rows[0];
    } catch (error) {
      logError('DB Error: recordMatch', { playerId, error: (error as Error).message });
      throw error;
    }
  },

  /**
   * Atualiza estatísticas do jogador após partida
   */
  async updatePlayerStats(playerId: string, score: number, isNewRecord: boolean): Promise<void> {
    const query = `
      UPDATE players SET
        total_games = total_games + 1,
        best_score = CASE WHEN $2 > best_score THEN $2 ELSE best_score END,
        updated_at = NOW()
      WHERE player_id = $1;
    `;

    try {
      await executeWrite(query, [playerId, score]);
    } catch (error) {
      logError('DB Error: updatePlayerStats', { playerId, error: (error as Error).message });
      throw error;
    }
  },

  // ---- LEITURA (via Réplica de Leitura) ----

  /**
   * Consulta ranking consolidado (réplica de leitura)
   * Aceita pequena defasagem - ideal para relatórios
   */
  async getRankingFromReplica(limit: number = 10): Promise<RankingRecord[]> {
    const config = getReadConfig();
    logSafe('DB Read (replica): getRanking', { host: config.host, limit: String(limit) });

    const query = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY best_score DESC) as position,
        username,
        best_score,
        total_games
      FROM players
      WHERE best_score > 0
      ORDER BY best_score DESC
      LIMIT $1;
    `;

    try {
      const result = await executeRead<RankingRecord>(query, [limit]);
      return result.rows;
    } catch (error) {
      logError('DB Error: getRankingFromReplica', { error: (error as Error).message });
      throw error;
    }
  },

  /**
   * Consulta histórico de partidas do jogador (réplica de leitura)
   */
  async getPlayerHistory(playerId: string, limit: number = 20): Promise<GameMatch[]> {
    const config = getReadConfig();
    logSafe('DB Read (replica): getPlayerHistory', { host: config.host, playerId });

    const query = `
      SELECT match_id, player_id, score, duration_seconds, 
             started_at, finished_at, is_new_record
      FROM matches
      WHERE player_id = $1
      ORDER BY finished_at DESC
      LIMIT $2;
    `;

    try {
      const result = await executeRead<GameMatch>(query, [playerId, limit]);
      return result.rows;
    } catch (error) {
      logError('DB Error: getPlayerHistory', { playerId, error: (error as Error).message });
      throw error;
    }
  },

  /**
   * Consulta estatísticas detalhadas do jogador (réplica de leitura)
   */
  async getPlayerStats(playerId: string): Promise<PlayerStats | null> {
    const config = getReadConfig();
    logSafe('DB Read (replica): getPlayerStats', { host: config.host, playerId });

    const query = `
      SELECT 
        p.player_id,
        p.username,
        p.best_score,
        p.total_games,
        p.total_wins,
        p.total_losses,
        COALESCE(AVG(m.score), 0)::INTEGER as average_score,
        COALESCE(SUM(m.duration_seconds), 0)::INTEGER as total_play_time_seconds,
        MAX(m.finished_at) as last_played_at
      FROM players p
      LEFT JOIN matches m ON p.player_id = m.player_id
      WHERE p.player_id = $1
      GROUP BY p.player_id, p.username, p.best_score, 
               p.total_games, p.total_wins, p.total_losses;
    `;

    try {
      const result = await executeRead<PlayerStats>(query, [playerId]);
      return result.rows[0] || null;
    } catch (error) {
      logError('DB Error: getPlayerStats', { playerId, error: (error as Error).message });
      throw error;
    }
  },

  /**
   * Verifica conectividade com o banco (escrita)
   */
  async pingWrite(): Promise<boolean> {
    try {
      await executeWrite('SELECT 1 as health;', []);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Verifica conectividade com a réplica (leitura)
   */
  async pingRead(): Promise<boolean> {
    try {
      await executeRead('SELECT 1 as health;', []);
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Funções auxiliares de execução de queries
// Em produção, substituir por pg Pool real
// ============================================

async function executeWrite<T = Record<string, unknown>>(
  query: string,
  params: unknown[]
): Promise<QueryResult<T>> {
  const config = getWriteConfig();
  
  // Importação dinâmica do pg em runtime
  // Em Lambda, instalar 'pg' como dependência
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const result = await pool.query(query, params);
    await pool.end();

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  } catch (error) {
    logError('executeWrite failed', { 
      host: config.host, 
      error: (error as Error).message 
    });
    throw error;
  }
}

async function executeRead<T = Record<string, unknown>>(
  query: string,
  params: unknown[]
): Promise<QueryResult<T>> {
  const config = getReadConfig();

  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const result = await pool.query(query, params);
    await pool.end();

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  } catch (error) {
    logError('executeRead failed', { 
      host: config.host, 
      error: (error as Error).message 
    });
    throw error;
  }
}
