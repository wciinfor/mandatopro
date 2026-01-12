#!/usr/bin/env node

/**
 * Script para aplicar migrações do banco de dados
 * Uso: node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  console.log('🚀 Iniciando migrações do banco de dados...\n');

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Pasta de migrações não encontrada:', migrationsDir);
    process.exit(1);
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.warn('⚠️  Nenhum arquivo de migração encontrado');
    process.exit(0);
  }

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      console.log(`📝 Aplicando migração: ${file}...`);
      
      // Dividir em múltiplos comandos (por ponto-e-vírgula)
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error && !error.message.includes('already exists')) {
          throw error;
        }
      }

      console.log(`✅ Migração aplicada com sucesso: ${file}\n`);
    } catch (error) {
      console.error(`❌ Erro ao aplicar migração ${file}:`, error.message);
      console.error('SQL:', sql.substring(0, 100) + '...\n');
      process.exit(1);
    }
  }

  console.log('✨ Todas as migrações foram aplicadas com sucesso!');
  process.exit(0);
}

runMigrations();
