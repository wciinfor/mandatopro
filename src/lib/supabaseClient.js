import { createClient } from '@supabase/supabase-js';

let supabase = null;

// Criar cliente Supabase dinamicamente quando needed (runtime)
function getSupabaseClient() {
  if (typeof window === 'undefined') {
    // Server-side: retorna null
    return null;
  }

  // Client-side: cria o cliente se ainda não existe
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
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
    }
  }

  return supabase;
}

// Export a função para obter o cliente
export function useSupabase() {
  return getSupabaseClient();
}

// Export default para compatibilidade com imports existentes
export default getSupabaseClient;
