import api from './api';
import type { Client, Delivery, ClientProductPrice, Product } from '@/types';

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

// Build a price map for all items across multiple deliveries.
// Always fetches client prices and products fresh (same pattern as resolveDeliveryPrices).
export async function resolveClientPriceMap(
  client: Pick<Client, 'id'>,
  deliveries: Delivery[],
): Promise<Record<string, number>> {
  const [clientRes, productsRes] = await Promise.all([
    api.get(`/clients/${client.id}`),
    api.get('/products'),
  ]);
  const products: Product[] = productsRes.data.products ?? productsRes.data;
  const clientPrices: ClientProductPrice[] = clientRes.data.client.prices || [];

  const map: Record<string, number> = {};
  for (const d of deliveries) {
    for (const item of d.items) {
      if (item.productId in map) continue;
      const cp = clientPrices.find((p) => p.productId === item.productId);
      map[item.productId] = cp
        ? Number(cp.price)
        : Number(products.find((p) => p.id === item.productId)?.price ?? 0);
    }
  }
  return map;
}
