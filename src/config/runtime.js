// Este arquivo é gerado durante o build e contém as variáveis de ambiente
// Será usado pelas API Routes em runtime

const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  googleMaps: {
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  },
};

// Log durante o build
if (process.env.NODE_ENV === 'production') {
  console.log('[BUILD TIME] Config gerado:');
  console.log('[BUILD TIME] Supabase URL:', config.supabase.url ? '✅' : '❌');
  console.log('[BUILD TIME] Supabase Key:', config.supabase.anonKey ? '✅' : '❌');
}

module.exports = config;
