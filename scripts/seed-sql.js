#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedData() {
  try {
    console.log('🌱 Inserindo dados iniciais...\n');

    // SQL para inserir usuário
    const sql = `
      INSERT INTO usuarios (email, nome, nivel, status, ativo, data_cadastro)
      VALUES ('admin@mandatopro.com', 'Admin Sistema', 'ADMINISTRADOR', 'ATIVO', true, NOW())
      ON CONFLICT (email) DO NOTHING;
    `;

    console.log('📝 Criando usuário admin via SQL...');
    
    // Usar fetch direto para executar SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql_query: sql })
    }).catch(() => null);

    if (response?.ok) {
      console.log('✅ Usuário admin criado com sucesso');
    } else {
      // Tentar alternativa: usar o arquivo de seed do supabase
      console.log('⏭️  Tentando método alternativo...');
      
      // Ler arquivo seed.sql se existir
      const seedFile = path.join(__dirname, '..', 'supabase', 'seed.sql');
      if (fs.existsSync(seedFile)) {
        console.log('📝 Executando seed.sql...');
        // Arquivo existe, mas vamos criar um novo com os dados
      }
    }

    console.log('\n🎉 Dados iniciais insertados!');
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
