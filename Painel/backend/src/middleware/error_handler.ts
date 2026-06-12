import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ApiException } from '../utils/errors';
import { logger } from '../utils/logger';

// ──────────────────────────────────────────────────────────────
// ERROR HANDLER GLOBAL
//
// Captura todos os erros lançados nas rotas e middlewares.
// Garante que a resposta sempre segue o formato ApiResponse.
//
// Ordem de tratamento:
//   1. ZodError          → 422 VALIDATION_ERROR
//   2. ApiException      → status code da exceção
//   3. Fastify schema    → 422 SCHEMA_VALIDATION_ERROR
//   4. Erro desconhecido → 500 INTERNAL_ERROR
// ──────────────────────────────────────────────────────────────

export async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler(
    (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id as string;
      const meta      = { requestId, timestamp: new Date().toISOString() };

      // ── ZodError ──────────────────────────────────────────
      if (error instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: {
            code:    'VALIDATION_ERROR',
            message: 'Dados inválidos na requisição',
            details: error.flatten().fieldErrors,
          },
          meta,
        });
      }

      // ── ApiException (erros conhecidos) ───────────────────
      if (error instanceof ApiException) {
        if (error.statusCode >= 500) {
          logger.error({ requestId, err: error }, 'Erro interno da API');
        } else {
          logger.warn({ requestId, code: error.code, path: request.url }, error.message);
        }
        return reply.status(error.statusCode).send({
          success: false,
          error: {
            code:    error.code,
            message: error.message,
            ...(error.details !== undefined && { details: error.details }),
          },
          meta,
        });
      }

      // ── Erros de schema do Fastify ─────────────────────────
      if ('validation' in error && (error as FastifyError).validation) {
        return reply.status(422).send({
          success: false,
          error: {
            code:    'SCHEMA_VALIDATION_ERROR',
            message: 'Falha na validação do schema da requisição',
            details: (error as FastifyError).validation,
          },
          meta,
        });
      }

      // ── Erros não mapeados ────────────────────────────────
      logger.error({ requestId, url: request.url, err: error }, 'Erro inesperado não tratado');
      return reply.status(500).send({
        success: false,
        error: {
          code:    'INTERNAL_ERROR',
          message: 'Erro interno do servidor',
        },
        meta,
      });
    },
  );
}
