-- Create financeiro tables
CREATE TABLE IF NOT EXISTS financeiro_parceiros (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(30) UNIQUE,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('PESSOA_FISICA', 'PESSOA_JURIDICA', 'OUTROS')),
  cpf VARCHAR(14),
  cnpj VARCHAR(18),
  email VARCHAR(255),
  telefone VARCHAR(30),
  endereco VARCHAR(255),
  observacoes TEXT,
  status VARCHAR(20) DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  ativo BOOLEAN DEFAULT true,
  criado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  atualizado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  deleted_by BIGINT REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(30) UNIQUE,
  data_lancamento DATE NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('DOACAO', 'EMENDA', 'PARCERIA', 'OUTROS')),
  categoria VARCHAR(100),
  parceiro_id BIGINT REFERENCES financeiro_parceiros(id) ON DELETE SET NULL,
  parceiro_nome VARCHAR(255),
  valor NUMERIC(12, 2) NOT NULL,
  forma_pagamento VARCHAR(30),
  descricao TEXT,
  comprovante_url TEXT,
  status VARCHAR(20) DEFAULT 'PENDENTE' CHECK (status IN ('CONFIRMADO', 'PENDENTE', 'CANCELADO')),
  ativo BOOLEAN DEFAULT true,
  criado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  atualizado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  deleted_by BIGINT REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS financeiro_despesas (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(30) UNIQUE,
  data_despesa DATE NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('CAMPANHA', 'OPERACIONAL', 'EMENDA', 'OUTROS')),
  categoria VARCHAR(100),
  fornecedor_nome VARCHAR(255),
  parceiro_id BIGINT REFERENCES financeiro_parceiros(id) ON DELETE SET NULL,
  valor NUMERIC(12, 2) NOT NULL,
  forma_pagamento VARCHAR(30),
  vencimento DATE,
  nota_fiscal VARCHAR(100),
  descricao TEXT,
  status VARCHAR(20) DEFAULT 'PENDENTE' CHECK (status IN ('PAGO', 'PENDENTE', 'CANCELADO')),
  ativo BOOLEAN DEFAULT true,
  criado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  atualizado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  deleted_by BIGINT REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Backward compatibility: add canonical date columns and backfill if older schemas exist.
ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS data_lancamento DATE;

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS data_despesa DATE;

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS parceiro_id BIGINT;

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS parceiro_nome VARCHAR(255);

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS parceiro_id BIGINT;

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS fornecedor_nome VARCHAR(255);

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(30);

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(30);

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS comprovante_url TEXT;

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS criado_por BIGINT;

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS atualizado_por BIGINT;

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(30);

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(30);

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(30);

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS vencimento DATE;

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS nota_fiscal VARCHAR(100);

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS criado_por BIGINT;

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS atualizado_por BIGINT;

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE financeiro_despesas
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_lancamentos' AND column_name = 'data'
  ) THEN
    EXECUTE 'UPDATE financeiro_lancamentos SET data_lancamento = data WHERE data_lancamento IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_lancamentos' AND column_name = 'data_recebimento'
  ) THEN
    EXECUTE 'UPDATE financeiro_lancamentos SET data_lancamento = data_recebimento WHERE data_lancamento IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_despesas' AND column_name = 'data'
  ) THEN
    EXECUTE 'UPDATE financeiro_despesas SET data_despesa = data WHERE data_despesa IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_despesas' AND column_name = 'data_pagamento'
  ) THEN
    EXECUTE 'UPDATE financeiro_despesas SET data_despesa = data_pagamento WHERE data_despesa IS NULL';
  END IF;

  EXECUTE 'UPDATE financeiro_lancamentos SET ativo = true WHERE ativo IS NULL';
  EXECUTE 'UPDATE financeiro_lancamentos SET status = ''PENDENTE'' WHERE status IS NULL';
  EXECUTE 'UPDATE financeiro_despesas SET ativo = true WHERE ativo IS NULL';
  EXECUTE 'UPDATE financeiro_despesas SET status = ''PENDENTE'' WHERE status IS NULL';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_lancamentos' AND column_name = 'doador_id'
  ) THEN
    EXECUTE 'UPDATE financeiro_lancamentos SET parceiro_id = doador_id WHERE parceiro_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_lancamentos' AND column_name = 'origem_id'
  ) THEN
    EXECUTE 'UPDATE financeiro_lancamentos SET parceiro_id = origem_id WHERE parceiro_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_lancamentos' AND column_name = 'doador_nome'
  ) THEN
    EXECUTE 'UPDATE financeiro_lancamentos SET parceiro_nome = doador_nome WHERE parceiro_nome IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_lancamentos' AND column_name = 'doador'
  ) THEN
    EXECUTE 'UPDATE financeiro_lancamentos SET parceiro_nome = doador WHERE parceiro_nome IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_lancamentos' AND column_name = 'origem'
  ) THEN
    EXECUTE 'UPDATE financeiro_lancamentos SET parceiro_nome = origem WHERE parceiro_nome IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_despesas' AND column_name = 'fornecedor'
  ) THEN
    EXECUTE 'UPDATE financeiro_despesas SET fornecedor_nome = fornecedor WHERE fornecedor_nome IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_despesas' AND column_name = 'parceiro_nome'
  ) THEN
    EXECUTE 'UPDATE financeiro_despesas SET fornecedor_nome = parceiro_nome WHERE fornecedor_nome IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_despesas' AND column_name = 'fornecedor_id'
  ) THEN
    EXECUTE 'UPDATE financeiro_despesas SET parceiro_id = fornecedor_id WHERE parceiro_id IS NULL';
  END IF;
END $$;

CREATE OR REPLACE VIEW financeiro_movimentacoes AS
SELECT
  l.id,
  'LANCAMENTO'::text AS origem,
  'ENTRADA'::text AS direcao,
  l.data_lancamento AS data_movimento,
  l.tipo,
  l.categoria,
  l.parceiro_id,
  l.parceiro_nome AS parceiro_nome,
  l.valor,
  l.descricao,
  l.status,
  l.created_at
FROM financeiro_lancamentos l
WHERE l.ativo = true
UNION ALL
SELECT
  d.id,
  'DESPESA'::text AS origem,
  'SAIDA'::text AS direcao,
  d.data_despesa AS data_movimento,
  d.tipo,
  d.categoria,
  d.parceiro_id,
  d.fornecedor_nome AS parceiro_nome,
  d.valor,
  d.descricao,
  d.status,
  d.created_at
FROM financeiro_despesas d
WHERE d.ativo = true;

CREATE INDEX IF NOT EXISTS idx_financeiro_parceiros_nome ON financeiro_parceiros(nome);
CREATE INDEX IF NOT EXISTS idx_financeiro_parceiros_tipo ON financeiro_parceiros(tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_parceiros_status ON financeiro_parceiros(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_data ON financeiro_lancamentos(data_lancamento);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_status ON financeiro_lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_tipo ON financeiro_lancamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_categoria ON financeiro_lancamentos(categoria);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_parceiro ON financeiro_lancamentos(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_despesas_data ON financeiro_despesas(data_despesa);
CREATE INDEX IF NOT EXISTS idx_financeiro_despesas_status ON financeiro_despesas(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_despesas_tipo ON financeiro_despesas(tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_despesas_categoria ON financeiro_despesas(categoria);
CREATE INDEX IF NOT EXISTS idx_financeiro_despesas_parceiro ON financeiro_despesas(parceiro_id);
