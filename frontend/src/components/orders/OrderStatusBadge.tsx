import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/types';

const statusConfig: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  PENDING: { label: 'Në pritje', variant: 'secondary' },
  CONFIRMED: { label: 'Konfirmuar', variant: 'info' },
  BAKING: { label: 'Duke u pjekur', variant: 'warning' },
  READY: { label: 'Gati', variant: 'success' },
  DELIVERED: { label: 'Dorëzuar', variant: 'default' },
  CANCELLED: { label: 'Anuluar', variant: 'destructive' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
