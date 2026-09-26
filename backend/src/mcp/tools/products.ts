import { prisma } from '../../lib/prisma';
import { CURRENCY, McpTool } from '../lib';

const getProducts: McpTool = {
  name: 'get_products',
  description: 'Kthen listën e produkteve aktive të Furra Franc me çmimin bazë dhe kategorinë.',
  inputSchema: {},
  async handler() {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, category: true, price: true, isActive: true },
    });
    return {
      currency: CURRENCY,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: Number(p.price),
        active: p.isActive,
      })),
    };
  },
};

export const productTools: McpTool[] = [getProducts];
