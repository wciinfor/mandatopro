-- =============================================================
-- Migration: Fundação de Mandatos e Associação N:N de Usuários
-- Sprint: P2.2
--
-- Tabelas criadas:
-- 1. mandatos (Armazena os mandatos do sistema)
-- 2. usuarios_mandatos (Associação N:N entre usuários e mandatos)
--
-- Regras de Segurança: Idempotente, totalmente reversível e não-destrutiva.
-- =============================================================

-- 1. Criar tabela `mandatos`
CREATE TABLE IF NOT EXISTS public.mandatos (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('ESTADUAL', 'FEDERAL')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criar tabela de junção `usuarios_mandatos`
CREATE TABLE IF NOT EXISTS public.usuarios_mandatos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  mandato_id BIGINT NOT NULL REFERENCES public.mandatos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_usuario_mandato UNIQUE (usuario_id, mandato_id)
);

-- 3. Criar Índices de Performance
CREATE INDEX IF NOT EXISTS idx_usuarios_mandatos_usuario_id ON public.usuarios_mandatos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_mandatos_mandato_id ON public.usuarios_mandatos(mandato_id);

-- 4. Inserir exatamente os dois mandatos iniciais (se não existirem)
INSERT INTO public.mandatos (id, nome, tipo, ativo)
VALUES 
  (1, 'Deputado Estadual', 'ESTADUAL', true),
  (2, 'Deputada Federal', 'FEDERAL', true)
ON CONFLICT (id) DO UPDATE 
SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo;

-- Ajustar a sequência da tabela mandatos
SELECT setval('mandatos_id_seq', (SELECT MAX(id) FROM public.mandatos));
