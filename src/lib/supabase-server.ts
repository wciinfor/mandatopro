import { createClient } from '@supabase/supabase-js';

// Cliente Supabase para o servidor (API Routes)
// Usa SERVICE_ROLE_KEY (admin, pode fazer qualquer coisa)
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('❌ Variáveis Supabase não configuradas no servidor');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Cria cliente do servidor a partir de um token JWT (para validar usuários)
export function createServerClientFromToken(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('❌ Variáveis Supabase não configuradas');
  }

  const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Seta o token para essa sessão
  if (client.auth && typeof client.auth.setSession === 'function') {
    try {
      client.auth.setSession({
        access_token: token,
        refresh_token: '',
      } as any);
    } catch (err) {
      console.warn('⚠️  Erro ao setar sessão:', err);
    }
  }

  return client;
}

export default createServerClient;
