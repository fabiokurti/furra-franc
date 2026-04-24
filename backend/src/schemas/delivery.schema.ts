import { z } from 'zod';

const DeliveryStatusEnum = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);

export const createDeliverySchema = z.object({
  clientId: z.string().min(1, 'Zgjidhni një klient'),
  notes: z.string().optional(),
  deliveryDate: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Zgjidhni produktin'),
        quantity: z.number().int().positive('Sasia duhet të jetë pozitive'),
      })
    )
    .min(1, 'Dërgimi duhet të ketë të paktën një artikull'),
});

export const updateDeliveryStatusSchema = z.object({
  status: DeliveryStatusEnum,
});

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
