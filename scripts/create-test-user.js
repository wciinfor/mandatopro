#!/usr/bin/env node

/**
 * Script para criar usuário de teste do MandatoPro
 * Não-interativo (usa valores padrão)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Credenciais Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function criarUsuarioTeste() {
  const email = 'admin@mandatopro.com';
  const senha = 'Teste123!';
  const nome = 'Admin Sistema';
  const nivel = 'ADMINISTRADOR';

  console.log('👤 Criando usuário de teste...\n');

  try {
    // 1. Criar usuário no Supabase Auth (ou ignorar se já existe)
    console.log('📝 Verificando conta no Supabase Auth...');
    
    const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true
    });

    if (authError) {
      if (authError.message.includes('already exists')) {
        console.log('✅ Usuário já existe no Auth (usando existente)');
      } else {
        throw authError;
      }
    } else {
      console.log(`✅ Usuário criado no Auth: ${email}`);
    }

    // 2. Criar/Atualizar registro no banco de dados
    console.log('📝 Criando registro no banco de dados...');
    
    // Tentar inserir usuário
    const { data, error: dbError } = await supabase
      .from('usuarios')
      .insert([{
        email: email,
        nome: nome,
        nivel: nivel,
        status: 'ATIVO',
        ativo: true
      }])
      .select();

    if (dbError) {
      if (dbError.message.includes('duplicate') || dbError.message.includes('Unique')) {
        console.log('⚠️  Usuário já existe no banco, atualizando...');
        
        // Atualizar existente
        await supabase
          .from('usuarios')
          .update({
            nome: nome,
            nivel: nivel,
            status: 'ATIVO',
            ativo: true
          })
          .eq('email', email);
        
        console.log(`✅ Usuário atualizado no banco de dados`);
      } else {
        throw dbError;
      }
    } else {
      console.log(`✅ Usuário criado no banco de dados`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 USUÁRIO CRIADO COM SUCESSO!\n');
    console.log('Credenciais para Login:');
    console.log(`  📧 Email: ${email}`);
    console.log(`  🔑 Senha: ${senha}`);
    console.log(`  👤 Nome: ${nome}`);
    console.log(`  🔐 Nível: ${nivel}`);
    console.log('='.repeat(60));

    console.log('\n✨ Próximos passos:');
    console.log('1. Substituir AuthContext:');
    console.log('   cp src/contexts/AuthContext_novo.js src/contexts/AuthContext.js');
    console.log('\n2. Iniciar servidor:');
    console.log('   npm run dev');
    console.log('\n3. Acessar:');
    console.log('   http://localhost:3000/login');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erro ao criar usuário:', error.message);
    process.exit(1);
  }
}

criarUsuarioTeste();
