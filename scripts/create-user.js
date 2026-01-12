#!/usr/bin/env node

/**
 * Script para criar usuário de teste automaticamente
 * Cria usuário no Supabase Auth E no banco de dados
 */

const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Credenciais Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const pergunta = (texto) => {
  return new Promise((resolve) => {
    rl.question(texto, (resposta) => {
      resolve(resposta);
    });
  });
};

async function criarUsuario() {
  console.log('👤 CRIAR USUÁRIO PARA MANDATOPRO\n');
  console.log('Deixe em branco para usar valores padrão\n');

  const email = await pergunta('Email (padrão: admin@mandatopro.com): ') || 'admin@mandatopro.com';
  const senha = await pergunta('Senha (padrão: Teste123!): ') || 'Teste123!';
  const nome = await pergunta('Nome completo (padrão: Admin Sistema): ') || 'Admin Sistema';
  
  console.log('\nNível de acesso:');
  console.log('1. ADMINISTRADOR (acesso total)');
  console.log('2. LIDERANCA (acesso a lideranças)');
  console.log('3. OPERADOR (acesso básico)');
  const nivelOpcao = await pergunta('Escolha (padrão: 1): ') || '1';
  
  const nivelMap = {
    '1': 'ADMINISTRADOR',
    '2': 'LIDERANCA',
    '3': 'OPERADOR'
  };
  
  const nivel = nivelMap[nivelOpcao] || 'ADMINISTRADOR';

  rl.close();

  console.log('\n⏳ Criando usuário...\n');

  try {
    // 1. Criar usuário no Supabase Auth
    console.log('📝 Criando conta no Supabase Auth...');
    
    const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true
    });

    if (authError) {
      console.error('❌ Erro ao criar usuário no Auth:', authError.message);
      
      // Se erro de email já existente, continuar
      if (authError.message.includes('already exists')) {
        console.log('⚠️  Usuário já existe no Auth, continuando...');
      } else {
        process.exit(1);
      }
    } else {
      console.log(`✅ Usuário criado no Auth: ${email}`);
    }

    // 2. Criar registro no banco de dados
    console.log('📝 Criando registro no banco de dados...');
    
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
      console.error('❌ Erro ao criar usuário no banco:', dbError.message);
      process.exit(1);
    }

    console.log(`✅ Usuário criado no banco de dados`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 USUÁRIO CRIADO COM SUCESSO!\n');
    console.log('Credenciais:');
    console.log(`  📧 Email: ${email}`);
    console.log(`  🔑 Senha: ${senha}`);
    console.log(`  👤 Nome: ${nome}`);
    console.log(`  🔐 Nível: ${nivel}`);
    console.log('='.repeat(60));

    console.log('\n✨ Você pode fazer login agora!');
    console.log(`npm run dev`);
    console.log(`→ http://localhost:3000/login`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erro inesperado:', error);
    process.exit(1);
  }
}

criarUsuario();
