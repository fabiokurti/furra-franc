import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

function todayDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function tomorrowDate() {
  const d = todayDate();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

async function fetchEntryWithDelivered(id: string) {
  const entry = await prisma.dailyStock.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { id: true, name: true, category: true } } } },
    },
  });
  if (!entry) return null;

  const start = new Date(entry.date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const deliveryItems = await prisma.deliveryItem.findMany({
    where: { delivery: { deliveryDate: { gte: start, lt: end } } },
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

  return { ...entry, items };
}

export async function getAll(_req: Request, res: Response): Promise<void> {
  const entries = await prisma.dailyStock.findMany({
    orderBy: { date: 'desc' },
    include: {
      items: { include: { product: { select: { id: true, name: true, category: true } } } },
    },
  });

  // Batch-fetch all delivery items for all dates
  const allDeliveryItems = await prisma.deliveryItem.findMany({
    select: { productId: true, quantity: true, delivery: { select: { deliveryDate: true } } },
  });

  const result = entries.map((entry) => {
    const start = new Date(entry.date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const delivered: Record<string, number> = {};
    for (const di of allDeliveryItems) {
      const dd = new Date(di.delivery.deliveryDate);
      if (dd >= start && dd < end) {
        delivered[di.productId] = (delivered[di.productId] ?? 0) + di.quantity;
      }
    }

    const items = entry.items.map((item) => ({
      ...item,
      delivered: delivered[item.productId] ?? 0,
      remaining: item.quantity - (delivered[item.productId] ?? 0),
    }));

    return { ...entry, items };
  });

  res.json({ entries: result });
}

export async function getToday(_req: Request, res: Response): Promise<void> {
  const date = todayDate();

  const entry = await prisma.dailyStock.findUnique({ where: { date } });
  if (!entry) {
    res.json({ entry: null });
    return;
  }

  const full = await fetchEntryWithDelivered(entry.id);
  res.json({ entry: full });
}

export async function createToday(req: Request, res: Response): Promise<void> {
  const { items, date: dateStr } = req.body as {
    items: { productId: string; quantity: number }[];
    date?: string;
  };

  let date: Date;
  if (dateStr) {
    const d = new Date(dateStr);
    date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  } else {
    date = todayDate();
  }

  const existing = await prisma.dailyStock.findUnique({ where: { date } });
  if (existing) {
    res.status(409).json({ message: 'Prodhimi për këtë datë është hapur tashmë' });
    return;
  }

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
      items: { include: { product: { select: { id: true, name: true, category: true } } } },
    },
  });

  res.status(201).json({ entry });
}

export async function addItems(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { items } = req.body as { items: { productId: string; quantity: number }[] };

  const entry = await prisma.dailyStock.findUnique({ where: { id } });
  if (!entry) { res.status(404).json({ message: 'Nuk u gjet' }); return; }
  if (entry.status === 'CLOSED') { res.status(409).json({ message: 'Prodhimi është mbyllur' }); return; }

  const toAdd = items.filter((i) => i.quantity > 0);
  for (const item of toAdd) {
    const existing = await prisma.dailyStockItem.findFirst({
      where: { dailyStockId: id, productId: item.productId },
    });
    if (existing) {
      await prisma.dailyStockItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: item.quantity } },
      });
    } else {
      await prisma.dailyStockItem.create({
        data: { dailyStockId: id, productId: item.productId, quantity: item.quantity },
      });
    }
  }

  const full = await fetchEntryWithDelivered(id);
  res.json({ entry: full });
}

export async function closeDay(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const entry = await prisma.dailyStock.findUnique({ where: { id } });
  if (!entry) { res.status(404).json({ message: 'Nuk u gjet' }); return; }
  if (entry.status === 'CLOSED') { res.status(409).json({ message: 'Prodhimi është mbyllur tashmë' }); return; }

  await prisma.dailyStock.update({ where: { id }, data: { status: 'CLOSED' } });
  res.json({ ok: true });
}

export async function reopenDay(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const entry = await prisma.dailyStock.findUnique({ where: { id } });
  if (!entry) { res.status(404).json({ message: 'Nuk u gjet' }); return; }
  if (entry.status === 'OPEN') { res.status(409).json({ message: 'Prodhimi është hapur tashmë' }); return; }

  await prisma.dailyStock.update({ where: { id }, data: { status: 'OPEN' } });
  const full = await fetchEntryWithDelivered(id);
  res.json({ entry: full });
}

export async function deleteDay(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const entry = await prisma.dailyStock.findUnique({ where: { id } });
  if (!entry) { res.status(404).json({ message: 'Nuk u gjet' }); return; }

  await prisma.dailyStockItem.deleteMany({ where: { dailyStockId: id } });
  await prisma.dailyStock.delete({ where: { id } });
  res.status(204).send();
}
