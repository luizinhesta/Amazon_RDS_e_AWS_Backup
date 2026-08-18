import { apiService } from './apiService';
import {
  PlayerHistoryResponse,
  PlayerStatsData,
  PersistentRankingResponse,
  MatchRecordRequest,
  MatchRecordResponse,
  DbHealthData,
} from '../types';

export const playerService = {
  getHistory: (limit?: number) =>
    apiService.get<PlayerHistoryResponse>(`/player/history${limit ? `?limit=${limit}` : ''}`),

  getStats: () =>
    apiService.get<PlayerStatsData>('/player/stats'),

  getPersistentRanking: (limit?: number) =>
    apiService.get<PersistentRankingResponse>(`/ranking/persistent${limit ? `?limit=${limit}` : ''}`),

  recordMatch: (data: MatchRecordRequest) =>
    apiService.post<MatchRecordResponse>('/match/record', data),

  getDbHealth: () =>
    apiService.get<DbHealthData>('/db/health'),
};
