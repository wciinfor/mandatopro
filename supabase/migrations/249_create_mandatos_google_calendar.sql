-- Migration 249: Tabela de conexões Google Calendar por Mandato (Sprint AGENDA-GCAL 02)
-- Garante a relação 1:1 entre um mandato (Estadual = 1, Federal = 2) e sua conta oficial do Google Calendar

CREATE TABLE IF NOT EXISTS mandatos_google_calendar (
    mandato_id BIGINT PRIMARY KEY REFERENCES mandatos(id) ON DELETE CASCADE,
    google_calendar_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'CONECTADO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice explicito para consultas rápidas por status e mandato
CREATE INDEX IF NOT EXISTS idx_mandatos_gcal_mandato_status ON mandatos_google_calendar(mandato_id, status);
