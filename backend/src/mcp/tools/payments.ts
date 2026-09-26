import { prisma } from '../../lib/prisma';
import {
  CURRENCY,
  McpTool,
  buildPriceMap,
  deliveryRevenue,
  deliveryWithItems,
  rangeFilter,
  resolveClient,
  resolveDriver,
  round2,
  zDate,
  zNullableStr,
} from '../lib';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * There is no dedicated payments ledger in the schema. A "payment" here is a
 * COMPLETED delivery marked isPaid=true; its amount is the delivery revenue and
 * its date is paidAt (falling back to deliveryDate).
 */
const getPayments: McpTool = {
  name: 'get_payments',
  description:
    'Kthen pagesat (dërgesat e paguara) në një interval datash, opsionalisht sipas klientit ose shoferit. Data e pagesës është paidAt.',
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

    const deliveries = await prisma.delivery.findMany({
      where: {
        status: 'COMPLETED',
        isPaid: true,
        // Match on paidAt when set, else on deliveryDate.
        OR: [{ paidAt: range }, { AND: [{ paidAt: null }, { deliveryDate: range }] }],
        ...(clientId ? { clientId } : {}),
        ...(staffId ? { staffId } : {}),
      },
      orderBy: [{ paidAt: 'asc' }, { deliveryDate: 'asc' }],
      include: deliveryWithItems,
    });
    const priceMap = await buildPriceMap(deliveries.map((d) => d.clientId));

    let total = 0;
    const payments = deliveries.map((d) => {
      const amount = deliveryRevenue(d, priceMap);
      total += amount;
      return {
        delivery_id: d.id,
        date: ymd(new Date(d.paidAt ?? d.deliveryDate)),
        client: d.client?.name ?? null,
        driver: d.createdBy?.name ?? null,
        amount: round2(amount),
      };
    });

    return { date_from, date_to, payments, total: round2(total), currency: CURRENCY };
  },
};

export const paymentTools: McpTool[] = [getPayments];
