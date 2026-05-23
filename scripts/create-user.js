#!/usr/bin/env node

const readline = require('readline');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: credenciais Supabase nao configuradas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const pergunta = (texto) => new Promise((resolve) => {
  rl.question(texto, (resposta) => resolve(resposta));
});

async function criarUsuario() {
  console.log('CRIAR USUARIO PARA MANDATOPRO');
  console.log('A senha nao sera exibida ao final.\n');

  const email = await pergunta('Email: ');
  const senha = await pergunta('Senha forte (minimo 12 caracteres): ');
  const nome = await pergunta('Nome completo: ');
  console.log('\nNivel de acesso:');
  console.log('1. ADMINISTRADOR');
  console.log('2. LIDERANCA');
  console.log('3. OPERADOR');
  const nivelOpcao = await pergunta('Escolha: ');
  rl.close();

  if (!email || !nome || !senha || senha.length < 12) {
    console.error('Email, nome e senha forte sao obrigatorios.');
    process.exit(1);
  }

  const nivelMap = {
    1: 'ADMINISTRADOR',
    2: 'LIDERANCA',
    3: 'OPERADOR'
  };
  const nivel = nivelMap[nivelOpcao] || 'OPERADOR';

  try {
    const { error: authError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
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

    console.log('\nUsuario criado/atualizado com sucesso.');
    console.log(`Email: ${email}`);
    console.log(`Nome: ${nome}`);
    console.log(`Nivel: ${nivel}`);
    console.log('Senha: definida na entrada interativa (nao exibida).');
  } catch (error) {
    console.error('Erro ao criar usuario:', error.message);
    process.exit(1);
  }
}

criarUsuario();
