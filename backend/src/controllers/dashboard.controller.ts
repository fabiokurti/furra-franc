import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const deliveryInclude = {
  client: { select: { id: true, name: true, address: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, category: true, price: true } },
    },
  },
};

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  // date filter — defaults to today
  const dateStr = req.query.date as string | undefined;
  let dateFilter: { gte: Date; lt: Date } | undefined;

  if (dateStr === 'all') {
    dateFilter = undefined;
  } else {
    const base = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(base);
    start.setHours(0, 0, 0, 0);
    const end = new Date(base);
    end.setHours(23, 59, 59, 999);
    dateFilter = { gte: start, lt: end };
  }

  const deliveryWhere = {
    status: 'COMPLETED' as const,
    ...(dateFilter ? { deliveryDate: dateFilter } : {}),
  };

  const [totalOrders, pendingOrders, revenueAgg, totalProducts, recentOrders, rawDeliveries] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.aggregate({
      _sum: { totalPrice: true },
      where: { status: 'DELIVERED' },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.delivery.findMany({
      where: deliveryWhere,
      orderBy: { deliveryDate: 'desc' },
      include: deliveryInclude,
    }),
  ]);

  // Compute per-delivery total using client-specific prices where available
  const clientIds = [...new Set(rawDeliveries.map((d) => d.clientId))];
  const clientPrices = await prisma.clientProductPrice.findMany({
    where: { clientId: { in: clientIds } },
  });
  const priceMap = new Map<string, number>();
  for (const cp of clientPrices) {
    priceMap.set(`${cp.clientId}:${cp.productId}`, Number(cp.price));
  }

  const completedDeliveries = rawDeliveries.map((d) => {
    const totalPrice = d.items.reduce((sum, item) => {
      const specific = priceMap.get(`${d.clientId}:${item.productId}`);
      const unit = specific ?? Number(item.product.price);
      return sum + unit * item.quantity;
    }, 0);
    return { ...d, totalPrice };
  });

  res.json({
    totalOrders,
    pendingOrders,
    totalRevenue: Number(revenueAgg._sum.totalPrice || 0),
    totalProducts,
    recentOrders,
    completedDeliveries,
  });
}
