import { createBrowserClient } from '@supabase/ssr';

let supabase = null;
let restrictedSupabase = null;

const BLOCKED_BROWSER_MEMBERS = new Set(['from', 'rpc', 'storage', 'functions']);

function criarClienteRestrito(client) {
  return new Proxy(client, {
    get(target, prop) {
      if (BLOCKED_BROWSER_MEMBERS.has(prop)) {
        throw new Error('Acesso direto ao Supabase bloqueado no navegador. Use uma rota /api autenticada.');
      }

      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

// Cliente Supabase para o navegador
// Usa ANON_KEY (seguro, expõe só leitura/escrita com RLS)
export function createClient() {
  if (typeof window === 'undefined') {
    return null;
  }

  const globalSupabase = globalThis.__mandatoProSupabase;
  if (globalSupabase) {
    restrictedSupabase = globalSupabase;
    return restrictedSupabase;
  }

  if (restrictedSupabase) {
    return restrictedSupabase;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️  Supabase não configurado');
    return null;
  }

  supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
  restrictedSupabase = criarClienteRestrito(supabase);
  globalThis.__mandatoProSupabase = restrictedSupabase;

  return restrictedSupabase;
}

function getClientOrThrow() {
  const client = createClient();

  if (!client) {
    throw new Error('Supabase nao esta configurado. Verifique as variaveis de ambiente.');
  }

  return client;
}

const supabaseProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getClientOrThrow();
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    }
  }
);

export default supabaseProxy;
