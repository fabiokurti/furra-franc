import { z } from 'zod';

const ReturnStatusEnum = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);

export const createReturnSchema = z.object({
  clientId: z.string().min(1, 'Zgjidhni një klient'),
  notes: z.string().optional(),
  returnDate: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Zgjidhni produktin'),
        quantity: z.number().int().positive('Sasia duhet të jetë pozitive'),
      })
    )
    .min(1, 'Kthimi duhet të ketë të paktën një artikull'),
});

export const updateReturnStatusSchema = z.object({
  status: ReturnStatusEnum,
});

export const updateReturnSchema = z.object({
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive('Sasia duhet të jetë pozitive'),
      })
    )
    .min(1, 'Kthimi duhet të ketë të paktën një artikull'),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type UpdateReturnStatusInput = z.infer<typeof updateReturnStatusSchema>;
