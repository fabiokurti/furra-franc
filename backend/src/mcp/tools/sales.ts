import { prisma } from '../../lib/prisma';
import {
  CURRENCY,
  McpTool,
  ToolError,
  buildPriceMap,
  dayRange,
  deliveryWithItems,
  rangeFilter,
  round2,
  salesTotals,
  unitPriceFor,
  zDate,
  zNullableStr,
} from '../lib';

const getDailySales: McpTool = {
  name: 'get_daily_sales',
  description:
    'Kthen totalin e shitjeve të Furra Franc për një datë (dërgesat e përfunduara + shitjet në dyqan), me pjesën e paguar dhe të papaguar.',
  inputSchema: { date: zDate },
  async handler(args) {
    const date = args.date as string;
    const totals = await salesTotals(dayRange(date));
    return {
      date,
      currency: CURRENCY,
      total_sales: totals.grandTotal,
      paid: round2(totals.deliveries.paid + totals.shop.total),
      unpaid: totals.deliveries.unpaid,
      breakdown: { deliveries: totals.deliveries, shop: totals.shop },
    };
  },
};

const getSalesSummary: McpTool = {
  name: 'get_sales_summary',
  description: 'Përmbledhje e shitjeve totale për një interval datash (dërgesa + dyqan), me paguar/papaguar.',
  inputSchema: { date_from: zDate, date_to: zDate },
  async handler(args) {
    const date_from = args.date_from as string;
    const date_to = args.date_to as string;
    const totals = await salesTotals(rangeFilter(date_from, date_to));
    return {
      date_from,
      date_to,
      currency: CURRENCY,
      total_sales: totals.grandTotal,
      paid: round2(totals.deliveries.paid + totals.shop.total),
      unpaid: totals.deliveries.unpaid,
      breakdown: { deliveries: totals.deliveries, shop: totals.shop },
    };
  },
};

const getProductSales: McpTool = {
  name: 'get_product_sales',
  description:
    'Sasia neto dhe vlera e shitur për një produkt në një interval datash (nga dërgesat e përfunduara). Produkti gjendet me product_id ose product_name.',
  inputSchema: {
    date_from: zDate,
    date_to: zDate,
    product_id: zNullableStr,
    product_name: zNullableStr,
  },
  async handler(args) {
    const date_from = args.date_from as string;
    const date_to = args.date_to as string;
    const productId = (args.product_id as string | null) ?? null;
    const productName = (args.product_name as string | null) ?? null;

    let product: { id: string; name: string; price: unknown } | null = null;
    if (productId) {
      product = await prisma.product.findUnique({
        select: { id: true, name: true, price: true },
        where: { id: productId },
      });
      if (!product) throw new ToolError('PRODUCT_NOT_FOUND', 'Produkti nuk u gjet.');
    } else if (productName) {
      const matches = await prisma.product.findMany({
        select: { id: true, name: true, price: true },
        where: { name: { contains: productName, mode: 'insensitive' } },
        take: 2,
      });
      if (!matches.length) throw new ToolError('PRODUCT_NOT_FOUND', `Produkti '${productName}' nuk u gjet.`);
      if (matches.length > 1) {
        throw new ToolError('PRODUCT_AMBIGUOUS', `Më shumë se një produkt përputhet me '${productName}'. Përdor product_id.`);
      }
      product = matches[0];
    } else {
      throw new ToolError('PRODUCT_REQUIRED', 'Nevojitet product_id ose product_name.');
    }

    const deliveries = await prisma.delivery.findMany({
      where: {
        status: 'COMPLETED',
        deliveryDate: rangeFilter(date_from, date_to),
        items: { some: { productId: product.id } },
      },
      include: deliveryWithItems,
    });
    const priceMap = await buildPriceMap(deliveries.map((d) => d.clientId));

    let quantity = 0;
    let salesValue = 0;
    for (const d of deliveries) {
      for (const it of d.items) {
        if (it.productId !== product.id) continue;
        const net = it.quantity - it.returnedQuantity;
        quantity += net;
        salesValue += unitPriceFor(priceMap, d.clientId, it.productId, it.product.price) * net;
      }
    }

    return {
      product: { id: product.id, name: product.name },
      date_from,
      date_to,
      quantity,
      sales_value: round2(salesValue),
      currency: CURRENCY,
    };
  },
};

export const salesTools: McpTool[] = [getDailySales, getSalesSummary, getProductSales];
