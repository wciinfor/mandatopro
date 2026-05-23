#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: variaveis Supabase nao configuradas.');
  process.exit(1);
}

if (!adminPassword || adminPassword.length < 12) {
  console.error('Defina SEED_ADMIN_PASSWORD com pelo menos 12 caracteres.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedData() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@mandatopro.com';

  try {
    console.log('Inserindo dados iniciais...');

    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingAdmin = existingUsers?.users?.find((user) => user.email === adminEmail);

    let authUserId = existingAdmin?.id || null;

    if (!existingAdmin) {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true
      });

      if (authError) {
        throw authError;
      }

      authUserId = authUser?.user?.id || null;
    }

    const { error: usuarioError } = await supabase
      .from('usuarios')
      .upsert({
        auth_user_id: authUserId,
        email: adminEmail,
        nome: 'Admin Sistema',
        nivel: 'ADMINISTRADOR',
        status: 'ATIVO',
        ativo: true
      }, { onConflict: 'email' });

    if (usuarioError) {
      throw usuarioError;
    }

    console.log('Seed concluido.');
    console.log(`Admin: ${adminEmail}`);
    console.log('Senha: definida em SEED_ADMIN_PASSWORD (nao exibida).');
  } catch (error) {
    console.error('Erro no seed:', error.message);
    process.exit(1);
  }
}

seedData();
