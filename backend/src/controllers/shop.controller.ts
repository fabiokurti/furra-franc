import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// ── Shop Products ──────────────────────────────────────────────────

export async function getShopProducts(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  const targetUserId = isAdmin && req.query.userId ? String(req.query.userId) : userId;

  const products = await prisma.shopProduct.findMany({
    where: { userId: targetUserId, isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json({ products });
}

export async function createShopProduct(req: Request, res: Response): Promise<void> {
  const { name, price } = req.body as { name: string; price: number };
  if (!name?.trim() || price == null) {
    res.status(400).json({ message: 'Emri dhe çmimi janë të detyrueshëm' });
    return;
  }
  const product = await prisma.shopProduct.create({
    data: { name: name.trim(), price, userId: req.user!.userId },
  });
  res.status(201).json({ product });
}

export async function updateShopProduct(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const existing = await prisma.shopProduct.findFirst({ where: { id, userId: req.user!.userId } });
  if (!existing) { res.status(404).json({ message: 'Nuk u gjet' }); return; }

  const product = await prisma.shopProduct.update({
    where: { id },
    data: { name: req.body.name?.trim() ?? existing.name, price: req.body.price ?? existing.price },
  });
  res.json({ product });
}

export async function deleteShopProduct(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const existing = await prisma.shopProduct.findFirst({ where: { id, userId: req.user!.userId } });
  if (!existing) { res.status(404).json({ message: 'Nuk u gjet' }); return; }
  await prisma.shopProduct.update({ where: { id }, data: { isActive: false } });
  res.status(204).send();
}

// ── Shop Sales ─────────────────────────────────────────────────────

export async function getShopSales(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user!.role === 'ADMIN';
  const userId = req.user!.userId;

  const where = isAdmin && req.query.userId
    ? { userId: String(req.query.userId) }
    : isAdmin
    ? {}
    : { userId };

  const today = new Date();
  const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  const dateFilter = req.query.date === 'all' ? {} : { saleDate: { gte: start, lt: end } };

  const sales = await prisma.shopSale.findMany({
    where: { ...where, ...dateFilter },
    include: {
      user: { select: { id: true, name: true, clientId: true } },
      items: { include: { shopProduct: { select: { id: true, name: true } } } },
    },
    orderBy: { saleDate: 'desc' },
  });
  res.json({ sales });
}

export async function createShopSale(req: Request, res: Response): Promise<void> {
  const { items, notes } = req.body as {
    items: { shopProductId: string; quantity: number; unitPrice: number }[];
    notes?: string;
  };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'Zgjidhni të paktën një produkt' });
    return;
  }

  const sale = await prisma.shopSale.create({
    data: {
      userId: req.user!.userId,
      notes,
      items: { create: items.map((i) => ({ shopProductId: i.shopProductId, quantity: i.quantity, unitPrice: i.unitPrice })) },
    },
    include: {
      items: { include: { shopProduct: { select: { id: true, name: true } } } },
    },
  });
  res.status(201).json({ sale });
}

export async function deleteShopSale(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const isAdmin = req.user!.role === 'ADMIN';
  const sale = await prisma.shopSale.findUnique({ where: { id } });
  if (!sale) { res.status(404).json({ message: 'Nuk u gjet' }); return; }
  if (!isAdmin && sale.userId !== req.user!.userId) { res.status(403).json({ message: 'Akses i ndaluar' }); return; }
  await prisma.shopSale.delete({ where: { id } });
  res.status(204).send();
}

// ── Deliveries for business user's client ─────────────────────────
export async function getMyDeliveries(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { clientId: true },
  });

  if (!user?.clientId) {
    res.json({ deliveries: [] });
    return;
  }

  const today = new Date();
  const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const deliveries = await prisma.delivery.findMany({
    where: { clientId: user.clientId, deliveryDate: { gte: start, lt: end } },
    include: {
      items: { include: { product: { select: { id: true, name: true, category: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ deliveries });
}

// ── Create business user account ───────────────────────────────────
export async function getAllShopSalesAdmin(req: Request, res: Response): Promise<void> {
  const sales = await prisma.shopSale.findMany({
    include: {
      user: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
      items: { include: { shopProduct: { select: { id: true, name: true } } } },
    },
    orderBy: { saleDate: 'desc' },
    take: 100,
  });
  res.json({ sales });
}
