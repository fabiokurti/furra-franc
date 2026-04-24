import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';

export async function getProducts(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product || !product.isActive) {
    res.status(404).json({ message: 'Product not found' });
    return;
  }
  res.json({ product });
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const result = createProductSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error', errors: result.error.flatten().fieldErrors });
    return;
  }

  const product = await prisma.product.create({ data: result.data });
  res.status(201).json({ product });
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const result = updateProductSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error', errors: result.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing || !existing.isActive) {
    res.status(404).json({ message: 'Product not found' });
    return;
  }

  const product = await prisma.product.update({ where: { id: req.params.id }, data: result.data });
  res.json({ product });
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing || !existing.isActive) {
    res.status(404).json({ message: 'Product not found' });
    return;
  }

  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.status(204).send();
}
