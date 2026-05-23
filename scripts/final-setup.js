#!/usr/bin/env node

/**
 * Script final para inserir usuário
 * Usa Supabase RPC ou query direto
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupComplete() {
  console.log('⏳ Aguardando 2 segundos para schema cache atualizar...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('📝 Tentando inserir usuário...');
  
  try {
    // Tenta com um INSERT simples
    const { data, error } = await supabase.from('usuarios').insert({
      email: 'admin@mandatopro.com',
      nome: 'Admin Sistema',
      nivel: 'ADMINISTRADOR',
      status: 'ATIVO',
      ativo: true
    }).select();

    if (error) {
      console.error('Erro:', error.message);
      
      // Se já existe, é OK
      if (error.message.includes('duplicate')) {
        console.log('⚠️  Usuário já existe - não há problema!');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Usuário inserido:', data);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 BANCO DE DADOS PRONTO!\n');
    console.log('Credenciais de Login:');
    console.log('  📧 Email: admin@mandatopro.com');
    console.log('  Senha: configure pelo fluxo seguro de usuarios/Auth');
    console.log('='.repeat(60));

    console.log('\n🚀 PRÓXIMOS PASSOS:\n');
    console.log('1. Inicie o servidor:');
    console.log('   npm run dev\n');
    console.log('2. Abra no navegador:');
    console.log('   http://localhost:3000/login\n');
    console.log('3. Faça login com as credenciais acima\n');
    console.log('✨ Pronto! O sistema está 100% funcional!');

    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    
    console.log('\n⚠️  Alternativa: Execute isto no Supabase Dashboard\n');
    console.log('SQL Editor → New Query → Cole isto:\n');
    console.log(`INSERT INTO usuarios (email, nome, nivel, status, ativo)
VALUES ('admin@mandatopro.com', 'Admin Sistema', 'ADMINISTRADOR', 'ATIVO', true);`);
    
    process.exit(1);
  }
}

setupComplete();
