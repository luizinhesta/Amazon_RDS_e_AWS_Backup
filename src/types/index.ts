export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
}

export interface UserProfile {
  userId: string;       // sub do Cognito
  email: string;
  name: string;
  preferredUsername: string;  // apelido
  emailVerified: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (data: RegisterData) => Promise<void>;
  confirmEmail: (email: string, code: string) => Promise<void>;
  resendConfirmationCode: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (attributes: Partial<ProfileAttributes>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export type LoginResult =
  | { status: 'success' }
  | { status: 'confirmSignUp'; email: string };

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  preferredUsername: string;
}

export interface ProfileAttributes {
  name: string;
  preferredUsername: string;
}

export interface ValidationResult {
  isValid: boolean;
  errorMessage: string | null;  // Mensagem em PT-BR
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;  // 10000ms
  getToken: () => Promise<string | null>;
}

// --- Tipos do Jogo ---

export interface GameSession {
  status: 'playing' | 'finished';
  score: number;
  startedAt: string;
}

export interface StartGameResponse {
  sessionId: string;
  status: string;
  expiresIn: number;
}

export interface SubmitScoreResponse {
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

// --- Tipos do Projeto 3 (RDS) ---

export interface MatchRecord {
  match_id: string;
  player_id: string;
  score: number;
  duration_seconds: number;
  started_at: string;
  finished_at: string;
  is_new_record: boolean;
}

export interface PlayerHistoryResponse {
  matches: MatchRecord[];
  total: number;
  source: string;
}

export interface PlayerStatsData {
  player_id: string;
  username: string;
  best_score: number;
  total_games: number;
  total_wins: number;
  total_losses: number;
  average_score: number;
  total_play_time_seconds: number;
  last_played_at: string | null;
  source: string;
}

export interface PersistentRankingEntry {
  position: number;
  username: string;
  best_score: number;
  total_games: number;
}

export interface PersistentRankingResponse {
  ranking: PersistentRankingEntry[];
  total: number;
  source: string;
  description: string;
}

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
  source: string;
}

export interface DbHealthData {
  services: {
    rds_primary: 'connected' | 'disconnected';
    rds_replica: 'connected' | 'disconnected';
    elasticache: 'connected' | 'disconnected';
  };
  overall: 'healthy' | 'degraded';
  timestamp: string;
}
