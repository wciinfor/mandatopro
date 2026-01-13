#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedData() {
  try {
    console.log('🌱 Inserindo dados iniciais...\n');

    // Inserir usuário admin
    console.log('📝 Criando usuário admin...');
    const { data: usuario, error: erroUsuario } = await supabase
      .from('usuarios')
      .insert({
        email: 'admin@mandatopro.com',
        nome: 'Admin Sistema',
        nivel: 'ADMINISTRADOR',
        status: 'ATIVO',
        ativo: true
      })
      .select();

    if (erroUsuario) {
      if (erroUsuario.message.includes('duplicate')) {
        console.log('⏭️  Usuário já existe');
      } else {
        throw erroUsuario;
      }
    } else {
      console.log('✅ Usuário admin criado com sucesso');
    }

    console.log('\n🎉 Dados iniciais inseridos!');
    console.log('\nCredenciais de teste:');
    console.log('📧 Email: admin@mandatopro.com');
    console.log('🔐 Senha: Teste123!');
    console.log('\n✨ Sistema pronto para usar!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

seedData();
