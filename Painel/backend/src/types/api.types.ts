// ──────────────────────────────────────────────────────────────
// TIPOS CENTRAIS DA API
// Todos os módulos devem usar estes tipos para garantir
// consistência no formato de resposta e no contexto de acesso.
// ──────────────────────────────────────────────────────────────

// ── Formato padrão de resposta ─────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?:   T;
  error?:  ApiError;
  meta:    ResponseMeta;
}

export interface ApiError {
  code:     string;
  message:  string;
  details?: unknown;
}

export interface ResponseMeta {
  requestId:   string;
  timestamp:   string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
}

// ── Contexto de workspace ──────────────────────────────────────
// Injetado pelo middleware de auth + workspace em cada requisição autenticada.

export interface WorkspaceContext {
  workspaceId: string;
  userId:      string;
  role:        WorkspaceRole;
  email?:      string;
  name?:       string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'agent' | 'operator';

// ── Hierarquia de papéis ──────────────────────────────────────
// Quanto maior o número, maior o nível de acesso.

export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner:    4,
  admin:    3,
  agent:    2,
  operator: 1,
};

// ── Query helpers ─────────────────────────────────────────────

export interface PaginationQuery {
  page?:  number;
  limit?: number;
}

export interface WorkspaceParams {
  workspaceId: string;
}
