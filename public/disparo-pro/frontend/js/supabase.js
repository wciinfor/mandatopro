/**
 * Mandato Connect - SUPABASE CONFIG
 * Configure as variáveis abaixo com os dados do seu projeto Supabase.
 * Acesse: https://supabase.com/dashboard → Settings → API
 */

const readEnv = (key) => {
    if (typeof getAppEnv === 'function') return getAppEnv(key);
    if (window.APP_ENV && window.APP_ENV[key]) return window.APP_ENV[key];
    console.warn('[env] Missing ' + key);
    return '';
};

const SUPABASE_URL      = readEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = readEnv('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[env] SUPABASE_URL or SUPABASE_ANON_KEY not set');
}

// ========================================
// CLIENTE SUPABASE (inicializado via CDN)
// ========================================
const { createClient } = supabase;

const SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// AdminClient aponta para o mesmo cliente — RLS é resolvido via policies no Supabase
const AdminClient = SupabaseClient;

// Cliente temporário para criar usuários sem sobrescrever a sessão do admin
const TempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-temp-session'
    }
});

console.log('✅ Supabase client inicializado:', SUPABASE_URL);

// Expor globalmente para módulos que dependem de window.SupabaseClient
window.SupabaseClient = SupabaseClient;
window.AdminClient    = AdminClient;
window.TempClient     = TempClient;
