require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executarViaPostgres(sql) {
  if (!DATABASE_URL) {
    console.error('❌ Erro: DATABASE_URL não configurada para fallback via Postgres');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('⚠️  exec_sql não disponível. Executando via DATABASE_URL...');
    await client.query(sql);
  } finally {
    await client.release();
    await pool.end();
  }
}

async function executarMigracao() {
  try {
    console.log('📦 Executando migração 204_add_campanha_id_to_atendimentos.sql...\n');

    const migrationPath = path.join(__dirname, '../supabase/migrations/204_add_campanha_id_to_atendimentos.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Executar SQL via RPC ou diretamente
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      if (error.code === 'PGRST202') {
        await executarViaPostgres(migrationSQL);
      } else {
        console.error('❌ Erro ao executar migração:', error);
        process.exit(1);
      }
    }

    console.log('✅ Migração executada com sucesso!');
    console.log('\n📋 Verificando se coluna foi adicionada...');

    // Verificar se coluna existe
    const { data: checkData, error: checkError } = await supabase
      .from('atendimentos')
      .select('campanha_id')
      .limit(1);

    if (checkError) {
      console.error('❌ Erro ao verificar coluna:', checkError);
      process.exit(1);
    }

    console.log('✅ Coluna campanha_id existe e está acessível!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante execução:', error.message);
    process.exit(1);
  }
}

executarMigracao();
