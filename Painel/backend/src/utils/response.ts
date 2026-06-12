import { FastifyReply } from 'fastify';
import { ApiResponse, PaginationMeta } from '../types/api.types';

// ──────────────────────────────────────────────────────────────
// HELPERS DE RESPOSTA PADRONIZADA
//
// Formato garantido em todas as respostas:
//   { success, data?, error?, meta: { requestId, timestamp, pagination? } }
// ──────────────────────────────────────────────────────────────

function buildMeta(reply: FastifyReply, pagination?: PaginationMeta) {
  return {
    requestId:  reply.request.id as string,
    timestamp:  new Date().toISOString(),
    ...(pagination && { pagination }),
  };
}

export function sendOk<T>(
  reply: FastifyReply,
  data:  T,
  options?: { pagination?: PaginationMeta; statusCode?: number },
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: buildMeta(reply, options?.pagination),
  };
  reply.status(options?.statusCode ?? 200).send(response);
}

export function sendCreated<T>(reply: FastifyReply, data: T): void {
  sendOk(reply, data, { statusCode: 201 });
}

export function sendNoContent(reply: FastifyReply): void {
  reply.status(204).send();
}

export function sendError(
  reply:      FastifyReply,
  code:       string,
  message:    string,
  statusCode = 400,
  details?:   unknown,
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
    meta: buildMeta(reply),
  };
  reply.status(statusCode).send(response);
}
