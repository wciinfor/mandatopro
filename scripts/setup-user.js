#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  const email = 'admin@mandatopro.com';
  const nome = 'Admin Sistema';
  const nivel = 'ADMINISTRADOR';

  try {
    console.log('📝 Criando usuário no banco de dados...');
    
    // Inserir usuário
    const { data, error } = await supabase
      .from('usuarios')
      .insert([{
        email: email,
        nome: nome,
        nivel: nivel,
        status: 'ATIVO',
        ativo: true
      }])
      .select();

    if (error) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 USUÁRIO CRIADO COM SUCESSO!\n');
    console.log('Credenciais para Login:');
    console.log(`  📧 Email: ${email}`);
    console.log(`  🔑 Senha: configure pelo fluxo seguro de usuarios/Auth`);
    console.log(`  👤 Nome: ${nome}`);
    console.log(`  🔐 Nível: ${nivel}`);
    console.log('='.repeat(60));
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
})();
