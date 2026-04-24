import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createClientSchema, updateClientSchema } from '../schemas/client.schema';

export async function getClients(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user!.role === 'ADMIN';
  const staffIdFilter = req.query.staffId as string | undefined;

  const where: Record<string, unknown> = { isActive: true };
  if (isAdmin && staffIdFilter) {
    where.staffId = staffIdFilter;
  } else if (!isAdmin) {
    where.staffId = req.user!.userId;
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });

  res.json({ clients, total: clients.length });
}

export async function getClient(req: Request, res: Response): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      prices: { include: { product: { select: { id: true, name: true, category: true } } } },
      deliveries: {
        orderBy: { deliveryDate: 'desc' },
        take: 10,
        include: { items: { include: { product: { select: { id: true, name: true } } } } },
      },
    },
  });

  if (!client || !client.isActive) {
    res.status(404).json({ message: 'Klienti nuk u gjet' });
    return;
  }

  if (req.user!.role === 'STAFF' && client.staffId !== req.user!.userId) {
    res.status(403).json({ message: 'Nuk keni akses në këtë klient' });
    return;
  }

  res.json({ client });
}

export async function createClient(req: Request, res: Response): Promise<void> {
  const result = createClientSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Gabim validimi', errors: result.error.flatten().fieldErrors });
    return;
  }

  const staffUser = await prisma.user.findFirst({
    where: { id: result.data.staffId, role: 'STAFF' },
  });
  if (!staffUser) {
    res.status(400).json({ message: 'Shpërndarësi i zgjedhur nuk ekziston' });
    return;
  }

  const client = await prisma.client.create({ data: result.data });
  res.status(201).json({ client });
}

export async function updateClient(req: Request, res: Response): Promise<void> {
  const result = updateClientSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Gabim validimi', errors: result.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!existing || !existing.isActive) {
    res.status(404).json({ message: 'Klienti nuk u gjet' });
    return;
  }

  if (result.data.staffId) {
    const staffUser = await prisma.user.findFirst({
      where: { id: result.data.staffId, role: 'STAFF' },
    });
    if (!staffUser) {
      res.status(400).json({ message: 'Shpërndarësi i zgjedhur nuk ekziston' });
      return;
    }
  }

  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: result.data,
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });
  res.json({ client });
}

export async function upsertClientPrice(req: Request, res: Response): Promise<void> {
  const { clientId, productId } = req.params;
  const price = Number(req.body.price);

  if (isNaN(price) || price < 0) {
    res.status(400).json({ message: 'Çmimi i pavlefshëm' });
    return;
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || !client.isActive) {
    res.status(404).json({ message: 'Klienti nuk u gjet' });
    return;
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    res.status(404).json({ message: 'Produkti nuk u gjet' });
    return;
  }

  const entry = await prisma.clientProductPrice.upsert({
    where: { clientId_productId: { clientId, productId } },
    update: { price },
    create: { clientId, productId, price },
    include: { product: { select: { id: true, name: true, category: true } } },
  });

  res.json({ price: entry });
}

export async function deleteClient(req: Request, res: Response): Promise<void> {
  const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!existing || !existing.isActive) {
    res.status(404).json({ message: 'Klienti nuk u gjet' });
    return;
  }

  await prisma.client.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.status(204).send();
}
