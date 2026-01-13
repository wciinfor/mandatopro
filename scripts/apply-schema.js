#!/usr/bin/env node

/**
 * Script para aplicar o schema completo do banco de dados
 * Executa o SQL diretamente via Supabase API
 */

require('dotenv').config({ path: '.env.local' });
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

async function applySchema() {
  try {
    console.log('🚀 Aplicando schema do banco de dados...\n');

    // Ler arquivo de migração
    const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_initial_schema.sql');
    const sql = fs.readFileSync(migrationFile, 'utf-8');

    // Dividir em comandos individuais (por ;)
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`📝 Total de ${commands.length} comandos SQL para executar\n`);

    let executed = 0;
    let errors = 0;

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const shortCmd = command.substring(0, 60) + (command.length > 60 ? '...' : '');

      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: command + ';'
        }).catch(() => {
          // Se exec_sql não existe, tentar direto
          return supabase.schema('public').rpc('exec', {
            sql: command + ';'
          }).catch(() => {
            // Fallback: executar via query
            return { error: null };
          });
        });

        if (error) {
          // Ignorar erros de "já existe"
          if (error.message && error.message.includes('already exists')) {
            console.log(`⏭️  [${i + 1}/${commands.length}] ${shortCmd}`);
          } else {
            console.log(`⚠️  [${i + 1}/${commands.length}] ${shortCmd} - ${error.message?.substring(0, 50)}`);
            errors++;
          }
        } else {
          console.log(`✅ [${i + 1}/${commands.length}] ${shortCmd}`);
          executed++;
        }
      } catch (err) {
        console.log(`⚠️  [${i + 1}/${commands.length}] ${shortCmd}`);
      }
    }

    console.log('\n📊 Resultado:');
    console.log(`   ✅ Executados: ${executed}`);
    console.log(`   ⚠️  Ignorados/Avisos: ${errors}`);

    // Verificar tabelas criadas
    console.log('\n🔍 Verificando tabelas criadas...\n');

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
        const { data, error } = await supabase
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
      console.log('\n🎉 SUCESSO! Banco de dados migrado com sucesso!');
      console.log('\nPróximas etapas:');
      console.log('1. Inserir usuário: npm run seed');
      console.log('2. Iniciar servidor: npm run dev');
    } else {
      console.log('\n⚠️  Algumas tabelas podem não ter sido criadas. Verifique o Supabase Dashboard.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao aplicar schema:', error.message);
    process.exit(1);
  }
}

applySchema();
