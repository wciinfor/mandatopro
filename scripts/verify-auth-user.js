#!/usr/bin/env node

/**
 * Script para verificar se usuário existe no Supabase Auth
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

async function verifyUser() {
  try {
    console.log('🔍 Verificando usuários no Supabase Auth...\n');

    // Listar todos os usuários
    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }

    if (!users || users.users.length === 0) {
      console.log('❌ Nenhum usuário encontrado no Auth');
      process.exit(1);
    }

    console.log(`✅ Total de usuários: ${users.users.length}\n`);

    users.users.forEach(user => {
      console.log('📧 Email:', user.email);
      console.log('   ID:', user.id);
      console.log('   Confirmado:', user.email_confirmed_at ? '✅ Sim' : '❌ Não');
      console.log('   Criado em:', new Date(user.created_at).toLocaleString('pt-BR'));
      console.log('   ---');
    });

    // Testar login
    const loginEmail = process.env.VERIFY_AUTH_EMAIL;
    const loginPassword = process.env.VERIFY_AUTH_PASSWORD;

    if (!loginEmail || !loginPassword) {
      console.log('\nℹ️ Teste de login ignorado. Para testar, defina:');
      console.log('   VERIFY_AUTH_EMAIL e VERIFY_AUTH_PASSWORD');
      process.exit(0);
    }

    console.log(`\n🔐 Testando login com ${loginEmail}...`);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword
    });

    if (loginError) {
      console.error('❌ Erro ao fazer login:', loginError.message);
      process.exit(1);
    }

    if (data?.user) {
      console.log('✅ Login com sucesso!');
      console.log('   Email:', data.user.email);
      console.log('   ID:', data.user.id);
      console.log('   Token JWT válido: ✅');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

verifyUser();
