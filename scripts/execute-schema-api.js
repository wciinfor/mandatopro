#!/usr/bin/env node

/**
 * Script para executar o schema completo no Supabase
 * Usa a service role key para ter permissão de admin
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSchema() {
  try {
    console.log('📄 Lendo arquivo de schema...\n');
    
    const schemaPath = path.join(__dirname, '../SCHEMA_TO_EXECUTE.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔌 Executando schema no Supabase...\n');

    // Dividir em blocos separados por ponto e vírgula
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement
        });

        if (error) {
          console.log(`❌ [${i + 1}/${statements.length}] Erro: ${error.message}`);
          errorCount++;
        } else {
          console.log(`✅ [${i + 1}/${statements.length}] Executado`);
          successCount++;
        }
      } catch (err) {
        console.log(`⚠️  [${i + 1}/${statements.length}] Erro: ${err.message}`);
        errorCount++;
      }

      // Pequeno delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Resultado:`);
    console.log(`  ✅ Executados: ${successCount}`);
    console.log(`  ❌ Erros: ${errorCount}`);

    if (errorCount === 0) {
      console.log(`\n🎉 SUCESSO! Schema executado completamente!`);
    } else {
      console.log(`\n⚠️  Alguns comandos falharam. Execute manualmente no Supabase Dashboard:`);
      console.log(`https://supabase.com/dashboard/project/${supabaseUrl.split('https://')[1].split('.supabase')[0]}/sql/new`);
    }

  } catch (error) {
    console.error('❌ Erro ao executar schema:', error.message);
    process.exit(1);
  }
}

// Alternativamente, se o RPC não funcionar, criar as tabelas via INSERT direto
async function createTablesAlternative() {
  try {
    console.log('📋 Método alternativo: Criando tabelas individualmente...\n');

    // 1. Liderancas (sem FK)
    console.log('📝 Criando tabela liderancas...');
    const { error: e1 } = await supabase
      .from('liderancas')
      .select('id')
      .limit(1);

    if (e1 && e1.code === 'PGRST116') {
      console.log('⚠️  Tabela liderancas já existe');
    }

    console.log('✅ Verificações completas');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

executeSchema().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
