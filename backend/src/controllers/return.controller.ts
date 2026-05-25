import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createReturnSchema, updateReturnStatusSchema, updateReturnSchema } from '../schemas/return.schema';

function getDayRange(dateStr?: string): { gte: Date; lt: Date } {
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { gte: start, lt: end };
}

const returnInclude = {
  client: { select: { id: true, name: true, address: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, category: true, price: true } } } },
};

export async function getReturns(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user!.role === 'ADMIN';
  const { date, staffId, clientId } = req.query as { date?: string; staffId?: string; clientId?: string };

  const where: Record<string, unknown> = {};

  if (date !== 'all') {
    where.returnDate = getDayRange(date);
  }

  if (isAdmin && clientId) {
    where.clientId = clientId;
  } else if (isAdmin && staffId) {
    where.staffId = staffId;
  } else if (!isAdmin) {
    where.staffId = req.user!.userId;
    if (clientId) where.clientId = clientId;
  }

  const raw = await prisma.return.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: returnInclude,
  });

  const clientIds = [...new Set(raw.map((r) => r.clientId))];
  const clientPrices = await prisma.clientProductPrice.findMany({
    where: { clientId: { in: clientIds } },
  });
  const priceMap = new Map<string, number>();
  for (const cp of clientPrices) {
    priceMap.set(`${cp.clientId}:${cp.productId}`, Number(cp.price));
  }

  const returns = raw.map((r) => ({
    ...r,
    totalPrice: r.items.reduce((sum, item) => {
      const unit = priceMap.get(`${r.clientId}:${item.productId}`) ?? Number(item.product.price);
      return sum + unit * item.quantity;
    }, 0),
  }));

  res.json({ returns, total: returns.length });
}

export async function getReturn(req: Request, res: Response): Promise<void> {
  const ret = await prisma.return.findUnique({
    where: { id: req.params.id },
    include: returnInclude,
  });

  if (!ret) {
    res.status(404).json({ message: 'Kthimi nuk u gjet' });
    return;
  }

  if (req.user!.role === 'STAFF' && ret.staffId !== req.user!.userId) {
    res.status(403).json({ message: 'Nuk keni akses në këtë kthim' });
    return;
  }

  res.json({ return: ret });
}

export async function createReturn(req: Request, res: Response): Promise<void> {
  const result = createReturnSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Gabim validimi', errors: result.error.flatten().fieldErrors });
    return;
  }

  const { clientId, notes, returnDate, items } = result.data;

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

  const ret = await prisma.return.create({
    data: {
      clientId,
      staffId: req.user!.userId,
      notes,
      returnDate: returnDate ? new Date(returnDate) : new Date(),
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
    },
    include: returnInclude,
  });

  res.status(201).json({ return: ret });
}

export async function updateReturn(req: Request, res: Response): Promise<void> {
  const result = updateReturnSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Gabim validimi', errors: result.error.flatten().fieldErrors });
    return;
  }

  const ret = await prisma.return.findUnique({ where: { id: req.params.id } });
  if (!ret) {
    res.status(404).json({ message: 'Kthimi nuk u gjet' });
    return;
  }

  if (req.user!.role === 'STAFF' && ret.staffId !== req.user!.userId) {
    res.status(403).json({ message: 'Nuk keni akses në këtë kthim' });
    return;
  }

  const { notes, items } = result.data;

  await prisma.returnItem.deleteMany({ where: { returnId: req.params.id } });
  const updated = await prisma.return.update({
    where: { id: req.params.id },
    data: {
      notes,
      items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
    },
    include: returnInclude,
  });

  res.json({ return: updated });
}

export async function updateReturnStatus(req: Request, res: Response): Promise<void> {
  const result = updateReturnStatusSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Gabim validimi', errors: result.error.flatten().fieldErrors });
    return;
  }

  const ret = await prisma.return.findUnique({ where: { id: req.params.id } });
  if (!ret) {
    res.status(404).json({ message: 'Kthimi nuk u gjet' });
    return;
  }

  if (req.user!.role === 'STAFF' && ret.staffId !== req.user!.userId) {
    res.status(403).json({ message: 'Nuk keni akses në këtë kthim' });
    return;
  }

  const updated = await prisma.return.update({
    where: { id: req.params.id },
    data: { status: result.data.status },
    include: returnInclude,
  });

  res.json({ return: updated });
}

export async function toggleReturnPaid(req: Request, res: Response): Promise<void> {
  const ret = await prisma.return.findUnique({ where: { id: req.params.id } });
  if (!ret) {
    res.status(404).json({ message: 'Kthimi nuk u gjet' });
    return;
  }

  if (req.user!.role === 'STAFF' && ret.staffId !== req.user!.userId) {
    res.status(403).json({ message: 'Nuk keni akses në këtë kthim' });
    return;
  }

  const updated = await prisma.return.update({
    where: { id: req.params.id },
    data: { isPaid: !ret.isPaid },
    include: returnInclude,
  });

  res.json({ return: updated });
}

export async function deleteReturn(req: Request, res: Response): Promise<void> {
  const ret = await prisma.return.findUnique({ where: { id: req.params.id } });
  if (!ret) {
    res.status(404).json({ message: 'Kthimi nuk u gjet' });
    return;
  }

  await prisma.return.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
