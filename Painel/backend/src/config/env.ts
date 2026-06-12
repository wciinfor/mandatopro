import 'dotenv/config';
import { z } from 'zod';

// ──────────────────────────────────────────────────────────────
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
// Falha imediata com mensagem clara se alguma variável estiver ausente.
// ──────────────────────────────────────────────────────────────

const envSchema = z.object({
  // Servidor
  PORT:     z.coerce.number().default(3001),
  HOST:     z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase
  SUPABASE_URL:              z.string().url(),
  SUPABASE_ANON_KEY:         z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET:       z.string().min(1),

  // Evolution API
  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),

  // N8N (usado durante migração gradual — opcional; sem N8N os triggers são no-ops)
  N8N_WEBHOOK_BASE_URL: z.string().url().optional(),
  N8N_API_KEY:          z.string().min(1).optional(),

  // OpenAI (IA Assistiva — Fase 5)
  OPENAI_API_KEY:   z.string().min(1).optional(),
  OPENAI_MODEL:     z.string().default('gpt-4o-mini'),

  // Redis (BullMQ)
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // CORS / Rate Limit
  CORS_ORIGIN:          z.string().default('*'),
  RATE_LIMIT_MAX:       z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),

  // ── Fase 7: Resiliência ──────────────────────────────────────
  // Circuit breaker — número de falhas consecutivas para abrir o circuito
  CB_FAILURE_THRESHOLD: z.coerce.number().default(5),
  // Tempo em ms para tentar fechar o circuito após abrir (default 30s)
  CB_RECOVERY_TIMEOUT_MS: z.coerce.number().default(30_000),
  // Timeout global para chamadas HTTP externas (Evolution, OpenAI) em ms
  REQUEST_TIMEOUT_MS: z.coerce.number().default(15_000),

  // ── Fase 7: Rate limit por workspace ─────────────────────────
  // Limite de requests por workspace por janela de tempo
  WORKSPACE_RATE_LIMIT_MAX:       z.coerce.number().default(300),
  WORKSPACE_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),

  // ── Fase 7: Webhook flood protection ─────────────────────────
  WEBHOOK_RATE_LIMIT_MAX:       z.coerce.number().default(500),
  WEBHOOK_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),

  // ── Fase 7: Métricas ─────────────────────────────────────────
  // Token Bearer para o endpoint /metrics (opcional; sem token = aberto)
  METRICS_TOKEN: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n[ENV] ❌  Variáveis de ambiente inválidas ou ausentes:\n');
  const errors = parsed.error.flatten().fieldErrors;
  for (const [key, msgs] of Object.entries(errors)) {
    console.error(`  ${key}: ${msgs?.join(', ')}`);
  }
  console.error('\nCopie backend/.env.example para backend/.env e preencha os valores.\n');
  process.exit(1);
}

export const env = parsed.data;
export type Env  = z.infer<typeof envSchema>;
