#!/usr/bin/env node

/**
 * Script para criar schema via PostgreSQL direto
 * Usando biblioteca pg que já está instalada
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}

async function executeSchema() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Para Supabase
  });

  try {
    console.log('🔌 Conectando ao PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado!\n');

    // Ler arquivo de migração
    const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_initial_schema.sql');
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');

    console.log('🚀 Executando schema...\n');

    // Executar o SQL completo
    await client.query(sqlContent);

    console.log('✅ Schema executado com sucesso!\n');

    // Verificar tabelas criadas
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`📊 Tabelas criadas: ${result.rows.length}\n`);
    result.rows.forEach((row, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${row.table_name}`);
    });

    console.log('\n✨ Banco de dados pronto!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeSchema();
