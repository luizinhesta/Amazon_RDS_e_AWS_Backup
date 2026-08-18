// GET /db/health - Verifica conectividade com RDS e réplica

import { APIGatewayProxyEvent } from 'aws-lambda';
import { LambdaResponse } from '../types';
import { databaseService } from '../services/databaseService';
import { cacheService } from '../services/cacheService';
import { buildResponse } from '../utils/response';

export async function handleDbHealth(event: APIGatewayProxyEvent): Promise<LambdaResponse> {
  const origin = event.headers?.origin || event.headers?.Origin;

  const [writeOk, readOk, cacheOk] = await Promise.all([
    databaseService.pingWrite(),
    databaseService.pingRead(),
    cacheService.ping(),
  ]);

  return buildResponse(200, {
    services: {
      rds_primary: writeOk ? 'connected' : 'disconnected',
      rds_replica: readOk ? 'connected' : 'disconnected',
      elasticache: cacheOk ? 'connected' : 'disconnected',
    },
    overall: writeOk && readOk && cacheOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
  }, origin);
}
