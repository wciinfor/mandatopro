#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testUserPassword = process.env.TEST_USER_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: credenciais Supabase nao configuradas.');
  process.exit(1);
}

if (!testUserPassword || testUserPassword.length < 12) {
  console.error('Defina TEST_USER_PASSWORD com pelo menos 12 caracteres.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function criarUsuarioTeste() {
  const email = process.env.TEST_USER_EMAIL || 'admin@mandatopro.com';
  const nome = process.env.TEST_USER_NAME || 'Admin Sistema';
  const nivel = process.env.TEST_USER_ROLE || 'ADMINISTRADOR';

  console.log('Criando usuario de teste...');

  try {
    const { error: authError } = await supabase.auth.admin.createUser({
      email,
      password: testUserPassword,
      email_confirm: true
    });

    if (authError && !authError.message.includes('already exists')) {
      throw authError;
    }

    const { error: dbError } = await supabase
      .from('usuarios')
      .upsert({
        email,
        nome,
        nivel,
        status: 'ATIVO',
        ativo: true
      }, { onConflict: 'email' });

    if (dbError) {
      throw dbError;
    }

    console.log('Usuario de teste criado/atualizado com sucesso.');
    console.log(`Email: ${email}`);
    console.log('Senha: definida em TEST_USER_PASSWORD (nao exibida).');
  } catch (error) {
    console.error('Erro ao criar usuario de teste:', error.message);
    process.exit(1);
  }
}

criarUsuarioTeste();
