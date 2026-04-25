import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { registerSchema, loginSchema } from '../schemas/auth.schema';

export async function register(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error', errors: result.error.flatten().fieldErrors });
    return;
  }

  const { name, email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: 'Email already in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.status(201).json({ user, token });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error', errors: result.error.flatten().fieldErrors });
    return;
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser, token });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json({ user });
}

export async function getStaffUsers(_req: Request, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: 'STAFF' },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json({ users });
}

export async function updateStaff(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, email } = req.body as { name?: string; email?: string };

  const staff = await prisma.user.findFirst({ where: { id, role: 'STAFF' } });
  if (!staff) {
    res.status(404).json({ message: 'Shpërndarësi nuk u gjet' });
    return;
  }

  if (email && email !== staff.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(email?.trim() && { email: email.trim() }),
    },
    select: { id: true, name: true, email: true, role: true },
  });

  res.json({ user: updated });
}

export async function createStaff(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error', errors: result.error.flatten().fieldErrors });
    return;
  }

  const { name, email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: 'Email already in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: 'STAFF' },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  res.status(201).json({ user });
}

export async function createBusinessUser(req: Request, res: Response): Promise<void> {
  const { name, email, password, clientId } = req.body as {
    name: string; email: string; password: string; clientId: string;
  };

  if (!name || !email || !password || !clientId) {
    res.status(400).json({ message: 'Të gjitha fushat janë të detyrueshme' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) { res.status(409).json({ message: 'Email already in use' }); return; }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { businessUser: { select: { id: true } } },
  });
  if (!client) { res.status(404).json({ message: 'Klienti nuk u gjet' }); return; }

  if (client.businessUser) {
    res.status(409).json({ message: 'Ky klient ka tashmë një llogari biznesi' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: 'BUSINESS', clientId },
    select: { id: true, name: true, email: true, role: true, clientId: true, createdAt: true },
  });

  res.status(201).json({ user });
}
