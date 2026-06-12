import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// ──────────────────────────────────────────────────────────────
// CLIENTES SUPABASE
//
// Regra de uso:
//   supabaseAnon  → operações de auth (login, signup, refresh)
//   supabaseAdmin → operações internas da API (service_role)
//
// NUNCA exponha supabaseAdmin ao frontend.
// Todas as queries da API usam supabaseAdmin — o isolamento
// multi-tenant é garantido pelas políticas RLS + where clauses
// explícitos nos repositories.
// ──────────────────────────────────────────────────────────────

export const supabaseAnon = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
    },
  },
);
