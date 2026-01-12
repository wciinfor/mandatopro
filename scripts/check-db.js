#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  console.log('🔍 Verificando tabelas do Supabase...\n');
  
  const tabelas = [
    'usuarios', 'eleitores', 'liderancas', 'funcionarios',
    'atendimentos', 'agenda_eventos', 'solicitacoes', 'documentos',
    'emendas', 'orgaos', 'repasses', 'responsaveis_emendas',
    'financeiro_caixa', 'financeiro_despesas', 'financeiro_lancamentos',
    'financeiro_doadores', 'financeiro_faturas', 'comunicacao_mensagens',
    'comunicacao_conversas', 'comunicacao_disparos', 'aniversariantes',
    'logs_auditoria', 'logs_acessos', 'configuracoes_sistema'
  ];

  let encontradas = 0;

  for (const tabela of tabelas) {
    try {
      const { data, error, count } = await supabase
        .from(tabela)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${tabela}`);
      } else {
        console.log(`✅ ${tabela} (${count} registros)`);
        encontradas++;
      }
    } catch (error) {
      console.log(`⚠️  ${tabela} - erro na consulta`);
    }
  }

  console.log(`\n📊 Total: ${encontradas}/24 tabelas acessíveis`);
  process.exit(0);
})();
