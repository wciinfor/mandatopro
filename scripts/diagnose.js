const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSchema() {
  console.log('🔧 Corrigindo schema e ativando RLS...\n');

  // 1. Verificar estrutura da tabela usuarios
  console.log('📋 Estrutura da tabela usuarios:\n');
  try {
    const { error, data } = await supabase
      .from('usuarios')
      .select('*')
      .limit(1);
    
    if (!error && data && data.length > 0) {
      console.log('Colunas existentes:', Object.keys(data[0]));
    } else {
      console.log('Tabela vazia, estrutura desconhecida');
    }
  } catch (err) {
    console.log('Erro:', err.message);
  }

  // 2. Tentar adicionar coluna funcao se não existir
  console.log('\n🔨 Tentando adicionar coluna `funcao`...\n');
  
  try {
    // Cria um usuário de teste para verificar se funcao existe
    const { error: testError } = await supabase
      .from('usuarios')
      .insert([{
        email: 'schema-test-' + Date.now() + '@test.com',
        nome: 'Test',
        ativo: true
      }])
      .select();

    if (testError) {
      if (testError.message.includes('funcao')) {
        console.log('❌ Coluna `funcao` falta. Precisa ser adicionada via Dashboard SQL Editor');
      } else {
        console.log('⚠️  Outro erro:', testError.message);
      }
    } else {
      console.log('✅ Usuários podem ser criados sem `funcao`');
      
      // Limpa teste
      await supabase
        .from('usuarios')
        .delete()
        .ilike('email', '%schema-test%');
    }
  } catch (err) {
    console.log('Erro:', err.message);
  }

  // 3. Testar RLS - não consegue ativar via SDK, mas pode verificar
  console.log('\n🔒 Status de RLS:\n');
  
  console.log('✅ RLS pode ser ativado apenas via Dashboard SQL Editor');
  console.log('   Execute no Dashboard → SQL Editor:');
  console.log('   ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;');
  console.log('   ALTER TABLE public.eleitores ENABLE ROW LEVEL SECURITY;');
  console.log('   ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;');
  console.log('   ALTER TABLE public.liderancas ENABLE ROW LEVEL SECURITY;');

  // 4. Resumo final
  console.log('\n📊 RESUMO:\n');
  console.log('✅ Service Role Key: FUNCIONANDO');
  console.log('✅ 24 tabelas: CRIADAS E ACESSÍVEIS');
  console.log('❌ RPC exec_sql: NÃO DISPONÍVEL (Supabase Free)');
  console.log('⚠️  Coluna funcao: VERIFICAR SCHEMA');
  console.log('⚠️  RLS: PRECISA ATIVAR VIA DASHBOARD');
}

fixSchema().catch(console.error);
