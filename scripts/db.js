#!/usr/bin/env node

/**
 * Script auxiliar para gerenciar o banco de dados Supabase
 * Uso: node scripts/db.js [comando]
 * 
 * Comandos:
 *   - seed        : Insere dados de teste
 *   - clean       : Limpa todas as tabelas
 *   - status      : Mostra status do banco
 */

const supabase = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabaseClient = supabase.createClient(supabaseUrl, supabaseServiceKey);

const comando = process.argv[2] || 'status';

async function seed() {
  console.log('🌱 Inserindo dados de teste...\n');

  try {
    // Inserir usuário admin de teste
    const { data: usuarios } = await supabaseClient
      .from('usuarios')
      .insert([
        {
          email: 'admin@mandatopro.com',
          nome: 'Admin Sistema',
          nivel: 'ADMINISTRADOR',
          status: 'ATIVO'
        },
        {
          email: 'lideranca@mandatopro.com',
          nome: 'João Silva Santos',
          nivel: 'LIDERANCA',
          status: 'ATIVO'
        },
        {
          email: 'operador@mandatopro.com',
          nome: 'Maria Costa Oliveira',
          nivel: 'OPERADOR',
          status: 'ATIVO'
        }
      ])
      .select();

    console.log('✅ Usuários inseridos:', usuarios?.length);

    // Inserir lideranças
    const { data: liderancas } = await supabaseClient
      .from('liderancas')
      .insert([
        {
          nome: 'João Silva Santos',
          cpf: '12345678910',
          email: 'joao@example.com',
          influencia: 'ALTA',
          area_atuacao: 'Guamá',
          status: 'ATIVO'
        },
        {
          nome: 'Maria Costa Oliveira',
          cpf: '98765432109',
          email: 'maria@example.com',
          influencia: 'MÉDIA',
          area_atuacao: 'Pedreira',
          status: 'ATIVO'
        }
      ])
      .select();

    console.log('✅ Lideranças inseridas:', liderancas?.length);

    // Inserir eleitores de teste
    const { data: eleitores } = await supabaseClient
      .from('eleitores')
      .insert([
        {
          nome: 'Carlos Alberto Silva',
          cpf: '11111111111',
          email: 'carlos@example.com',
          telefone: '(91) 99999-1111',
          bairro: 'Guamá',
          cidade: 'Belém',
          estado: 'PA',
          status: 'ATIVO',
          lideranca_id: liderancas?.[0]?.id || 1
        },
        {
          nome: 'Ana Paula Costa',
          cpf: '22222222222',
          email: 'ana@example.com',
          telefone: '(91) 99999-2222',
          bairro: 'Pedreira',
          cidade: 'Belém',
          estado: 'PA',
          status: 'ATIVO',
          lideranca_id: liderancas?.[1]?.id || 2
        }
      ])
      .select();

    console.log('✅ Eleitores inseridos:', eleitores?.length);

    console.log('\n✨ Dados de teste inseridos com sucesso!');
    console.log('📝 Você pode fazer login com:');
    console.log('   Email: admin@mandatopro.com');
    console.log('   Senha: (configure no Supabase Auth)');
  } catch (error) {
    console.error('❌ Erro ao inserir dados:', error.message);
    process.exit(1);
  }
}

async function clean() {
  console.log('🗑️  Limpando banco de dados...\n');

  const tabelas = [
    'logs_acessos',
    'logs_auditoria',
    'comunicacao_disparos',
    'comunicacao_conversas',
    'comunicacao_mensagens',
    'financeiro_faturas',
    'financeiro_doadores',
    'financeiro_lancamentos',
    'financeiro_despesas',
    'financeiro_caixa',
    'responsaveis_emendas',
    'repasses',
    'emendas',
    'orgaos',
    'aniversariantes',
    'documentos',
    'solicitacoes',
    'agenda_eventos',
    'atendimentos',
    'funcionarios',
    'eleitores',
    'liderancas',
    'usuarios',
    'configuracoes_sistema'
  ];

  for (const tabela of tabelas) {
    try {
      const { count } = await supabaseClient
        .from(tabela)
        .select('*', { count: 'exact', head: true });

      if (count > 0) {
        await supabaseClient.from(tabela).delete().neq('id', 0);
        console.log(`✅ ${tabela}: ${count} registros removidos`);
      }
    } catch (error) {
      console.log(`⏭️  ${tabela}: ignorado ou não existe`);
    }
  }

  console.log('\n✨ Banco de dados limpo!');
}

async function status() {
  console.log('📊 Status do Banco de Dados\n');

  const tabelas = [
    'usuarios',
    'eleitores',
    'liderancas',
    'funcionarios',
    'atendimentos',
    'agenda_eventos',
    'solicitacoes',
    'documentos',
    'emendas',
    'orgaos',
    'repasses',
    'financeiro_caixa',
    'financeiro_despesas',
    'comunicacao_mensagens',
    'aniversariantes',
    'logs_auditoria'
  ];

  let totalRegistros = 0;

  for (const tabela of tabelas) {
    try {
      const { count } = await supabaseClient
        .from(tabela)
        .select('*', { count: 'exact', head: true });

      console.log(`  ${tabela}: ${count || 0} registros`);
      totalRegistros += count || 0;
    } catch (error) {
      console.log(`  ${tabela}: erro ao contar`);
    }
  }

  console.log(`\n📈 Total de registros: ${totalRegistros}`);
  console.log(`✅ Banco de dados conectado e operacional!`);
}

async function main() {
  switch (comando) {
    case 'seed':
      await seed();
      break;
    case 'clean':
      await clean();
      break;
    case 'status':
      await status();
      break;
    default:
      console.log('❌ Comando desconhecido:', comando);
      console.log('Comandos disponíveis: seed, clean, status');
      process.exit(1);
  }

  process.exit(0);
}

main().catch(error => {
  console.error('❌ Erro:', error);
  process.exit(1);
});
