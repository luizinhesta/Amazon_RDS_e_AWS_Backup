// GET /ranking/persistent - Ranking consolidado do banco de dados (via réplica)

import { APIGatewayProxyEvent } from 'aws-lambda';
import { LambdaResponse } from '../types';
import { databaseService } from '../services/databaseService';
import { buildResponse, buildErrorResponse } from '../utils/response';

export async function handleRankingPersistent(event: APIGatewayProxyEvent): Promise<LambdaResponse> {
  const origin = event.headers?.origin || event.headers?.Origin;

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '10', 10);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const ranking = await databaseService.getRankingFromReplica(safeLimit);

    return buildResponse(200, {
      ranking,
      total: ranking.length,
      source: 'replica',
      description: 'Ranking consolidado do banco de dados (pode ter pequena defasagem)',
    }, origin);
  } catch {
    return buildErrorResponse(503, 'Serviço de banco de dados temporariamente indisponível.', origin);
  }
}
