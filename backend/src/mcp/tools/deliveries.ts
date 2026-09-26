import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import {
  CURRENCY,
  McpTool,
  ToolError,
  buildPriceMap,
  dayRange,
  deliveryRevenue,
  deliveryWithItems,
  rangeFilter,
  resolveDriver,
  round2,
  unitPriceFor,
  zDate,
  zNullableStr,
} from '../lib';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const getDeliveries: McpTool = {
  name: 'get_deliveries',
  description:
    'Kthen dërgesat e një dite, opsionalisht të filtruara sipas shoferit (driver_id/driver_name) ose klientit (client_id). Totali është vlera neto e dërgesës.',
  inputSchema: {
    date: zDate,
    driver_id: zNullableStr,
    driver_name: zNullableStr,
    client_id: zNullableStr,
  },
  async handler(args) {
    const date = args.date as string;
    const clientId = (args.client_id as string | null) ?? null;
    let staffId: string | undefined;
    if (args.driver_id || args.driver_name) {
      const driver = await resolveDriver(args.driver_id as string | null, args.driver_name as string | null);
      staffId = driver.id;
    }

    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveryDate: dayRange(date),
        ...(staffId ? { staffId } : {}),
        ...(clientId ? { clientId } : {}),
      },
      orderBy: { deliveryDate: 'asc' },
      include: deliveryWithItems,
    });
    const priceMap = await buildPriceMap(deliveries.map((d) => d.clientId));

    return {
      date,
      currency: CURRENCY,
      deliveries: deliveries.map((d) => ({
        delivery_id: d.id,
        date: ymd(new Date(d.deliveryDate)),
        driver: d.createdBy?.name ?? null,
        client: d.client?.name ?? null,
        total: round2(deliveryRevenue(d, priceMap)),
        is_paid: d.isPaid,
        status: d.status,
      })),
    };
  },
};

const getDeliveryDetails: McpTool = {
  name: 'get_delivery_details',
  description: 'Kthen detajet e një dërgese (produktet, sasitë, çmimet dhe totalet) sipas delivery_id.',
  inputSchema: { delivery_id: z.string().describe('ID e dërgesës (UUID)') },
  async handler(args) {
    const deliveryId = args.delivery_id as string;
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: deliveryWithItems,
    });
    if (!delivery) throw new ToolError('DELIVERY_NOT_FOUND', 'Dërgesa nuk u gjet.');
    const priceMap = await buildPriceMap([delivery.clientId]);

    return {
      delivery_id: delivery.id,
      date: ymd(new Date(delivery.deliveryDate)),
      driver: delivery.createdBy?.name ?? null,
      client: delivery.client?.name ?? null,
      is_paid: delivery.isPaid,
      status: delivery.status,
      currency: CURRENCY,
      items: delivery.items.map((it) => {
        const net = it.quantity - it.returnedQuantity;
        const unit = unitPriceFor(priceMap, delivery.clientId, it.productId, it.product.price);
        return {
          product: it.product.name,
          quantity: it.quantity,
          returned_quantity: it.returnedQuantity,
          net_quantity: net,
          unit_price: round2(unit),
          total: round2(unit * net),
        };
      }),
    };
  },
};

const getDrivers: McpTool = {
  name: 'get_drivers',
  description: 'Kthen listën e shoferëve/shpërndarësve (përdoruesit staf dhe admin) të Furra Franc.',
  inputSchema: {},
  async handler() {
    const drivers = await prisma.user.findMany({
      where: { role: { not: 'BUSINESS' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return { drivers: drivers.map((d) => ({ id: d.id, name: d.name, active: true })) };
  },
};

const getDriverSummary: McpTool = {
  name: 'get_driver_summary',
  description:
    'Kthen shitjet, arkëtimet (paguar) dhe shumën e papaguar për një shofer në një interval datash. Shoferi gjendet me driver_id ose driver_name.',
  inputSchema: {
    driver_id: zNullableStr,
    driver_name: zNullableStr,
    date_from: zDate,
    date_to: zDate,
  },
  async handler(args) {
    const date_from = args.date_from as string;
    const date_to = args.date_to as string;
    const driver = await resolveDriver(args.driver_id as string | null, args.driver_name as string | null);

    const deliveries = await prisma.delivery.findMany({
      where: { status: 'COMPLETED', staffId: driver.id, deliveryDate: rangeFilter(date_from, date_to) },
      include: deliveryWithItems,
    });
    const priceMap = await buildPriceMap(deliveries.map((d) => d.clientId));

    let sales = 0;
    let collected = 0;
    let unpaid = 0;
    for (const d of deliveries) {
      const rev = deliveryRevenue(d, priceMap);
      sales += rev;
      if (d.isPaid) collected += rev;
      else unpaid += rev;
    }

    return {
      driver: driver.name,
      driver_id: driver.id,
      date_from,
      date_to,
      sales: round2(sales),
      collected: round2(collected),
      unpaid: round2(unpaid),
      deliveries: deliveries.length,
      currency: CURRENCY,
    };
  },
};

export const deliveryTools: McpTool[] = [getDeliveries, getDeliveryDetails, getDrivers, getDriverSummary];
