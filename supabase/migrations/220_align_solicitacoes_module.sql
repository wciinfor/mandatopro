-- Align solicitacoes table with application requirements

BEGIN;

ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS documentos JSONB,
  ADD COLUMN IF NOT EXISTS lideranca_id BIGINT REFERENCES liderancas(id);

UPDATE solicitacoes SET status = 'RECEBIDO' WHERE status = 'EM_ANDAMENTO';
UPDATE solicitacoes SET status = 'ATENDIDO' WHERE status = 'ATENDIDA';
UPDATE solicitacoes SET status = 'RECUSADO' WHERE status = 'RECUSADA';

ALTER TABLE solicitacoes
  DROP CONSTRAINT IF EXISTS solicitacoes_status_check,
  ADD CONSTRAINT solicitacoes_status_check
    CHECK (status IN ('NOVO', 'RECEBIDO', 'ATENDIDO', 'RECUSADO'));

ALTER TABLE solicitacoes
  DROP CONSTRAINT IF EXISTS solicitacoes_tipo_solicitante_check,
  ADD CONSTRAINT solicitacoes_tipo_solicitante_check
    CHECK (tipo_solicitante IN ('ADMINISTRADOR', 'LIDERANCA', 'MORADOR', 'FUNCIONARIO'));

CREATE INDEX IF NOT EXISTS idx_solicitacoes_email ON solicitacoes(email);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_lideranca_id ON solicitacoes(lideranca_id);

COMMIT;
