import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createDeliverySchema, updateDeliveryStatusSchema } from '../schemas/delivery.schema';

function getDayRange(dateStr?: string): { gte: Date; lt: Date } {
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { gte: start, lt: end };
}

const deliveryInclude = {
  client: { select: { id: true, name: true, address: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, category: true } } } },
};

export async function getDeliveries(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user!.role === 'ADMIN';
  const { date, staffId } = req.query as { date?: string; staffId?: string };

  const dateRange = getDayRange(date);
  const where: Record<string, unknown> = { deliveryDate: dateRange };

  if (isAdmin && staffId) {
    where.staffId = staffId;
  } else if (!isAdmin) {
    where.staffId = req.user!.userId;
  }

  const deliveries = await prisma.delivery.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: deliveryInclude,
  });

  res.json({ deliveries, total: deliveries.length });
}

export async function getDelivery(req: Request, res: Response): Promise<void> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: req.params.id },
    include: deliveryInclude,
  });

  if (!delivery) {
    res.status(404).json({ message: 'Dërgimi nuk u gjet' });
    return;
  }

  if (req.user!.role === 'STAFF' && delivery.staffId !== req.user!.userId) {
    res.status(403).json({ message: 'Nuk keni akses në këtë dërgim' });
    return;
  }

  res.json({ delivery });
}

export async function createDelivery(req: Request, res: Response): Promise<void> {
  const result = createDeliverySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Gabim validimi', errors: result.error.flatten().fieldErrors });
    return;
  }

  const { clientId, notes, deliveryDate, items } = result.data;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || !client.isActive) {
    res.status(404).json({ message: 'Klienti nuk u gjet' });
    return;
  }

  if (req.user!.role === 'STAFF' && client.staffId !== req.user!.userId) {
    res.status(403).json({ message: 'Ky klient nuk është i juaji' });
    return;
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, isActive: true },
  });
  if (products.length !== items.length) {
    res.status(400).json({ message: 'Një ose më shumë produkte nuk u gjetën' });
    return;
  }

  const delivery = await prisma.delivery.create({
    data: {
      clientId,
      staffId: req.user!.userId,
      notes,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
    },
    include: deliveryInclude,
  });

  res.status(201).json({ delivery });
}

export async function updateDeliveryStatus(req: Request, res: Response): Promise<void> {
  const result = updateDeliveryStatusSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Gabim validimi', errors: result.error.flatten().fieldErrors });
    return;
  }

  const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
  if (!delivery) {
    res.status(404).json({ message: 'Dërgimi nuk u gjet' });
    return;
  }

  if (req.user!.role === 'STAFF' && delivery.staffId !== req.user!.userId) {
    res.status(403).json({ message: 'Nuk keni akses në këtë dërgim' });
    return;
  }

  const updated = await prisma.delivery.update({
    where: { id: req.params.id },
    data: { status: result.data.status },
    include: deliveryInclude,
  });

  res.json({ delivery: updated });
}

export async function toggleDeliveryPaid(req: Request, res: Response): Promise<void> {
  const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
  if (!delivery) {
    res.status(404).json({ message: 'Dërgimi nuk u gjet' });
    return;
  }

  if (req.user!.role === 'STAFF' && delivery.staffId !== req.user!.userId) {
    res.status(403).json({ message: 'Nuk keni akses në këtë dërgim' });
    return;
  }

  const updated = await prisma.delivery.update({
    where: { id: req.params.id },
    data: { isPaid: !delivery.isPaid },
    include: deliveryInclude,
  });

  res.json({ delivery: updated });
}

export async function deleteDelivery(req: Request, res: Response): Promise<void> {
  const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
  if (!delivery) {
    res.status(404).json({ message: 'Dërgimi nuk u gjet' });
    return;
  }

  await prisma.delivery.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
