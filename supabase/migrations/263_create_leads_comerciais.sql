-- ==============================================================================
-- Migration: 263_create_leads_comerciais.sql
-- Descrição: Criação da tabela isolada para captação de leads institucionais/comerciais
--            a partir da landing page (mandatopro.com).
--            Totalmente desacoplada dos dados de eleitores, atendimentos e tenants (mandatos).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.leads_comerciais (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cargo VARCHAR(100) NOT NULL,
    instituicao VARCHAR(255) NOT NULL,
    municipio VARCHAR(150),
    uf VARCHAR(2) NOT NULL,
    email VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(50) NOT NULL,
    mensagem TEXT,
    consentimento_lgpd BOOLEAN NOT NULL DEFAULT FALSE,
    origem VARCHAR(100) NOT NULL DEFAULT 'landing_page',
    status VARCHAR(50) NOT NULL DEFAULT 'NOVO', -- 'NOVO', 'EM_CONTATO', 'DEMONSTRACAO_AGENDADA', 'CONCLUIDO', 'DESCARTADO'
    ip_origem VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices estratégicos para triagem comercial e prevenção de duplicidades operacionais
CREATE INDEX IF NOT EXISTS idx_leads_comerciais_email ON public.leads_comerciais (email);
CREATE INDEX IF NOT EXISTS idx_leads_comerciais_whatsapp ON public.leads_comerciais (whatsapp);
CREATE INDEX IF NOT EXISTS idx_leads_comerciais_status ON public.leads_comerciais (status);
CREATE INDEX IF NOT EXISTS idx_leads_comerciais_created_at ON public.leads_comerciais (created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.leads_comerciais ENABLE ROW LEVEL SECURITY;

-- Política de RLS: Nega acesso público direto via cliente anon/browser
-- Toda inserção e leitura é realizada estritamente pelo backend via SERVICE_ROLE_KEY
CREATE POLICY "Acesso negado para anon em leads_comerciais"
    ON public.leads_comerciais
    FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Acesso total exclusivo para service_role em leads_comerciais"
    ON public.leads_comerciais
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.leads_comerciais IS 'Leads institucionais e comerciais captados na landing page mandatopro.com';
