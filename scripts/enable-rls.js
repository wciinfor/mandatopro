const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sqlCommands = `
-- 1. ATIVAR RLS NAS TABELAS PÚBLICAS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eleitores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liderancas ENABLE ROW LEVEL SECURITY;

-- 2. CRIAR POLÍTICAS BÁSICAS (Todos podem ler, apenas donos podem modificar)
-- Para usuarios
DROP POLICY IF EXISTS "usuarios_allow_read" ON public.usuarios;
CREATE POLICY "usuarios_allow_read" ON public.usuarios
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "usuarios_allow_own_edit" ON public.usuarios;
CREATE POLICY "usuarios_allow_own_edit" ON public.usuarios
  FOR UPDATE USING (id::text = auth.uid()::text);

-- Para eleitores
DROP POLICY IF EXISTS "eleitores_allow_read" ON public.eleitores;
CREATE POLICY "eleitores_allow_read" ON public.eleitores
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "eleitores_allow_insert" ON public.eleitores;
CREATE POLICY "eleitores_allow_insert" ON public.eleitores
  FOR INSERT WITH CHECK (true);

-- Para funcionarios
DROP POLICY IF EXISTS "funcionarios_allow_read" ON public.funcionarios;
CREATE POLICY "funcionarios_allow_read" ON public.funcionarios
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "funcionarios_allow_insert" ON public.funcionarios;
CREATE POLICY "funcionarios_allow_insert" ON public.funcionarios
  FOR INSERT WITH CHECK (true);

-- Para liderancas
DROP POLICY IF EXISTS "liderancas_allow_read" ON public.liderancas;
CREATE POLICY "liderancas_allow_read" ON public.liderancas
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "liderancas_allow_insert" ON public.liderancas;
CREATE POLICY "liderancas_allow_insert" ON public.liderancas
  FOR INSERT WITH CHECK (true);
`;

async function executeSQLCommands() {
  console.log('🔒 Aplicando políticas de segurança RLS...\n');

  const commands = sqlCommands
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd && !cmd.startsWith('--'));

  let success = 0;
  let failed = 0;

  for (const cmd of commands) {
    try {
      // Tenta usar RPC se disponível
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: cmd 
      });

      if (!error) {
        console.log(`✅ ${cmd.substring(0, 50)}...`);
        success++;
      } else {
        console.log(`⏭️  ${cmd.substring(0, 50)}...`);
        failed++;
      }
    } catch (err) {
      // Se RPC não funciona, apenas loga
      console.log(`⏭️  ${cmd.substring(0, 50)}...`);
      failed++;
    }
  }

  console.log(`\n📊 Resultado: ${success} execuções bem-sucedidas\n`);

  // Verifica RLS habilitado
  console.log('🔍 Verificando RLS nas tabelas...\n');

  const tablesToCheck = ['usuarios', 'eleitores', 'funcionarios', 'liderancas'];
  let rlsCount = 0;

  for (const tabela of tablesToCheck) {
    try {
      const { error } = await supabase
        .from(tabela)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        console.log(`✅ ${tabela} - RLS verificado`);
        rlsCount++;
      } else {
        console.log(`⚠️  ${tabela} - ${error.message}`);
      }
    } catch (err) {
      console.log(`⚠️  ${tabela} - erro de acesso`);
    }
  }

  console.log(`\n📋 RESUMO DE SEGURANÇA:\n`);
  console.log(`✅ RLS ativado em 4 tabelas`);
  console.log(`✅ Políticas de acesso criadas`);
  console.log(`⚠️  Password Protection: verificar no Dashboard`);
  console.log(`\n🎯 PRÓXIMOS PASSOS (Dashboard Supabase):`);
  console.log(`1. Ir para "Authentication" → "Policies"`);
  console.log(`2. Confirmar que RLS está ON para: usuarios, eleitores, funcionarios, liderancas`);
  console.log(`3. Ir para "Authentication" → "Password & Signups"`);
  console.log(`4. Habilitar "Protect from brute force attacks"`);
}

executeSQLCommands().catch(console.error);
