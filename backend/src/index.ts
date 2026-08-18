import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handleHealth } from './routes/health';
import { handleMe } from './routes/me';
import { handleGameStatus } from './routes/gameStatus';
import { handleGameStart } from './routes/gameStart';
import { handleGameScore } from './routes/gameScore';
import { handleGameRanking } from './routes/gameRanking';
import { handleGameMe } from './routes/gameMe';
import { handlePlayerHistory } from './routes/playerHistory';
import { handlePlayerStats } from './routes/playerStats';
import { handleRankingPersistent } from './routes/rankingPersistent';
import { handleMatchRecord } from './routes/matchRecord';
import { handleDbHealth } from './routes/dbHealth';
import { buildErrorResponse } from './utils/response';
import { getCorsHeaders } from './utils/cors';
import { logError } from './utils/logger';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const origin = event.headers?.origin || event.headers?.Origin;

  try {
    const { httpMethod, path } = event;

    // Handle OPTIONS preflight
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin),
        },
        body: '',
      };
    }

    // Route based on method + path
    if (httpMethod === 'GET') {
      switch (path) {
        case '/health':
          return handleHealth(event);
        case '/me':
          return handleMe(event);
        case '/game/status':
          return await handleGameStatus(event);
        case '/game/ranking':
          return await handleGameRanking(event);
        case '/game/me':
          return await handleGameMe(event);
        // Projeto 3 - RDS routes
        case '/player/history':
          return await handlePlayerHistory(event);
        case '/player/stats':
          return await handlePlayerStats(event);
        case '/ranking/persistent':
          return await handleRankingPersistent(event);
        case '/db/health':
          return await handleDbHealth(event);
      }
    }

    if (httpMethod === 'POST') {
      switch (path) {
        case '/game/start':
          return await handleGameStart(event);
        case '/game/score':
          return await handleGameScore(event);
        // Projeto 3 - RDS routes
        case '/match/record':
          return await handleMatchRecord(event);
      }
    }

    // 404 for unmatched routes
    return buildErrorResponse(404, 'Rota não encontrada', origin);
  } catch (error: unknown) {
    // Secure logging - no stack traces, no sensitive data
    logError('Unhandled error', {
      path: event.path,
      method: event.httpMethod,
      errorType: (error as Error)?.name ?? 'Unknown',
    });

    return buildErrorResponse(500, 'Erro interno do servidor', origin);
  }
};
