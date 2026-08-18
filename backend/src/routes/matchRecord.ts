// POST /match/record - Registra partida finalizada no banco permanente (via RDS Proxy)

import { APIGatewayProxyEvent } from 'aws-lambda';
import { LambdaResponse } from '../types';
import { databaseService } from '../services/databaseService';
import { buildResponse, buildErrorResponse } from '../utils/response';

export async function handleMatchRecord(event: APIGatewayProxyEvent): Promise<LambdaResponse> {
  const origin = event.headers?.origin || event.headers?.Origin;
  const sub = event.requestContext?.authorizer?.claims?.sub;
  const username = event.requestContext?.authorizer?.claims?.preferred_username ||
                   event.requestContext?.authorizer?.claims?.name || 'Jogador';
  const email = event.requestContext?.authorizer?.claims?.email || '';

  if (!sub) {
    return buildErrorResponse(401, 'Não autorizado', origin);
  }

  // Validar body
  let body: { score?: unknown; durationSeconds?: unknown; isNewRecord?: unknown };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return buildErrorResponse(400, 'Dados inválidos', origin);
  }

  const score = body.score;
  const durationSeconds = body.durationSeconds;
  const isNewRecord = body.isNewRecord;

  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score >= 1_000_000) {
    return buildErrorResponse(400, 'Pontuação inválida', origin);
  }

  if (typeof durationSeconds !== 'number' || durationSeconds < 0 || durationSeconds > 86400) {
    return buildErrorResponse(400, 'Duração inválida', origin);
  }

  if (typeof isNewRecord !== 'boolean') {
    return buildErrorResponse(400, 'Campo isNewRecord é obrigatório', origin);
  }

  try {
    // Garantir que o jogador existe no banco
    await databaseService.upsertPlayer(sub, username, email);

    // Registrar a partida
    const match = await databaseService.recordMatch(sub, score, Math.floor(durationSeconds), isNewRecord);

    return buildResponse(201, {
      recorded: true,
      matchId: match.match_id,
      score: match.score,
      durationSeconds: match.duration_seconds,
      isNewRecord: match.is_new_record,
      source: 'primary',
    }, origin);
  } catch {
    return buildErrorResponse(503, 'Serviço de banco de dados temporariamente indisponível.', origin);
  }
}
