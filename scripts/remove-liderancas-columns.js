import { createServerClient } from '../src/lib/supabase-server.ts';
import * as fs from 'fs';
import * as path from 'path';

const migrateDatabase = async () => {
  try {
    console.log('🔄 Executando migração para remover colunas de endereço...\n');

    const supabase = createServerClient();

    // Ler arquivo SQL
    const sqlPath = path.join(process.cwd(), 'scripts/migrations/2026_02_20_remove_liderancas_address_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Executar SQL bruto
    const { error, data } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ Erro ao executar migração:', error);
      process.exit(1);
    }

    console.log('✅ Migração executada com sucesso!');
    console.log('\n📋 Colunas removidas:');
    console.log('  - cep');
    console.log('  - logradouro');
    console.log('  - numero');
    console.log('  - complemento');
    console.log('  - bairro');
    console.log('  - cidade');
    console.log('  - uf');
    console.log('  - latitude');
    console.log('  - longitude');

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
};

migrateDatabase();
