#!/usr/bin/env node

/**
 * Último recurso: usar Supabase RPC exec_sql se estiver disponível
 * Senão, cria um helper para executar manualmente
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Credenciais Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  try {
    console.log('🔌 Conectando ao Supabase...\n');

    // Ler arquivo de migração
    const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_initial_schema.sql');
    let sqlContent = fs.readFileSync(migrationFile, 'utf-8');

    // Dividir por comandos individuais (mais seguro)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`📝 Total de ${commands.length} comandos\n`);

    let executed = 0;
    let skipped = 0;
    let errors = [];

    // Agrupar CREATE TABLE primeiro (dependências)
    const createTableCmd = commands.filter(c => c.startsWith('CREATE TABLE'));
    const otherCmd = commands.filter(c => !c.startsWith('CREATE TABLE'));

    const allCmd = [...createTableCmd, ...otherCmd];

    for (let i = 0; i < allCmd.length; i++) {
      const cmd = allCmd[i];
      const shortCmd = cmd.substring(0, 50).replace(/\n/g, ' ') + (cmd.length > 50 ? '...' : '');
      
      process.stdout.write(`[${String(i + 1).padStart(3)}/${allCmd.length}] ${shortCmd.padEnd(65)}`);

      try {
        // Tentar via RPC exec_sql
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: cmd + ';'
        });

        if (error) {
          if (error.message && error.message.includes('already exists')) {
            console.log(' ⏭️');
            skipped++;
          } else {
            console.log(` ❌ ${error.message.substring(0, 30)}`);
            errors.push({ cmd: shortCmd, error: error.message });
          }
        } else {
          console.log(' ✅');
          executed++;
        }
      } catch (err) {
        console.log(` ⚠️`);
        errors.push({ cmd: shortCmd, error: err.message });
      }
    }

    console.log(`\n📊 Resultado:`);
    console.log(`  ✅ Executados: ${executed}`);
    console.log(`  ⏭️  Já existentes: ${skipped}`);
    console.log(`  ❌ Erros: ${errors.length}`);

    if (errors.length > 0 && executed === 0) {
      console.log('\n⚠️  RPC exec_sql pode não estar disponível.');
      console.log('📌 Solução: Execute o SQL manualmente no Supabase Dashboard:');
      console.log('   https://supabase.com/dashboard/project/fhilsuwlllrnfpebtjvx/sql/new');
      console.log('\n📋 Copie o arquivo: SCHEMA_TO_EXECUTE.sql');
      process.exit(1);
    }

    // Verificar tabelas
    console.log('\n🔍 Verificando tabelas...\n');
    
    const expectedTables = [
      'usuarios', 'eleitores', 'liderancas', 'funcionarios', 'atendimentos',
      'agenda_eventos', 'solicitacoes', 'documentos', 'emendas', 'orgaos',
      'repasses', 'responsaveis_emendas', 'financeiro_caixa', 'financeiro_despesas',
      'financeiro_lancamentos', 'financeiro_doadores', 'financeiro_faturas',
      'comunicacao_mensagens', 'comunicacao_conversas', 'comunicacao_disparos',
      'aniversariantes', 'logs_auditoria', 'logs_acessos', 'configuracoes_sistema'
    ];

    let found = 0;
    for (const tabela of expectedTables) {
      try {
        const { error } = await supabase
          .from(tabela)
          .select('count', { count: 'exact', head: true })
          .limit(1);

        if (!error) {
          console.log(`✅ ${tabela}`);
          found++;
        }
      } catch (err) {
        // Tabela não encontrada
      }
    }

    console.log(`\n✨ Total: ${found}/${expectedTables.length} tabelas encontradas`);

    if (found === expectedTables.length) {
      console.log('\n🎉 SUCESSO! Todas as 24 tabelas foram criadas!');
      process.exit(0);
    } else if (found > 0) {
      console.log('\n⚠️  Algumas tabelas foram criadas, mas não todas.');
      process.exit(1);
    } else {
      console.log('\n❌ Nenhuma tabela foi criada.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
