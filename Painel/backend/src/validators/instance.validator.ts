import { z } from 'zod';

// ── Instâncias ────────────────────────────────────────────────

export const createInstanceSchema = z.object({
  name: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(60)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Somente letras, números, _ ou -'),
  apikey:   z.string().min(10, 'apikey muito curta'),
  provider: z.enum(['evolution']).default('evolution'),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const updateInstanceSchema = z.object({
  apikey:   z.string().min(10).optional(),
  provider: z.enum(['evolution']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type UpdateInstanceInput = z.infer<typeof updateInstanceSchema>;
