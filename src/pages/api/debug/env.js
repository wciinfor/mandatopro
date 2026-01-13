export default function handler(req, res) {
  console.log('[DEBUG] Variáveis de ambiente no Vercel:');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[DEBUG] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.log('[DEBUG] NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌');
  console.log('[DEBUG] SUPABASE_SERVICE_ROLE_KEY:', serviceRole ? '✅' : '❌');

  return res.status(200).json({
    environment: process.env.NODE_ENV,
    supabaseUrl: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT_FOUND',
    supabaseKey: supabaseKey ? supabaseKey.substring(0, 30) + '...' : 'NOT_FOUND',
    serviceRole: serviceRole ? serviceRole.substring(0, 30) + '...' : 'NOT_FOUND',
    allEnvVars: Object.keys(process.env)
      .filter(k => k.includes('SUPABASE') || k.includes('NEXT_PUBLIC'))
      .reduce((obj, key) => {
        obj[key] = process.env[key] ? 'SET' : 'MISSING';
        return obj;
      }, {})
  });
}
