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

  console.log('🔍 Verificando variáveis de ambiente:');
  console.log('URL:', supabaseUrl ? '✅' : '❌');
  console.log('Key:', supabaseAnonKey ? '✅' : '❌');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️  Supabase não configurado');
    return null;
  }

  try {
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

    console.log('✅ Cliente Supabase criado com sucesso');
    return supabase;
  } catch (err) {
    console.error('❌ Erro ao criar cliente Supabase:', err);
    return null;
  }
}

// Export default para compatibilidade
export default getSupabaseClient;
