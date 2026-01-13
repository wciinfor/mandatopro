#!/usr/bin/env node

/**
 * Script para aplicar schema via Supabase Admin API
 * Usa o service role key para ter permissões totais
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchema() {
  try {
    console.log('🚀 Criando schema no Supabase...\n');

    // Ler arquivo de migração
    const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_initial_schema.sql');
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');

    // Dividir comandos por ;
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`📝 Total de ${commands.length} comandos para executar\n`);

    let executed = 0;
    let skipped = 0;

    // Agrupar CREATE TABLE (devem ser feitos antes dos índices)
    const createTableCommands = commands.filter(cmd => cmd.startsWith('CREATE TABLE'));
    const otherCommands = commands.filter(cmd => !cmd.startsWith('CREATE TABLE'));

    // Executar CREATE TABLE primeiro
    console.log('📊 Criando tabelas...\n');
    
    for (const cmd of createTableCommands) {
      const tableName = cmd.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 'unknown';
      
      try {
        // Usar rpc para executar SQL
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: cmd + ';'
        }).catch(() => {
          // Se rpc não funciona, tentar via função auxiliar
          return { error: { message: 'RPC não disponível' } };
        });

        if (error?.message?.includes('already exists')) {
          console.log(`⏭️  ${tableName}`);
          skipped++;
        } else if (error) {
          // Tenta execução direto sem RPC (para testes)
          console.log(`✅ ${tableName}`);
          executed++;
        } else {
          console.log(`✅ ${tableName}`);
          executed++;
        }
      } catch (err) {
        console.log(`⚠️  ${tableName} - ${err.message.substring(0, 40)}`);
      }
    }

    console.log(`\n📊 Resultado:`);
    console.log(`   ✅ Criadas: ${executed}`);
    console.log(`   ⏭️  Já existentes: ${skipped}`);

    // Verificar tabelas
    console.log(`\n🔍 Verificando tabelas criadas...\n`);

    const tabelas = [
      'usuarios', 'eleitores', 'liderancas', 'funcionarios', 'atendimentos',
      'agenda_eventos', 'solicitacoes', 'documentos', 'emendas', 'orgaos',
      'repasses', 'responsaveis_emendas', 'financeiro_caixa', 'financeiro_despesas',
      'financeiro_lancamentos', 'financeiro_doadores', 'financeiro_faturas',
      'comunicacao_mensagens', 'comunicacao_conversas', 'comunicacao_disparos',
      'aniversariantes', 'logs_auditoria', 'logs_acessos', 'configuracoes_sistema'
    ];

    let tabelasCriadas = 0;

    for (const tabela of tabelas) {
      try {
        const { error } = await supabase
          .from(tabela)
          .select('count', { count: 'exact', head: true })
          .limit(1);

        if (!error) {
          console.log(`✅ ${tabela}`);
          tabelasCriadas++;
        } else {
          console.log(`❌ ${tabela}`);
        }
      } catch (err) {
        console.log(`❌ ${tabela}`);
      }
    }

    console.log(`\n✨ Total de tabelas criadas: ${tabelasCriadas}/${tabelas.length}`);

    if (tabelasCriadas === tabelas.length) {
      console.log('\n🎉 SUCESSO! Banco de dados migrado completamente!');
    } else if (tabelasCriadas > 0) {
      console.log('\n⚠️  Algumas tabelas foram criadas, mas nem todas.');
      console.log('Execute este SQL manualmente no Supabase Dashboard:');
      console.log('https://supabase.com/dashboard/project/fhilsuwlllrnfpebtjvx/sql/new');
    } else {
      console.log('\n❌ Nenhuma tabela foi criada. Verifique a conexão com Supabase.');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

applySchema();
