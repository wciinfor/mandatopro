#!/usr/bin/env node

/**
 * Script para inserir dados iniciais no banco
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedData() {
  try {
    console.log('🌱 Inserindo dados iniciais...\n');

    // Inserir usuário admin
    console.log('📝 Criando usuário admin...');
    const { data: usuario, error: erroUsuario } = await supabase
      .from('usuarios')
      .upsert({
        email: 'admin@mandatopro.com',
        nome: 'Admin Sistema',
        nivel: 'ADMINISTRADOR',
        status: 'ATIVO',
        ativo: true
      }, { onConflict: 'email' })
      .select();

    if (erroUsuario) {
      console.log(`⚠️  ${erroUsuario.message}`);
    } else {
      console.log('✅ Usuário admin criado com sucesso');
    }

    // Inserir lideranças de exemplo
    console.log('\n📝 Criando lideranças de exemplo...');
    const { data: liderancas, error: erroLiderancas } = await supabase
      .from('liderancas')
      .insert([
        {
          nome: 'João Silva',
          email: 'joao@example.com',
          telefone: '(91) 99999-9999',
          influencia: 'ALTA',
          area_atuacao: 'Centro',
          status: 'ATIVO'
        },
        {
          nome: 'Maria Santos',
          email: 'maria@example.com',
          telefone: '(91) 88888-8888',
          influencia: 'MÉDIA',
          area_atuacao: 'Norte',
          status: 'ATIVO'
        }
      ])
      .select();

    if (erroLiderancas) {
      console.log(`⚠️  ${erroLiderancas.message}`);
    } else {
      console.log(`✅ ${liderancas?.length || 0} lideranças criadas`);
    }

    console.log('\n✨ Dados iniciais inseridos!');
    console.log('\n📊 Credenciais de teste:');
    console.log('📧 Email: admin@mandatopro.com');
    console.log('🔐 Senha: Teste123!');
    console.log('\n🎉 Sistema pronto para usar!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

seedData();
