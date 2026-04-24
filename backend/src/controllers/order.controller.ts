import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createOrderSchema, updateOrderStatusSchema } from '../schemas/order.schema';

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'BAKING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export async function getOrders(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const status = req.query.status as OrderStatus | undefined;

  const where = status ? { status } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      items: { include: { product: true } },
    },
  });

  if (!order) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  res.json({ order });
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const result = createOrderSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error', errors: result.error.flatten().fieldErrors });
    return;
  }

  const { notes, items } = result.data;

  // Fetch prices from DB
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, isActive: true },
  });

  if (products.length !== items.length) {
    res.status(400).json({ message: 'One or more products not found' });
    return;
  }

  const priceMap: Map<string, number> = new Map(products.map((p: { id: string; price: unknown }) => [p.id, Number(p.price)] as [string, number]));
  const totalPrice = items.reduce((sum: number, item) => {
    const price = priceMap.get(item.productId) ?? 0;
    return sum + price * item.quantity;
  }, 0);

  const order = await prisma.order.create({
    data: {
      notes,
      totalPrice,
      userId: req.user!.userId,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: priceMap.get(item.productId)!,
        })),
      },
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true } } } },
    },
  });

  res.status(201).json({ order });
}

export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const result = updateOrderStatusSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error', errors: result.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: result.data.status },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true } } } },
    },
  });

  res.json({ order });
}

export async function togglePaid(req: Request, res: Response): Promise<void> {
  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { isPaid: !existing.isPaid },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true } } } },
    },
  });

  res.json({ order });
}

export async function deleteOrder(req: Request, res: Response): Promise<void> {
  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  await prisma.order.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
