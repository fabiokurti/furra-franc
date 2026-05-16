import api from './api';
import type { Delivery, ClientProductPrice, Product } from '@/types';

export async function resolveDeliveryPrices(delivery: Delivery): Promise<Record<string, number>> {
  const [clientRes, productsRes] = await Promise.all([
    api.get(`/clients/${delivery.clientId}`),
    api.get('/products'),
  ]);
  const clientPrices: ClientProductPrice[] = clientRes.data.client.prices || [];
  const products: Product[] = productsRes.data.products;

  const map: Record<string, number> = {};
  for (const item of delivery.items) {
    const cp = clientPrices.find((p) => p.productId === item.productId);
    map[item.productId] = cp
      ? Number(cp.price)
      : Number(products.find((p) => p.id === item.productId)?.price ?? 0);
  }
  return map;
}
