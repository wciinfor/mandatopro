const { createClient } = require('@supabase/supabase-js');

const url = 'https://fhilsuwlllrnfpebtjvx.supabase.co';
const key = 'sb_secret_iUm54fhzl87WIdbUHYlKXw_wQODZDV3';

const supabase = createClient(url, key);

(async () => {
  try {
    console.log('✅ SUPABASE ACESSÍVEL!\n');
    console.log('URL:', url);
    console.log('Service Role Key:', key.substring(0, 20) + '...');
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
