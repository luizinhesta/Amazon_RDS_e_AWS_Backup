// Shared types for the backend Lambda function

export interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface HealthResponse {
  status: string;
  message: string;
}

export interface MeResponse {
  autenticado: boolean;
  usuarioId: string;
  email: string;
  nome: string;
  apelido: string;
}

// Game types

export interface GameSession {
  status: 'playing' | 'finished';
  score: number;
  startedAt: string;
}

export interface GameStartResponse {
  sessionId: string;
  status: string;
  expiresIn: number;
}

export interface GameScoreRequest {
  score: number;
}

export interface GameScoreResponse {
  recorded: boolean;
  newBest: boolean;
  bestScore: number;
  rankPosition: number;
}

export interface RankingEntry {
  position: number;
  username: string;
  score: number;
}

export interface PlayerInfo {
  username: string;
  bestScore: number;
  session: { status: string } | null;
}

export interface GameStatusResponse {
  game: 'online' | 'offline';
  cache: 'connected' | 'disconnected';
}

export interface ErrorResponse {
  message: string;
}

// Projeto 3 - RDS Types

export interface MatchRecordRequest {
  score: number;
  durationSeconds: number;
  isNewRecord: boolean;
}

export interface MatchRecordResponse {
  recorded: boolean;
  matchId: string;
  score: number;
  durationSeconds: number;
  isNewRecord: boolean;
  source: 'primary';
}

export interface PlayerHistoryResponse {
  matches: Array<{
    match_id: string;
    player_id: string;
    score: number;
    duration_seconds: number;
    started_at: string;
    finished_at: string;
    is_new_record: boolean;
  }>;
  total: number;
  source: 'replica';
}

export interface PlayerStatsResponse {
  player_id: string;
  username: string;
  best_score: number;
  total_games: number;
  total_wins: number;
  total_losses: number;
  average_score: number;
  total_play_time_seconds: number;
  last_played_at: string | null;
  source: 'replica';
}

export interface DbHealthResponse {
  services: {
    rds_primary: 'connected' | 'disconnected';
    rds_replica: 'connected' | 'disconnected';
    elasticache: 'connected' | 'disconnected';
  };
  overall: 'healthy' | 'degraded';
  timestamp: string;
}
