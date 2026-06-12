import { z } from 'zod';

// ── Campanhas ─────────────────────────────────────────────────

export const createCampaignSchema = z.object({
  name:         z.string().min(3).max(120),
  channel:      z.enum(['whatsapp']).default('whatsapp'),
  priority:     z.number().int().min(1).max(5).default(3),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  settings:     z.record(z.unknown()).optional().default({}),
});

export const addCampaignMessageSchema = z
  .object({
    sequence:   z.number().int().min(1),
    content:    z.string().optional(),
    media_url:  z.string().url().optional(),
    media_type: z.enum(['image', 'video', 'audio', 'document']).optional(),
    is_active:  z.boolean().default(true),
    metadata:   z.record(z.unknown()).optional().default({}),
  })
  .refine((d) => d.content || d.media_url, {
    message: 'Informe ao menos "content" ou "media_url"',
  });

export const addContactsToCampaignSchema = z.object({
  contact_ids: z
    .array(z.string().uuid())
    .min(1, 'Informe ao menos 1 contato')
    .max(10_000, 'Máximo 10.000 contatos por lote'),
});

export type CreateCampaignInput         = z.infer<typeof createCampaignSchema>;
export type AddCampaignMessageInput     = z.infer<typeof addCampaignMessageSchema>;
export type AddContactsToCampaignInput  = z.infer<typeof addContactsToCampaignSchema>;
