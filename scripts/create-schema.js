#!/usr/bin/env node

/**
 * Script para executar SQL diretamente no Supabase via API
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

async function executeSql(sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ query: sql })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Erro:', data);
    throw new Error(data.message || 'Erro ao executar SQL');
  }
  
  return data;
}

async function applySchema() {
  try {
    console.log('🚀 Criando schema no Supabase...\n');

    // Ler arquivo de migração
    const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_initial_schema.sql');
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');

    // Extrair apenas os CREATE TABLE
    const tableRegex = /CREATE TABLE IF NOT EXISTS \w+ \([\s\S]*?\);/g;
    const createTableStatements = sqlContent.match(tableRegex) || [];

    console.log(`📝 Encontrados ${createTableStatements.length} CREATE TABLE\n`);

    for (let i = 0; i < createTableStatements.length; i++) {
      const sql = createTableStatements[i];
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
      
      try {
        await executeSql(sql);
        console.log(`✅ [${i + 1}/${createTableStatements.length}] Tabela "${tableName}" criada`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⏭️  [${i + 1}/${createTableStatements.length}] Tabela "${tableName}" já existe`);
        } else {
          console.log(`⚠️  [${i + 1}/${createTableStatements.length}] Erro em "${tableName}": ${error.message.substring(0, 50)}`);
        }
      }
    }

    console.log('\n✨ Schema criado com sucesso!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

applySchema();
