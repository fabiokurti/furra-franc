import { prisma } from '../../lib/prisma';
import { McpTool, ToolError, parseDay, zDate } from '../lib';

/** Daily stock dates are stored at UTC midnight (see dailyStock.controller). */
function utcDate(dateStr: string): Date {
  const d = parseDay(dateStr, 'date');
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

const getDailyStock: McpTool = {
  name: 'get_daily_stock',
  description:
    'Kthen prodhimin ditor për një datë: sasia e prodhuar, e dërguar, e kthyer, e shitur neto dhe mbetja për çdo produkt.',
  inputSchema: { date: zDate },
  async handler(args) {
    const date = args.date as string;
    const start = utcDate(date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const entry = await prisma.dailyStock.findUnique({
      where: { date: start },
      include: { items: { include: { product: { select: { id: true, name: true } } } } },
    });
    if (!entry) throw new ToolError('STOCK_NOT_FOUND', `Nuk ka prodhim ditor të regjistruar për ${date}.`);

    // Delivered (gross) and returned quantities for the same UTC day, per product.
    const deliveryItems = await prisma.deliveryItem.findMany({
      where: { delivery: { deliveryDate: { gte: start, lt: end } } },
      select: { productId: true, quantity: true, returnedQuantity: true },
    });
    const delivered: Record<string, number> = {};
    const returned: Record<string, number> = {};
    for (const di of deliveryItems) {
      delivered[di.productId] = (delivered[di.productId] ?? 0) + di.quantity;
      returned[di.productId] = (returned[di.productId] ?? 0) + di.returnedQuantity;
    }

    return {
      date,
      items: entry.items.map((it) => {
        const producedQty = it.quantity;
        const deliveredQty = delivered[it.productId] ?? 0;
        const returnedQty = returned[it.productId] ?? 0;
        return {
          product_id: it.productId,
          product: it.product.name,
          produced: producedQty,
          delivered: deliveredQty,
          returned: returnedQty,
          net_sold: deliveredQty - returnedQty,
          remaining: producedQty - deliveredQty,
        };
      }),
    };
  },
};

export const stockTools: McpTool[] = [getDailyStock];
