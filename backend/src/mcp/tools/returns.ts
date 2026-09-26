import { prisma } from '../../lib/prisma';
import { McpTool, rangeFilter, resolveClient, resolveDriver, zDate, zNullableStr } from '../lib';

/**
 * Returns are tracked as `returnedQuantity` on delivery items. This aggregates
 * delivered vs returned (and net sold) per client + product over a date range,
 * for deliveries that had at least one returned unit.
 */
const getReturns: McpTool = {
  name: 'get_returns',
  description:
    'Kthen kthimet (bukë e pakthyer/kthyer) sipas klientit dhe produktit në një interval datash: sasia e dërguar, e kthyer dhe neto e shitur.',
  inputSchema: {
    date_from: zDate,
    date_to: zDate,
    client_id: zNullableStr,
    driver_id: zNullableStr,
    driver_name: zNullableStr,
  },
  async handler(args) {
    const date_from = args.date_from as string;
    const date_to = args.date_to as string;
    const range = rangeFilter(date_from, date_to);

    let clientId: string | undefined;
    if (args.client_id) clientId = (await resolveClient(args.client_id as string, null)).id;
    let staffId: string | undefined;
    if (args.driver_id || args.driver_name) {
      staffId = (await resolveDriver(args.driver_id as string | null, args.driver_name as string | null)).id;
    }

    const items = await prisma.deliveryItem.findMany({
      where: {
        returnedQuantity: { gt: 0 },
        delivery: {
          deliveryDate: range,
          ...(clientId ? { clientId } : {}),
          ...(staffId ? { staffId } : {}),
        },
      },
      select: {
        productId: true,
        quantity: true,
        returnedQuantity: true,
        delivery: { select: { clientId: true } },
      },
    });

    // Aggregate by client + product.
    const agg = new Map<string, { client_id: string; product_id: string; delivered: number; returned: number }>();
    for (const it of items) {
      const key = `${it.delivery.clientId}:${it.productId}`;
      const row = agg.get(key) ?? { client_id: it.delivery.clientId, product_id: it.productId, delivered: 0, returned: 0 };
      row.delivered += it.quantity;
      row.returned += it.returnedQuantity;
      agg.set(key, row);
    }

    return {
      date_from,
      date_to,
      returns: [...agg.values()].map((r) => ({ ...r, net_sold: r.delivered - r.returned })),
    };
  },
};

export const returnTools: McpTool[] = [getReturns];
