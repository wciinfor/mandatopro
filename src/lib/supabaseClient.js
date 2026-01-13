import { createClient } from '@supabase/supabase-js';

let supabase = null;

// Função para obter o cliente Supabase
export function getSupabaseClient() {
  // Se já foi criado, retorna o existente
  if (supabase) {
    return supabase;
  }

  // Tenta criar novo cliente
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️  Supabase URL ou Anon Key não configurados');
    return null;
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return supabase;
}

// Export default para compatibilidade
export default getSupabaseClient;
