// GET /player/history - Retorna histórico de partidas (via réplica de leitura)

import { APIGatewayProxyEvent } from 'aws-lambda';
import { LambdaResponse } from '../types';
import { databaseService } from '../services/databaseService';
import { buildResponse, buildErrorResponse } from '../utils/response';

export async function handlePlayerHistory(event: APIGatewayProxyEvent): Promise<LambdaResponse> {
  const origin = event.headers?.origin || event.headers?.Origin;
  const sub = event.requestContext?.authorizer?.claims?.sub;

  if (!sub) {
    return buildErrorResponse(401, 'Não autorizado', origin);
  }

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    const history = await databaseService.getPlayerHistory(sub, safeLimit);

    return buildResponse(200, {
      matches: history,
      total: history.length,
      source: 'replica',
    }, origin);
  } catch {
    return buildErrorResponse(503, 'Serviço de banco de dados temporariamente indisponível.', origin);
  }
}
