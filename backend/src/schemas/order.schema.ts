import { z } from 'zod';

const OrderStatusEnum = z.enum(['PENDING', 'CONFIRMED', 'BAKING', 'READY', 'DELIVERED', 'CANCELLED']);

export const createOrderSchema = z.object({
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Invalid product ID'),
        quantity: z.number().int().positive('Quantity must be positive'),
      })
    )
    .min(1, 'Order must have at least one item'),
});

export const updateOrderStatusSchema = z.object({
  status: OrderStatusEnum,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
