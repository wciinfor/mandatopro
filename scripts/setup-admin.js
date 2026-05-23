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
    console.log('🔧 Inserindo usuário admin no banco...\n');

    // Dados do usuário
    const novoUsuario = {
      email: 'admin@mandatopro.com',
      nome: 'Admin Sistema',
      nivel: 'ADMINISTRADOR',
      status: 'ATIVO',
      ativo: true,
      data_cadastro: new Date().toISOString()
    };

    // Inserir no banco
    const { data, error } = await supabase
      .from('usuarios')
      .insert([novoUsuario])
      .select();

    if (error) {
      if (error.message.includes('duplicate key')) {
        console.log('ℹ️  Usuário já existe no banco!');
        console.log('\n✅ Tudo pronto para fazer login!');
      } else if (error.message.includes('Could not find the table')) {
        console.log('⚠️  Schema cache desatualizado (normal)');
        console.log('\n📋 Para resolver:');
        console.log('1. Aguarde 5-10 minutos para cache atualizar');
        console.log('2. Execute este script novamente: node scripts/setup-admin.js');
        console.log('3. Ou execute SQL manualmente no Supabase Dashboard:\n');
        console.log('SQL:');
        console.log('INSERT INTO usuarios (email, nome, nivel, status, ativo, data_cadastro)');
        console.log('VALUES (\'admin@mandatopro.com\', \'Admin Sistema\', \'ADMINISTRADOR\', \'ATIVO\', true, NOW());');
      } else {
        console.error('❌ Erro:', error.message);
      }
    } else {
      console.log('✅ USUÁRIO CRIADO COM SUCESSO!\n');
      console.log('📋 Dados inseridos:');
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
})();
