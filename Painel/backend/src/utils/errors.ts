// ──────────────────────────────────────────────────────────────
// HIERARQUIA DE ERROS DA API
//
// Todos os erros conhecidos estendem ApiException.
// O error_handler global captura e formata automaticamente.
// ──────────────────────────────────────────────────────────────

export class ApiException extends Error {
  constructor(
    public readonly code:       string,
    message:                    string,
    public readonly statusCode: number  = 400,
    public readonly details?:   unknown,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

export class UnauthorizedException extends ApiException {
  constructor(message = 'Não autenticado') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenException extends ApiException {
  constructor(message = 'Acesso negado') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundException extends ApiException {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} não encontrado`, 404);
  }
}

export class ConflictException extends ApiException {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class ValidationException extends ApiException {
  constructor(details: unknown) {
    super('VALIDATION_ERROR', 'Dados inválidos na requisição', 422, details);
  }
}

export class RateLimitException extends ApiException {
  constructor() {
    super('RATE_LIMIT_EXCEEDED', 'Limite de requisições atingido', 429);
  }
}

export class ServiceUnavailableException extends ApiException {
  constructor(service: string) {
    super('SERVICE_UNAVAILABLE', `Serviço ${service} indisponível temporariamente`, 503);
  }
}
