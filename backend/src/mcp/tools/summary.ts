import { prisma } from '../../lib/prisma';
import { CURRENCY, McpTool, rangeFilter, round2, salesTotals, zDate } from '../lib';

const getBusinessSummary: McpTool = {
  name: 'get_business_summary',
  description:
    'Përmbledhje e përgjithshme e Furra Franc për një interval datash: shitjet (total/paguar/papaguar), numri i dërgesave dhe sasia totale e kthyer.',
  inputSchema: { date_from: zDate, date_to: zDate },
  async handler(args) {
    const date_from = args.date_from as string;
    const date_to = args.date_to as string;
    const range = rangeFilter(date_from, date_to);

    const [totals, returnAgg] = await Promise.all([
      salesTotals(range),
      prisma.deliveryItem.aggregate({
        _sum: { returnedQuantity: true },
        where: { delivery: { status: 'COMPLETED', deliveryDate: range } },
      }),
    ]);

    return {
      date_from,
      date_to,
      currency: CURRENCY,
      sales: {
        total: totals.grandTotal,
        paid: round2(totals.deliveries.paid + totals.shop.total),
        unpaid: totals.deliveries.unpaid,
        deliveries_revenue: totals.deliveries.total,
        shop_revenue: totals.shop.total,
      },
      deliveries: { count: totals.deliveries.count },
      shop_sales: { count: totals.shop.count },
      returns: { total_quantity: returnAgg._sum.returnedQuantity ?? 0 },
    };
  },
};

export const summaryTools: McpTool[] = [getBusinessSummary];
