import { createBrowserClient } from '@supabase/ssr';

let supabase = null;

// Cliente Supabase para o navegador
// Usa ANON_KEY (seguro, expõe só leitura/escrita com RLS)
export function createClient() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (supabase) {
    return supabase;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️  Supabase não configurado');
    return null;
  }

  supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

  return supabase;
}

export default createClient;
