/**
 * Script para adicionar colunas de geolocalização à tabela liderancas
 * Execute: node scripts/add-liderancas-geo.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Variáveis de ambiente não configuradas!');
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function addGeoColumnsToLiderancas() {
  try {
    console.log('🔄 Adicionando colunas de geolocalização à tabela liderancas...\n');

    // Lista de colunas para adicionar
    const columns = [
      'latitude NUMERIC(10, 8)',
      'longitude NUMERIC(11, 8)',
      'logradouro VARCHAR(500)',
      'numero VARCHAR(20)',
      'complemento VARCHAR(200)',
      'bairro VARCHAR(100)',
      'cidade VARCHAR(100)',
      'uf VARCHAR(2)',
      'cep VARCHAR(8)'
    ];

    // Verificar quais colunas já existem
    console.log('✅ Verificando estrutura da tabela...\n');
    
    // Como não podemos executar DDL diretamente via Supabase Client,
    // vamos tentar uma abordagem alternativa: verificar e instruir o usuário
    
    console.log('⚠️  Nota: DDL (ALTER TABLE) não pode ser executado via API Supabase Client');
    console.log('   Você precisa executar manualmente no Supabase Dashboard:\n');
    
    const sql = `ALTER TABLE liderancas
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),
  ADD COLUMN IF NOT EXISTS logradouro VARCHAR(500),
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complemento VARCHAR(200),
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
  ADD COLUMN IF NOT EXISTS uf VARCHAR(2),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(8);`;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SQL para executar no Supabase Dashboard:\n');
    console.log(sql);
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('\nPassos:');
    console.log('1. Abra: https://supabase.com/dashboard');
    console.log('2. Selecione seu projeto MandatoPro');
    console.log('3. Vá em: SQL Editor → Nova Query');
    console.log('4. Cole o SQL acima');
    console.log('5. Clique em "Executar" (Ctrl+Enter)\n');

    // Tentar verificar se a tabela existe
    const { data, error } = await supabase
      .from('liderancas')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Erro ao verificar tabela:', error.message);
    } else {
      console.log('✅ Tabela liderancas existe e está acessível');
      console.log('\nDepois de executar o SQL, execute novamente o script para validar.\n');
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

addGeoColumnsToLiderancas();
