import { createClient } from '@supabase/supabase-js';

let supabase = null;

// Função para obter o cliente Supabase - APENAS BROWSER
export function getSupabaseClient() {
  // Só funciona no browser
  if (typeof window === 'undefined') {
    console.warn('⚠️  getSupabaseClient chamado no servidor');
    return null;
  }

  // Se já foi criado, retorna o existente
  if (supabase) {
    return supabase;
  }

  // Tenta criar novo cliente - lê as variáveis do objeto window
  const supabaseUrl = typeof window !== 'undefined' 
    ? window.__NEXT_DATA__?.props?.pageProps?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_URL;
    
  const supabaseAnonKey = typeof window !== 'undefined'
    ? window.__NEXT_DATA__?.props?.pageProps?.supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fallback: tenta ler diretamente das variáveis de ambiente expostas pelo Next.js
  const url = supabaseUrl || 
    (typeof window !== 'undefined' && globalThis.NEXT_PUBLIC_SUPABASE_URL) || 
    process.env.NEXT_PUBLIC_SUPABASE_URL;
    
  const key = supabaseAnonKey || 
    (typeof window !== 'undefined' && globalThis.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('🔍 Verificando variáveis:');
  console.log('URL:', url ? '✅' : '❌', url?.substring(0, 30) + '...');
  console.log('Key:', key ? '✅' : '❌', key?.substring(0, 30) + '...');

  if (!url || !key) {
    console.warn('⚠️  Supabase não configurado');
    return null;
  }

  try {
    supabase = createClient(url, key, {
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

    console.log('✅ Cliente Supabase criado');
    return supabase;
  } catch (err) {
    console.error('❌ Erro ao criar cliente:', err);
    return null;
  }
}

export default getSupabaseClient;
