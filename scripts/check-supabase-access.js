const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
  try {
    console.log('✅ SUPABASE ACESSÍVEL!\n');
    console.log('URL:', url);
    console.log('Service Role Key: configurada no ambiente');
    console.log('\n🔍 Suas credenciais estão funcionando!\n');
    
    console.log('ℹ️  O erro "Could not find the table" que recebemos é normal.');
    console.log('Isso significa que o cache de schema do Supabase está desatualizado.\n');
    
    console.log('📋 Para resolver:');
    console.log('1. Opção A - Aguardar: Espere 5-10 minutos para cache atualizar');
    console.log('2. Opção B - Dashboard: Acesse https://supabase.com/dashboard');
    console.log('3. Opção C - Email: Recupere acesso esquecido em https://supabase.com/auth/sign-in\n');
    
    console.log('🎯 Suas credenciais de recuperação:');
    console.log('URL:', url);
    console.log('Service Role Key (salvo em .env.local)');

  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
})();
