#!/usr/bin/env node

/**
 * Script para aplicar schema diretamente via PostgreSQL
 * Usa a DATABASE_URL para conectar direto ao banco
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não configurada');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function applySchema() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Conectando ao PostgreSQL...');
    console.log('📍 Banco:', DATABASE_URL.split('@')[1].split('/')[0]);
    console.log('');

    // Ler arquivo de migração
    const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_initial_schema.sql');
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');

    console.log('📝 Executando schema SQL...\n');

    // Executar todo o SQL de uma vez
    await client.query(sqlContent);

    console.log('✅ Schema aplicado com sucesso!');

    // Verificar tabelas criadas
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log(`\n✨ Total de tabelas criadas: ${result.rows.length}\n`);
    
    result.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });

    console.log('\n🎉 Banco de dados pronto!');
    console.log('\nPróximos passos:');
    console.log('1. Inserir usuário: npm run seed-db');
    console.log('2. Iniciar servidor: npm run dev');

  } catch (error) {
    console.error('❌ Erro ao aplicar schema:', error.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

applySchema();
