const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const schemas = `
-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  funcao VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de eleitores
CREATE TABLE IF NOT EXISTS eleitores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) UNIQUE,
  titulo_eleitor VARCHAR(20),
  secao_eleitoral VARCHAR(10),
  zona_eleitoral VARCHAR(10),
  endereco TEXT,
  bairro VARCHAR(100),
  municipio VARCHAR(100),
  estado VARCHAR(2),
  telefone VARCHAR(20),
  email VARCHAR(255),
  data_nascimento DATE,
  genero VARCHAR(20),
  secao_numero INTEGER,
  zona_numero INTEGER,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de lideranças
CREATE TABLE IF NOT EXISTS liderancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  cargo VARCHAR(100),
  contato VARCHAR(20),
  endereco TEXT,
  bairro VARCHAR(100),
  municipio VARCHAR(100),
  estado VARCHAR(2),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de funcionários
CREATE TABLE IF NOT EXISTS funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) UNIQUE,
  cargo VARCHAR(100),
  data_admissao DATE,
  salario DECIMAL(10, 2),
  telefone VARCHAR(20),
  email VARCHAR(255),
  endereco TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de atendimentos
CREATE TABLE IF NOT EXISTS atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleitor_id UUID REFERENCES eleitores(id),
  data_atendimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tipo VARCHAR(100),
  descricao TEXT,
  status VARCHAR(50),
  responsavel_id UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de agenda/eventos
CREATE TABLE IF NOT EXISTS agenda_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMP NOT NULL,
  data_fim TIMESTAMP,
  local VARCHAR(255),
  criador_id UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de solicitações
CREATE TABLE IF NOT EXISTS solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  status VARCHAR(50) DEFAULT 'pendente',
  solicitante_id UUID REFERENCES usuarios(id),
  responsavel_id UUID REFERENCES usuarios(id),
  data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de documentos
CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50),
  url_arquivo VARCHAR(500),
  categoria VARCHAR(100),
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criador_id UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de emendas
CREATE TABLE IF NOT EXISTS emendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(50) UNIQUE,
  titulo VARCHAR(255),
  descricao TEXT,
  valor DECIMAL(12, 2),
  status VARCHAR(50),
  criador_id UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de órgãos
CREATE TABLE IF NOT EXISTS orgaos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  sigla VARCHAR(20),
  contato VARCHAR(100),
  endereco TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de repasses
CREATE TABLE IF NOT EXISTS repasses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emenda_id UUID REFERENCES emendas(id),
  orgao_destino_id UUID REFERENCES orgaos(id),
  valor DECIMAL(12, 2),
  data_repasse DATE,
  status VARCHAR(50),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de responsáveis de emendas
CREATE TABLE IF NOT EXISTS responsaveis_emendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emenda_id UUID REFERENCES emendas(id),
  usuario_id UUID REFERENCES usuarios(id),
  cargo VARCHAR(100),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de financeiro - caixa
CREATE TABLE IF NOT EXISTS financeiro_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_ano DATE,
  saldo_inicial DECIMAL(12, 2),
  saldo_final DECIMAL(12, 2),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de financeiro - despesas
CREATE TABLE IF NOT EXISTS financeiro_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao VARCHAR(255),
  valor DECIMAL(12, 2),
  data_despesa DATE,
  categoria VARCHAR(100),
  responsavel_id UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de financeiro - lançamentos
CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50),
  descricao VARCHAR(255),
  valor DECIMAL(12, 2),
  data_lancamento DATE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de financeiro - doadores
CREATE TABLE IF NOT EXISTS financeiro_doadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(20),
  valor_doado DECIMAL(12, 2),
  data_doacao DATE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de financeiro - faturas
CREATE TABLE IF NOT EXISTS financeiro_faturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(50),
  descricao VARCHAR(255),
  valor_total DECIMAL(12, 2),
  data_emissao DATE,
  data_vencimento DATE,
  status VARCHAR(50),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de comunicação - mensagens
CREATE TABLE IF NOT EXISTS comunicacao_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_id UUID REFERENCES usuarios(id),
  destinatario_id UUID REFERENCES usuarios(id),
  mensagem TEXT,
  lida BOOLEAN DEFAULT false,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de comunicação - conversas
CREATE TABLE IF NOT EXISTS comunicacao_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(255),
  criador_id UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de comunicação - disparos
CREATE TABLE IF NOT EXISTS comunicacao_disparos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(255),
  mensagem TEXT,
  tipo VARCHAR(50),
  status VARCHAR(50),
  data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criador_id UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de aniversariantes
CREATE TABLE IF NOT EXISTS aniversariantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  data_nascimento DATE NOT NULL,
  tipo VARCHAR(50),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS logs_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  acao VARCHAR(255),
  tabela VARCHAR(100),
  registro_id VARCHAR(100),
  dados_antigos JSONB,
  dados_novos JSONB,
  data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de logs de acesso
CREATE TABLE IF NOT EXISTS logs_acessos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  pagina VARCHAR(255),
  data_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave VARCHAR(255) UNIQUE,
  valor TEXT,
  descricao TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_eleitores_cpf ON eleitores(cpf);
CREATE INDEX IF NOT EXISTS idx_eleitores_municipio ON eleitores(municipio);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_atendimentos_eleitor ON atendimentos(eleitor_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_responsavel ON atendimentos(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes(status);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_data ON logs_auditoria(data_acao);
`;

async function createTables() {
  console.log('🚀 Criando todas as 24 tabelas...\n');

  const sqlStatements = schemas
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let created = 0;
  let failed = 0;

  for (const sql of sqlStatements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        // Tenta com outro método
        console.log(`⏭️  ${sql.substring(0, 50)}...`);
      } else {
        console.log(`✅ ${sql.substring(0, 50)}...`);
        created++;
      }
    } catch (err) {
      // Ignora erros (pode ser que a tabela já exista)
      console.log(`⏭️  ${sql.substring(0, 50)}...`);
    }
  }

  console.log(`\n📊 Resultado: ${created} criadas, ${sqlStatements.length - created} ignoradas\n`);

  // Verifica quais tabelas existem
  console.log('🔍 Verificando tabelas...\n');
  
  const tabelas = [
    'usuarios', 'eleitores', 'liderancas', 'funcionarios', 'atendimentos',
    'agenda_eventos', 'solicitacoes', 'documentos', 'emendas', 'orgaos',
    'repasses', 'responsaveis_emendas', 'financeiro_caixa', 'financeiro_despesas',
    'financeiro_lancamentos', 'financeiro_doadores', 'financeiro_faturas',
    'comunicacao_mensagens', 'comunicacao_conversas', 'comunicacao_disparos',
    'aniversariantes', 'logs_auditoria', 'logs_acessos', 'configuracoes_sistema'
  ];

  let totalCriadas = 0;

  for (const tabela of tabelas) {
    try {
      const { error, data, count } = await supabase
        .from(tabela)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ ${tabela}`);
        totalCriadas++;
      } else {
        console.log(`❌ ${tabela}`);
      }
    } catch (err) {
      console.log(`❌ ${tabela}`);
    }
  }

  console.log(`\n✨ Total de tabelas criadas: ${totalCriadas}/24`);
  
  if (totalCriadas === 24) {
    console.log('🎉 SUCESSO! Todas as tabelas foram criadas!');
  } else {
    console.log('⚠️  Algumas tabelas ainda não foram criadas. Verifique o Supabase Dashboard.');
  }
}

createTables().catch(console.error);
