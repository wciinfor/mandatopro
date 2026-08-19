-- Migration para adicionar a coluna unread_count na tabela communication_conversations
ALTER TABLE public.communication_conversations
ADD COLUMN IF NOT EXISTS unread_count INT DEFAULT 0;
