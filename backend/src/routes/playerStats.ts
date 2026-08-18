// GET /player/stats - Retorna estatísticas do jogador (via réplica de leitura)

import { APIGatewayProxyEvent } from 'aws-lambda';
import { LambdaResponse } from '../types';
import { databaseService } from '../services/databaseService';
import { buildResponse, buildErrorResponse } from '../utils/response';

export async function handlePlayerStats(event: APIGatewayProxyEvent): Promise<LambdaResponse> {
  const origin = event.headers?.origin || event.headers?.Origin;
  const sub = event.requestContext?.authorizer?.claims?.sub;

  if (!sub) {
    return buildErrorResponse(401, 'Não autorizado', origin);
  }

  try {
    const stats = await databaseService.getPlayerStats(sub);

    if (!stats) {
      return buildResponse(200, {
        player_id: sub,
        username: 'Jogador',
        best_score: 0,
        total_games: 0,
        total_wins: 0,
        total_losses: 0,
        average_score: 0,
        total_play_time_seconds: 0,
        last_played_at: null,
        source: 'replica',
      }, origin);
    }

    return buildResponse(200, {
      ...stats,
      source: 'replica',
    }, origin);
  } catch {
    return buildErrorResponse(503, 'Serviço de banco de dados temporariamente indisponível.', origin);
  }
}
