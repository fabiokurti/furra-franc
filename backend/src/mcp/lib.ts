import { z } from 'zod';
import { prisma } from '../lib/prisma';

/**
 * Shared helpers for the Furra Franc MCP tools.
 *
 * Business-logic notes (mapped from the existing schema, matching
 * dashboard.controller / ai.controller):
 *  - There is no dedicated `sales` table. "Sales" = COMPLETED deliveries
 *    (client sales) plus ShopSale (counter sales).
 *  - Delivery line revenue = client-specific price (ClientProductPrice)
 *    falling back to the product base price, times NET quantity
 *    (quantity - returnedQuantity).
 *  - "Driver"/distributor = the User who created the delivery (staffId).
 *  - "Paid/unpaid" = the Delivery.isPaid flag. There is no payments ledger;
 *    a paid delivery is treated as a payment of its revenue.
 *  - Client "balance"/debt = sum of unpaid completed-delivery revenue.
 *
 * Day boundaries use the server's local timezone, consistent with the rest
 * of the app. Deploy with TZ=Europe/Tirane (see .env.example APP_TIMEZONE).
 */

export const CURRENCY = 'LEK';

/** A domain error whose message is safe to return to the model. */
export class ToolError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a strict YYYY-MM-DD calendar date into local start-of-day. Rejects invalid dates (e.g. 2026-99-99, 2026-02-30). */
export function parseDay(s: string, field = 'date'): Date {
  if (typeof s !== 'string' || !DATE_RE.test(s)) {
    throw new ToolError('INVALID_DATE', `Fusha '${field}' duhet të jetë datë ISO (YYYY-MM-DD).`);
  }
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    throw new ToolError('INVALID_DATE', `Data '${s}' nuk është e vlefshme.`);
  }
  return dt;
}

/** Exclusive upper bound = local start of the day after `dateStr`. */
export function nextDay(dateStr: string, field = 'date'): Date {
  const d = parseDay(dateStr, field);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Build a {gte, lt} range for a single calendar day. */
export function dayRange(dateStr: string): { gte: Date; lt: Date } {
  return { gte: parseDay(dateStr, 'date'), lt: nextDay(dateStr, 'date') };
}

/** Build an inclusive {gte, lt} range from date_from..date_to. Validates order. */
export function rangeFilter(from: string, to: string): { gte: Date; lt: Date } {
  const gte = parseDay(from, 'date_from');
  const lt = nextDay(to, 'date_to');
  if (lt <= gte) {
    throw new ToolError('INVALID_RANGE', "'date_from' duhet të jetë para ose e barabartë me 'date_to'.");
  }
  return { gte, lt };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Clamp a requested limit to [1, max]. */
export function clampLimit(limit: number | null | undefined, def = 100, max = 500): number {
  const n = typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : def;
  return Math.min(Math.max(n, 1), max);
}

export function money(amount: number) {
  return { amount: round2(amount), currency: CURRENCY };
}

/** Fetch client-specific price overrides keyed by `${clientId}:${productId}`. */
export async function buildPriceMap(clientIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids = [...new Set(clientIds)];
  if (!ids.length) return map;
  const prices = await prisma.clientProductPrice.findMany({ where: { clientId: { in: ids } } });
  for (const cp of prices) map.set(`${cp.clientId}:${cp.productId}`, Number(cp.price));
  return map;
}

export function unitPriceFor(
  map: Map<string, number>,
  clientId: string,
  productId: string,
  basePrice: unknown,
): number {
  return map.get(`${clientId}:${productId}`) ?? Number(basePrice);
}

/** Common Prisma shape for a delivery with items + product prices. */
export const deliveryWithItems = {
  client: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, price: true } } } },
} as const;

type DeliveryForRevenue = {
  clientId: string;
  items: { productId: string; quantity: number; returnedQuantity: number; product: { price: unknown } }[];
};

/** Net revenue of a single delivery (net qty × effective unit price). */
export function deliveryRevenue(delivery: DeliveryForRevenue, priceMap: Map<string, number>): number {
  return delivery.items.reduce((sum, it) => {
    const unit = unitPriceFor(priceMap, delivery.clientId, it.productId, it.product.price);
    return sum + unit * (it.quantity - it.returnedQuantity);
  }, 0);
}

/** Resolve a driver (User) by id or name. Names are matched case-insensitively. */
export async function resolveDriver(driverId?: string | null, driverName?: string | null) {
  if (driverId) {
    const u = await prisma.user.findUnique({ select: { id: true, name: true }, where: { id: driverId } });
    if (!u) throw new ToolError('DRIVER_NOT_FOUND', 'Shoferi nuk u gjet.');
    return u;
  }
  if (driverName) {
    const matches = await prisma.user.findMany({
      select: { id: true, name: true },
      where: { name: { contains: driverName, mode: 'insensitive' }, role: { not: 'BUSINESS' } },
      take: 2,
    });
    if (!matches.length) throw new ToolError('DRIVER_NOT_FOUND', `Shoferi '${driverName}' nuk u gjet.`);
    if (matches.length > 1) {
      throw new ToolError('DRIVER_AMBIGUOUS', `Më shumë se një shofer përputhet me '${driverName}'. Përdor driver_id.`);
    }
    return matches[0];
  }
  throw new ToolError('DRIVER_REQUIRED', 'Nevojitet driver_id ose driver_name.');
}

/** Resolve a client by id or name. */
export async function resolveClient(clientId?: string | null, clientName?: string | null) {
  if (clientId) {
    const c = await prisma.client.findUnique({ select: { id: true, name: true }, where: { id: clientId } });
    if (!c) throw new ToolError('CLIENT_NOT_FOUND', 'Klienti nuk u gjet.');
    return c;
  }
  if (clientName) {
    const matches = await prisma.client.findMany({
      select: { id: true, name: true },
      where: { name: { contains: clientName, mode: 'insensitive' } },
      take: 2,
    });
    if (!matches.length) throw new ToolError('CLIENT_NOT_FOUND', `Klienti '${clientName}' nuk u gjet.`);
    if (matches.length > 1) {
      throw new ToolError('CLIENT_AMBIGUOUS', `Më shumë se një klient përputhet me '${clientName}'. Përdor client_id.`);
    }
    return matches[0];
  }
  throw new ToolError('CLIENT_REQUIRED', 'Nevojitet client_id ose client_name.');
}

/** Definition shape shared by every MCP tool. */
export interface McpTool {
  name: string;
  description: string;
  /** zod raw shape passed to server.registerTool as inputSchema. */
  inputSchema: z.ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Aggregate delivery + shop sales over a {gte, lt} range, optionally scoped to
 * a driver (staffId) and/or client. Used by daily/summary/business tools.
 */
export async function salesTotals(
  range: { gte: Date; lt: Date },
  opts: { staffId?: string; clientId?: string } = {},
) {
  const deliveries = await prisma.delivery.findMany({
    where: {
      status: 'COMPLETED',
      deliveryDate: range,
      ...(opts.staffId ? { staffId: opts.staffId } : {}),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
    },
    include: deliveryWithItems,
  });
  const priceMap = await buildPriceMap(deliveries.map((d) => d.clientId));

  let deliveryTotal = 0;
  let deliveryPaid = 0;
  let deliveryUnpaid = 0;
  for (const d of deliveries) {
    const rev = deliveryRevenue(d, priceMap);
    deliveryTotal += rev;
    if (d.isPaid) deliveryPaid += rev;
    else deliveryUnpaid += rev;
  }

  // Shop sales are counter cash sales (always considered paid). They are not
  // scoped by client; only included when no client filter is applied.
  let shopTotal = 0;
  let shopCount = 0;
  if (!opts.clientId) {
    const shopSales = await prisma.shopSale.findMany({
      where: { saleDate: range, ...(opts.staffId ? { userId: opts.staffId } : {}) },
      include: { items: true },
    });
    shopCount = shopSales.length;
    for (const s of shopSales) {
      for (const it of s.items) shopTotal += Number(it.unitPrice) * it.quantity;
    }
  }

  return {
    deliveries: {
      count: deliveries.length,
      total: round2(deliveryTotal),
      paid: round2(deliveryPaid),
      unpaid: round2(deliveryUnpaid),
    },
    shop: { count: shopCount, total: round2(shopTotal) },
    grandTotal: round2(deliveryTotal + shopTotal),
  };
}

/** Reusable zod fields. All entity ids in this schema are UUID strings. */
export const zDate = z.string().describe('ISO date YYYY-MM-DD');
export const zNullableStr = z.string().nullable().optional();
