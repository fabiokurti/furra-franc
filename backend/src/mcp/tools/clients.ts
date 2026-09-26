import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import {
  CURRENCY,
  McpTool,
  buildPriceMap,
  clampLimit,
  deliveryRevenue,
  deliveryWithItems,
  nextDay,
  resolveClient,
  round2,
  zNullableStr,
} from '../lib';

/**
 * Outstanding balance (debt) per client = sum of unpaid COMPLETED-delivery
 * revenue up to (and including) `asOfDate`. Returns a Map clientId -> balance.
 */
async function unpaidBalances(asOfDate: string | null): Promise<Map<string, number>> {
  const lt = asOfDate ? nextDay(asOfDate, 'as_of_date') : undefined;
  const deliveries = await prisma.delivery.findMany({
    where: {
      status: 'COMPLETED',
      isPaid: false,
      ...(lt ? { deliveryDate: { lt } } : {}),
    },
    include: deliveryWithItems,
  });
  const priceMap = await buildPriceMap(deliveries.map((d) => d.clientId));
  const balances = new Map<string, number>();
  for (const d of deliveries) {
    balances.set(d.clientId, (balances.get(d.clientId) ?? 0) + deliveryRevenue(d, priceMap));
  }
  return balances;
}

const getClients: McpTool = {
  name: 'get_clients',
  description: 'Kthen listën e klientëve me kërkim opsional dhe pagination. Nuk kthen të dhëna personale të panevojshme.',
  inputSchema: {
    search: zNullableStr,
    active_only: z.boolean().nullable().optional(),
    limit: z.number().int().nullable().optional(),
    offset: z.number().int().nullable().optional(),
  },
  async handler(args) {
    const search = (args.search as string | null) ?? null;
    const activeOnly = args.active_only !== false; // default true
    const limit = clampLimit(args.limit as number | null);
    const offset = Math.max(0, Math.floor((args.offset as number | null) ?? 0));

    const where = {
      ...(activeOnly ? { isActive: true } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit,
        select: { id: true, name: true, isActive: true },
      }),
      prisma.client.count({ where }),
    ]);

    return {
      clients: clients.map((c) => ({ id: c.id, name: c.name, active: c.isActive })),
      total,
      limit,
      offset,
    };
  },
};

const getClientBalance: McpTool = {
  name: 'get_client_balance',
  description: 'Kthen borxhin (shumën e papaguar) të një klienti deri në një datë. Klienti gjendet me client_id ose client_name.',
  inputSchema: {
    client_id: zNullableStr,
    client_name: zNullableStr,
    as_of_date: zNullableStr,
  },
  async handler(args) {
    const client = await resolveClient(args.client_id as string | null, args.client_name as string | null);
    const asOf = (args.as_of_date as string | null) ?? null;
    const balances = await unpaidBalances(asOf);
    return {
      client_id: client.id,
      client_name: client.name,
      balance: round2(balances.get(client.id) ?? 0),
      currency: CURRENCY,
      as_of_date: asOf,
    };
  },
};

const getUnpaidClients: McpTool = {
  name: 'get_unpaid_clients',
  description: 'Kthen klientët me borxh (shumë të papaguar) mbi një prag, deri në një datë.',
  inputSchema: {
    as_of_date: zNullableStr,
    minimum_balance: z.number().nullable().optional(),
    limit: z.number().int().nullable().optional(),
  },
  async handler(args) {
    const asOf = (args.as_of_date as string | null) ?? null;
    const minBalance = (args.minimum_balance as number | null) ?? 1;
    const limit = clampLimit(args.limit as number | null);
    const balances = await unpaidBalances(asOf);

    const clientIds = [...balances.keys()];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(clients.map((c) => [c.id, c.name]));

    const rows = [...balances.entries()]
      .map(([client_id, bal]) => ({
        client_id,
        client_name: nameById.get(client_id) ?? null,
        balance: round2(bal),
        currency: CURRENCY,
      }))
      .filter((r) => r.balance >= minBalance)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);

    return { as_of_date: asOf, clients: rows };
  },
};

export const clientTools: McpTool[] = [getClients, getClientBalance, getUnpaidClients];
