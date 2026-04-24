import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(1, 'Emri është i detyrueshëm'),
  address: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  staffId: z.string().uuid('ID i stafit është i pavlefshëm'),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
