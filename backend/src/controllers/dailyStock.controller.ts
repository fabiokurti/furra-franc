import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

function todayDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function getToday(_req: Request, res: Response): Promise<void> {
  const date = todayDate();

  const entry = await prisma.dailyStock.findUnique({
    where: { date },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, category: true } } },
      },
    },
  });

  if (!entry) {
    res.json({ entry: null });
    return;
  }

  const start = new Date(date);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 1);

  const deliveryItems = await prisma.deliveryItem.findMany({
    where: {
      delivery: { deliveryDate: { gte: start, lt: end } },
    },
    select: { productId: true, quantity: true },
  });

  const delivered: Record<string, number> = {};
  for (const di of deliveryItems) {
    delivered[di.productId] = (delivered[di.productId] ?? 0) + di.quantity;
  }

  const items = entry.items.map((item) => ({
    ...item,
    delivered: delivered[item.productId] ?? 0,
    remaining: item.quantity - (delivered[item.productId] ?? 0),
  }));

  res.json({ entry: { ...entry, items } });
}

export async function createToday(req: Request, res: Response): Promise<void> {
  const date = todayDate();

  const existing = await prisma.dailyStock.findUnique({ where: { date } });
  if (existing) {
    res.status(409).json({ message: 'Stoku për sot është hapur tashmë' });
    return;
  }

  const { items } = req.body as { items: { productId: string; quantity: number }[] };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'Items kërkohen' });
    return;
  }

  const entry = await prisma.dailyStock.create({
    data: {
      date,
      items: {
        create: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      },
    },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, category: true } } },
      },
    },
  });

  res.status(201).json({ entry });
}

export async function closeDay(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const entry = await prisma.dailyStock.findUnique({ where: { id } });
  if (!entry) {
    res.status(404).json({ message: 'Nuk u gjet' });
    return;
  }
  if (entry.status === 'CLOSED') {
    res.status(409).json({ message: 'Dita është mbyllur tashmë' });
    return;
  }

  const updated = await prisma.dailyStock.update({
    where: { id },
    data: { status: 'CLOSED' },
  });

  res.json({ entry: updated });
}
