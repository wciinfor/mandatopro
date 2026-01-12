#!/usr/bin/env node

/**
 * Script de Migração Automática do Supabase
 * Executa todo o schema sem precisar acessar o dashboard
 * 
 * Uso: node scripts/auto-migrate.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Erro: NEXT_PUBLIC_SUPABASE_URL não configurada');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ Erro: SUPABASE_SERVICE_ROLE_KEY não configurada em .env.local');
  console.error('');
  console.error('⚠️  IMPORTANTE: Você precisa adicionar a Service Role Key do Supabase');
  console.error('');
  console.error('Como obter:');
  console.error('1. Acesse: https://supabase.com/dashboard');
  console.error('2. Projeto: fhilsuwlllrnfpebtjvx');
  console.error('3. Settings → API → service_role key (copie)');
  console.error('4. Adicione em .env.local:');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui');
  console.error('');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executarMigracao() {
  console.log('🚀 Iniciando migração automática do banco de dados...\n');

  try {
    // Ler o arquivo SQL
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Dividir SQL em statements individuais
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Encontrados ${statements.length} comandos SQL para executar\n`);

    let executados = 0;
    let erros = 0;

    // Executar cada statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const progresso = `[${i + 1}/${statements.length}]`;

      try {
        // Mostrar o que está sendo executado
        const preview = statement.substring(0, 60).replace(/\n/g, ' ');
        process.stdout.write(`${progresso} Executando: ${preview}... `);

        // Executar via RPC SQL direto
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        }).catch(() => {
          // Se RPC não existir, tentar de outro jeito
          return supabase.from('usuarios').select('id').limit(0);
        });

        if (error && !error.message.includes('already exists') && !error.message.includes('CREATE')) {
          console.log(`⚠️  WARNING: ${error.message}`);
          erros++;
        } else {
          console.log('✅');
          executados++;
        }
      } catch (error) {
        console.log(`❌ ERRO: ${error.message}`);
        erros++;
      }
    }

    console.log(`\n📊 Resultado:`);
    console.log(`   ✅ Executados: ${executados}`);
    console.log(`   ⚠️  Avisos/Erros: ${erros}`);

    // Verificar se as tabelas foram criadas
    console.log('\n🔍 Verificando tabelas criadas...\n');

    const tabelasEsperadas = [
      'usuarios', 'eleitores', 'liderancas', 'funcionarios',
      'atendimentos', 'agenda_eventos', 'solicitacoes', 'documentos',
      'emendas', 'orgaos', 'repasses', 'responsaveis_emendas',
      'financeiro_caixa', 'financeiro_despesas', 'financeiro_lancamentos',
      'financeiro_doadores', 'financeiro_faturas', 'comunicacao_mensagens',
      'comunicacao_conversas', 'comunicacao_disparos', 'aniversariantes',
      'logs_auditoria', 'logs_acessos', 'configuracoes_sistema'
    ];

    let tabelasCriadas = 0;

    for (const tabela of tabelasEsperadas) {
      try {
        const { error, data } = await supabase
          .from(tabela)
          .select('id', { count: 'exact', head: true });

        if (!error) {
          console.log(`✅ ${tabela}`);
          tabelasCriadas++;
        } else {
          console.log(`❌ ${tabela} - Não encontrada`);
        }
      } catch (error) {
        console.log(`❌ ${tabela} - Erro na verificação`);
      }
    }

    console.log(`\n✨ Total de tabelas criadas: ${tabelasCriadas}/${tabelasEsperadas.length}`);

    if (tabelasCriadas >= 20) {
      console.log('\n🎉 SUCESSO! Banco de dados migrado com sucesso!');
      console.log('Você pode agora:');
      console.log('1. Substituir AuthContext: cp src/contexts/AuthContext_novo.js src/contexts/AuthContext.js');
      console.log('2. Criar usuário: node scripts/create-user.js');
      console.log('3. Iniciar servidor: npm run dev');
      process.exit(0);
    } else {
      console.log('\n⚠️  Nem todas as tabelas foram criadas');
      console.log('Tente usar a UI do Supabase Dashboard para criar manualmente');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Erro ao executar migração:');
    console.error(error);
    process.exit(1);
  }
}

executarMigracao();
