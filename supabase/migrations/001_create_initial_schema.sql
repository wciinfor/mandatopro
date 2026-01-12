-- MandatoPro - Schema Database
-- Criado em: 11 de janeiro de 2026

-- ============================================================
-- 1. TABELA DE USUÁRIOS DO SISTEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  nivel VARCHAR(50) NOT NULL CHECK (nivel IN ('ADMINISTRADOR', 'LIDERANCA', 'OPERADOR')),
  status VARCHAR(50) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO', 'BLOQUEADO')),
  lideranca_id BIGINT REFERENCES liderancas(id) ON DELETE SET NULL,
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso TIMESTAMP,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. TABELA DE ELEITORES
-- ============================================================
CREATE TABLE IF NOT EXISTS eleitores (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) UNIQUE NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco VARCHAR(500),
  numero VARCHAR(20),
  complemento VARCHAR(255),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(8),
  status VARCHAR(50) DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO', 'TRANSFERIDO')),
  lideranca_id BIGINT REFERENCES liderancas(id) ON DELETE SET NULL,
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_nascimento DATE,
  sexo VARCHAR(1),
  profissao VARCHAR(100),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. TABELA DE LIDERANÇAS
-- ============================================================
CREATE TABLE IF NOT EXISTS liderancas (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) UNIQUE,
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco VARCHAR(500),
  numero VARCHAR(20),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(8),
  influencia VARCHAR(50) DEFAULT 'MÉDIA' CHECK (influencia IN ('BAIXA', 'MÉDIA', 'ALTA', 'MUITO_ALTA')),
  area_atuacao VARCHAR(255),
  status VARCHAR(50) DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. TABELA DE FUNCIONÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS funcionarios (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) UNIQUE,
  email VARCHAR(255),
  telefone VARCHAR(20),
  cargo VARCHAR(100),
  departamento VARCHAR(100),
  data_admissao DATE,
  salario NUMERIC(10, 2),
  status VARCHAR(50) DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'AFASTADO', 'DEMITIDO')),
  endereco VARCHAR(500),
  numero VARCHAR(20),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  data_nascimento DATE,
  cep VARCHAR(8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. TABELA DE ATENDIMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimentos (
  id BIGSERIAL PRIMARY KEY,
  protocolo VARCHAR(50) UNIQUE,
  eleitor_id BIGINT REFERENCES eleitores(id) ON DELETE CASCADE,
  data_atendimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tipo_atendimento VARCHAR(100),
  assunto VARCHAR(255),
  descricao TEXT,
  resultado TEXT,
  atendente_id BIGINT REFERENCES usuarios(id),
  status VARCHAR(50) DEFAULT 'REALIZADO' CHECK (status IN ('AGENDADO', 'REALIZADO', 'CANCELADO')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. TABELA DE AGENDA/EVENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS agenda_eventos (
  id BIGSERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  data DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  local VARCHAR(255),
  tipo VARCHAR(50) DEFAULT 'PARLAMENTAR' CHECK (tipo IN ('PARLAMENTAR', 'LOCAL', 'REUNIÃO', 'EVENTO')),
  categoria VARCHAR(100),
  criado_por_id BIGINT REFERENCES usuarios(id),
  status VARCHAR(50) DEFAULT 'AGENDADO' CHECK (status IN ('AGENDADO', 'REALIZADO', 'CANCELADO')),
  participantes INTEGER DEFAULT 0,
  confirmados INTEGER DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 7. TABELA DE SOLICITAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitacoes (
  id BIGSERIAL PRIMARY KEY,
  protocolo VARCHAR(50) UNIQUE NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  solicitante VARCHAR(255),
  tipo_solicitante VARCHAR(50) DEFAULT 'MORADOR' CHECK (tipo_solicitante IN ('LIDERANCA', 'MORADOR', 'FUNCIONARIO')),
  categoria VARCHAR(100),
  prioridade VARCHAR(50) DEFAULT 'MÉDIA' CHECK (prioridade IN ('URGENTE', 'ALTA', 'MÉDIA', 'BAIXA')),
  status VARCHAR(50) DEFAULT 'NOVO' CHECK (status IN ('NOVO', 'EM_ANDAMENTO', 'ATENDIDA', 'RECUSADA')),
  municipio VARCHAR(100),
  bairro VARCHAR(100),
  endereco VARCHAR(255),
  data_abertura DATE DEFAULT CURRENT_DATE,
  data_conclusao DATE,
  atendente_id BIGINT REFERENCES usuarios(id),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. TABELA DE DOCUMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS documentos (
  id BIGSERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(100) NOT NULL CHECK (tipo IN ('ARTE_CAMPANHA', 'TREINAMENTO', 'MODELO_GRUPO', 'CONTRATO', 'PARECER')),
  caminho_arquivo VARCHAR(500),
  url_arquivo VARCHAR(500),
  categoria VARCHAR(100),
  tamanho_bytes BIGINT,
  mime_type VARCHAR(100),
  criado_por_id BIGINT REFERENCES usuarios(id),
  data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_expiracao DATE,
  publico BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 9. TABELA DE EMENDAS PARLAMENTARES
-- ============================================================
CREATE TABLE IF NOT EXISTS emendas (
  id BIGSERIAL PRIMARY KEY,
  numero_emenda VARCHAR(50) UNIQUE NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  valor NUMERIC(15, 2),
  data_apresentacao DATE,
  data_aprovacao DATE,
  status VARCHAR(50) DEFAULT 'APRESENTADA' CHECK (status IN ('APRESENTADA', 'EM_ANALISE', 'APROVADA', 'REJEITADA')),
  beneficiarios TEXT,
  responsavel_id BIGINT REFERENCES usuarios(id),
  orgao_id BIGINT REFERENCES orgaos(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. TABELA DE ÓRGÃOS (para Emendas)
-- ============================================================
CREATE TABLE IF NOT EXISTS orgaos (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  sigla VARCHAR(20),
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco VARCHAR(500),
  responsavel VARCHAR(255),
  status VARCHAR(50) DEFAULT 'ATIVO',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 11. TABELA DE REPASSES
-- ============================================================
CREATE TABLE IF NOT EXISTS repasses (
  id BIGSERIAL PRIMARY KEY,
  emenda_id BIGINT REFERENCES emendas(id) ON DELETE CASCADE,
  valor NUMERIC(15, 2),
  data_prevista DATE,
  data_efetiva DATE,
  status VARCHAR(50) DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'REALIZADO', 'CANCELADO')),
  observacoes TEXT,
  responsavel_id BIGINT REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 12. TABELA DE RESPONSÁVEIS POR EMENDAS
-- ============================================================
CREATE TABLE IF NOT EXISTS responsaveis_emendas (
  id BIGSERIAL PRIMARY KEY,
  emenda_id BIGINT REFERENCES emendas(id) ON DELETE CASCADE,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  papel VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 13. TABELA DE FINANCEIRO - CAIXA
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_caixa (
  id BIGSERIAL PRIMARY KEY,
  data DATE DEFAULT CURRENT_DATE,
  saldo_anterior NUMERIC(15, 2),
  saldo_atual NUMERIC(15, 2),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 14. TABELA DE FINANCEIRO - DESPESAS
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_despesas (
  id BIGSERIAL PRIMARY KEY,
  descricao VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  valor NUMERIC(15, 2),
  data_despesa DATE,
  data_pagamento DATE,
  status VARCHAR(50) DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADA', 'PAGA', 'REJEITADA')),
  responsavel_id BIGINT REFERENCES usuarios(id),
  documento_ref VARCHAR(100),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 15. TABELA DE FINANCEIRO - LANÇAMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id BIGSERIAL PRIMARY KEY,
  data DATE NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
  descricao VARCHAR(255),
  categoria VARCHAR(100),
  valor NUMERIC(15, 2),
  referencia VARCHAR(100),
  responsavel_id BIGINT REFERENCES usuarios(id),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 16. TABELA DE FINANCEIRO - DOADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_doadores (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(14),
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco VARCHAR(500),
  limite_anual NUMERIC(15, 2),
  total_doado NUMERIC(15, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'ATIVO',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 17. TABELA DE FINANCEIRO - FATURAS
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_faturas (
  id BIGSERIAL PRIMARY KEY,
  numero_fatura VARCHAR(50) UNIQUE,
  data_emissao DATE,
  data_vencimento DATE,
  valor NUMERIC(15, 2),
  status VARCHAR(50) DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'PAGA', 'CANCELADA')),
  descricao TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 18. TABELA DE COMUNICAÇÃO - MENSAGENS
-- ============================================================
CREATE TABLE IF NOT EXISTS comunicacao_mensagens (
  id BIGSERIAL PRIMARY KEY,
  remetente_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  destinatario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  tipo VARCHAR(50) DEFAULT 'TEXTO' CHECK (tipo IN ('TEXTO', 'ARQUIVO', 'IMAGEM', 'VIDEO')),
  data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lida BOOLEAN DEFAULT false,
  data_leitura TIMESTAMP,
  anexos TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 19. TABELA DE COMUNICAÇÃO - CONVERSAS
-- ============================================================
CREATE TABLE IF NOT EXISTS comunicacao_conversas (
  id BIGSERIAL PRIMARY KEY,
  usuario1_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  usuario2_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  ultima_mensagem TEXT,
  data_ultima_mensagem TIMESTAMP,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 20. TABELA DE COMUNICAÇÃO - DISPARO EM MASSA
-- ============================================================
CREATE TABLE IF NOT EXISTS comunicacao_disparos (
  id BIGSERIAL PRIMARY KEY,
  titulo VARCHAR(255),
  mensagem TEXT NOT NULL,
  tipo_envio VARCHAR(50) DEFAULT 'WHATSAPP' CHECK (tipo_envio IN ('WHATSAPP', 'EMAIL', 'SMS')),
  destinatarios INTEGER,
  enviadas INTEGER DEFAULT 0,
  falhas INTEGER DEFAULT 0,
  data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'PROGRAMADO' CHECK (status IN ('PROGRAMADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO')),
  criado_por_id BIGINT REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 21. TABELA DE ANIVERSARIANTES
-- ============================================================
CREATE TABLE IF NOT EXISTS aniversariantes (
  id BIGSERIAL PRIMARY KEY,
  eleitor_id BIGINT REFERENCES eleitores(id) ON DELETE CASCADE,
  data_nascimento DATE,
  mes_ano VARCHAR(7),
  mes INTEGER,
  ano_nascimento INTEGER,
  enviado_mensagem BOOLEAN DEFAULT false,
  data_envio_mensagem TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 22. TABELA DE LOGS DE AUDITORIA
-- ============================================================
CREATE TABLE IF NOT EXISTS logs_auditoria (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  acao VARCHAR(100) NOT NULL,
  modulo VARCHAR(100),
  descricao TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  status VARCHAR(50) DEFAULT 'SUCESSO' CHECK (status IN ('SUCESSO', 'ERRO', 'AVISO')),
  data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 23. TABELA DE ACESSOS AO SISTEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS logs_acessos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  pagina VARCHAR(255),
  titulo_pagina VARCHAR(255),
  data_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 24. TABELA DE CONFIGURAÇÕES DO SISTEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  id BIGSERIAL PRIMARY KEY,
  chave VARCHAR(100) UNIQUE NOT NULL,
  valor TEXT,
  tipo VARCHAR(50) DEFAULT 'STRING',
  descricao TEXT,
  editavel BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================

-- Índices em Usuários
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_nivel ON usuarios(nivel);
CREATE INDEX IF NOT EXISTS idx_usuarios_status ON usuarios(status);

-- Índices em Eleitores
CREATE INDEX IF NOT EXISTS idx_eleitores_cpf ON eleitores(cpf);
CREATE INDEX IF NOT EXISTS idx_eleitores_lideranca ON eleitores(lideranca_id);
CREATE INDEX IF NOT EXISTS idx_eleitores_cidade ON eleitores(cidade);
CREATE INDEX IF NOT EXISTS idx_eleitores_status ON eleitores(status);

-- Índices em Solicitações
CREATE INDEX IF NOT EXISTS idx_solicitacoes_protocolo ON solicitacoes(protocolo);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_prioridade ON solicitacoes(prioridade);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_data ON solicitacoes(data_abertura);

-- Índices em Agenda
CREATE INDEX IF NOT EXISTS idx_agenda_data ON agenda_eventos(data);
CREATE INDEX IF NOT EXISTS idx_agenda_tipo ON agenda_eventos(tipo);

-- Índices em Emendas
CREATE INDEX IF NOT EXISTS idx_emendas_status ON emendas(status);
CREATE INDEX IF NOT EXISTS idx_emendas_orgao ON emendas(orgao_id);

-- Índices em Financeiro
CREATE INDEX IF NOT EXISTS idx_financeiro_despesas_status ON financeiro_despesas(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_tipo ON financeiro_lancamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_data ON financeiro_lancamentos(data);

-- Índices em Comunicação
CREATE INDEX IF NOT EXISTS idx_mensagens_remetente ON comunicacao_mensagens(remetente_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_destinatario ON comunicacao_mensagens(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_lida ON comunicacao_mensagens(lida);

-- Índices em Logs
CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_data ON logs_auditoria(data_acao);
CREATE INDEX IF NOT EXISTS idx_logs_modulo ON logs_auditoria(modulo);

-- ============================================================
-- CONFIGURAÇÕES INICIAIS DO SISTEMA
-- ============================================================

INSERT INTO configuracoes_sistema (chave, valor, tipo, descricao) VALUES
('nome_sistema', 'MandatoPro', 'STRING', 'Nome da aplicação'),
('versao', '1.0.0', 'STRING', 'Versão do sistema'),
('email_admin', 'admin@mandatopro.com', 'STRING', 'Email do administrador'),
('telefone_suporte', '(91) 99999-9999', 'STRING', 'Telefone de suporte'),
('ativo', 'true', 'BOOLEAN', 'Sistema ativo'),
('modo_manutencao', 'false', 'BOOLEAN', 'Modo manutenção')
ON CONFLICT (chave) DO NOTHING;
