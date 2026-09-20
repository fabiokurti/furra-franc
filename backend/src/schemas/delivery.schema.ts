import { z } from 'zod';

const DeliveryStatusEnum = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);

const deliveryItemSchema = z
  .object({
    productId: z.string().min(1, 'Zgjidhni produktin'),
    quantity: z.number().int().positive('Sasia duhet të jetë pozitive'),
    returnedQuantity: z.number().int().min(0, 'Sasia e kthyer duhet të jetë pozitive').default(0),
  })
  .refine((item) => item.returnedQuantity <= item.quantity, {
    message: 'Sasia e kthyer nuk mund të jetë më e madhe se sasia',
    path: ['returnedQuantity'],
  });

export const createDeliverySchema = z.object({
  clientId: z.string().min(1, 'Zgjidhni një klient'),
  notes: z.string().optional(),
  deliveryDate: z.string().optional(),
  items: z.array(deliveryItemSchema).min(1, 'Dërgimi duhet të ketë të paktën një artikull'),
});

export const updateDeliveryStatusSchema = z.object({
  status: DeliveryStatusEnum,
});

export const updateDeliverySchema = z.object({
  notes: z.string().optional(),
  items: z.array(deliveryItemSchema).min(1, 'Dërgimi duhet të ketë të paktën një artikull'),
});

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
