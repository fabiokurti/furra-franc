import { useEffect, useState } from 'react';
import { ChevronRight, Loader2, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import api from '@/lib/api';
import type { Order, OrderStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';

const STATUS_OPTIONS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Të gjitha porositë' },
  { value: 'PENDING', label: 'Në pritje' },
  { value: 'CONFIRMED', label: 'Konfirmuar' },
  { value: 'BAKING', label: 'Duke u pjekur' },
  { value: 'READY', label: 'Gati' },
  { value: 'DELIVERED', label: 'Dorëzuar' },
  { value: 'CANCELLED', label: 'Anuluar' },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'BAKING',
  BAKING: 'READY',
  READY: 'DELIVERED',
};

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchOrders = () => {
    setIsLoading(true);
    const params = filter !== 'ALL' ? { status: filter } : {};
    api
      .get('/orders', { params })
      .then((res) => setOrders(res.data.orders))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const togglePaid = async (order: Order) => {
    setIsUpdating(true);
    try {
      const res = await api.patch(`/orders/${order.id}/paid`);
      const updated = res.data.order;
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setSelectedOrder(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const advanceStatus = async (order: Order) => {
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;
    setIsUpdating(true);
    try {
      const res = await api.patch(`/orders/${order.id}/status`, { status: nextStatus });
      const updated = res.data.order;
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setSelectedOrder(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Porositë</h1>
          <p className="text-muted-foreground">Gjurmo dhe menaxho porositë e klientëve</p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as OrderStatus | 'ALL')}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nuk u gjetën porosi për filtrin e zgjedhur</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <button
              key={order.id}
              className="w-full text-left rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{order.orderNo}</p>
                    <OrderStatusBadge status={order.status} />
                    {order.status === 'DELIVERED' && (
                      <Badge
                        variant={order.isPaid ? 'default' : 'destructive'}
                        className={order.isPaid ? 'bg-green-600' : ''}
                      >
                        {order.isPaid ? 'Paguar' : 'Pa paguar'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {order.items.length} artikuj · nga {order.createdBy?.name} ·{' '}
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-primary">{Number(order.totalPrice).toFixed(0)} L</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedOrder?.orderNo}
              {selectedOrder && <OrderStatusBadge status={selectedOrder.status} />}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Nga: {selectedOrder.createdBy?.name}</p>
                <p>Data: {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                {selectedOrder.notes && <p>Shënime: {selectedOrder.notes}</p>}
              </div>

              <div className="border rounded-lg divide-y">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium">{item.product?.name}</span>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>×{item.quantity}</span>
                      <span>{(Number(item.unitPrice) * item.quantity).toFixed(0)} L</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 font-bold">
                  <span>Gjithsej</span>
                  <span>{Number(selectedOrder.totalPrice).toFixed(0)} L</span>
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="space-y-2">
                  {NEXT_STATUS[selectedOrder.status] && (
                    <Button className="w-full" onClick={() => advanceStatus(selectedOrder)} disabled={isUpdating}>
                      {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Shëno si {NEXT_STATUS[selectedOrder.status]}
                    </Button>
                  )}
                  {selectedOrder.status === 'DELIVERED' && (
                    <Button
                      className={`w-full gap-2 ${selectedOrder.isPaid ? '' : 'bg-green-600 hover:bg-green-700'}`}
                      variant={selectedOrder.isPaid ? 'outline' : 'default'}
                      onClick={() => togglePaid(selectedOrder)}
                      disabled={isUpdating}
                    >
                      {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Banknote className="h-4 w-4" />
                      {selectedOrder.isPaid ? 'Shëno pa paguar' : 'Shëno si paguar'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
