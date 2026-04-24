import { useEffect, useState } from 'react';
import { CheckCircle2, Banknote, XCircle, MapPin, Loader2, CalendarDays } from 'lucide-react';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import type { DashboardStats, DashboardDelivery } from '@/types';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [paidError, setPaidError] = useState('');
  const [dateFilter, setDateFilter] = useState(todayISO());

  const fetchStats = (date: string) => {
    setIsLoading(true);
    const params = date === 'all' ? { date: 'all' } : { date };
    api
      .get('/dashboard/stats', { params })
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchStats(dateFilter);
  }, [dateFilter]);

  const togglePaid = async (delivery: DashboardDelivery) => {
    setPaidError('');
    setTogglingId(delivery.id);
    try {
      const res = await api.patch(`/deliveries/${delivery.id}/paid`);
      const updated = res.data.delivery;
      setStats((prev) =>
        prev
          ? {
              ...prev,
              completedDeliveries: prev.completedDeliveries.map((d) =>
                d.id === updated.id ? { ...d, ...updated } : d
              ),
            }
          : prev
      );
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setPaidError(error.response?.data?.message || 'Ndryshimi dështoi');
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const completed    = stats?.completedDeliveries ?? [];
  const paidCount    = completed.filter((d) => d.isPaid).length;
  const unpaidCount  = completed.filter((d) => !d.isPaid).length;
  const paidTotal    = completed.filter((d) => d.isPaid).reduce((s, d) => s + d.totalPrice, 0);
  const unpaidTotal  = completed.filter((d) => !d.isPaid).reduce((s, d) => s + d.totalPrice, 0);
  const totalDeliveries = completed.length;
  const totalAmount  = completed.reduce((s, d) => s + d.totalPrice, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paneli</h1>
        <p className="text-muted-foreground">Mirë se vini në menaxhimin e furrës Furra Franc</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium">Dërgime të kryera</p>
            <p className="text-2xl font-bold mt-1">{totalDeliveries}</p>
            <p className="text-xs text-muted-foreground mt-1">Për datën e zgjedhur</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium">Shuma totale</p>
            <p className="text-2xl font-bold mt-1">{totalAmount.toFixed(0)} L</p>
            <p className="text-xs text-muted-foreground mt-1">Të gjitha dërgimet</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium">Paguar</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{paidTotal.toFixed(0)} L</p>
            <p className="text-xs text-muted-foreground mt-1">{paidCount} dërgime</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium">Pa paguar</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{unpaidTotal.toFixed(0)} L</p>
            <p className="text-xs text-muted-foreground mt-1">{unpaidCount} dërgime</p>
          </CardContent>
        </Card>
      </div>

      {/* Completed Deliveries */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Dërgimet e kryera
              </CardTitle>
              <div className="flex gap-2 mt-2">
                <span className="flex items-center gap-1.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 text-xs font-medium">
                  <Banknote className="h-3.5 w-3.5" />
                  {paidCount} paguar · {paidTotal.toFixed(0)} L
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 text-xs font-medium">
                  <XCircle className="h-3.5 w-3.5" />
                  {unpaidCount} pa paguar · {unpaidTotal.toFixed(0)} L
                </span>
              </div>
            </div>

            {/* Date filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />Data:
              </Label>
              <Input
                type="date"
                value={dateFilter === 'all' ? '' : dateFilter}
                onChange={(e) => setDateFilter(e.target.value || todayISO())}
                className="h-8 w-38 text-sm"
              />
              <Button
                size="sm"
                variant={dateFilter === todayISO() ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setDateFilter(todayISO())}
              >
                Sot
              </Button>
              <Button
                size="sm"
                variant={dateFilter === 'all' ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setDateFilter('all')}
              >
                Të gjitha
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {paidError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-3">{paidError}</div>
          )}
          {!stats?.completedDeliveries.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nuk ka dërgime të kryera për këtë datë</p>
          ) : (
            <div className="space-y-2">
              {stats.completedDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between rounded-lg border p-3 gap-3 flex-wrap"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{delivery.client.name}</p>
                      <Badge
                        variant={delivery.isPaid ? 'default' : 'destructive'}
                        className={delivery.isPaid ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        {delivery.isPaid ? 'Paguar' : 'Pa paguar'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {delivery.client.address && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />{delivery.client.address}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {delivery.createdBy.name} · {delivery.items.map((i) => `${i.product.name} ×${i.quantity}`).join(', ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-primary">{delivery.totalPrice.toFixed(0)} L</span>
                    <Button
                      size="sm"
                      variant={delivery.isPaid ? 'outline' : 'default'}
                      className={delivery.isPaid ? '' : 'bg-green-600 hover:bg-green-700'}
                      disabled={togglingId === delivery.id}
                      onClick={() => togglePaid(delivery)}
                    >
                      {togglingId === delivery.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      <Banknote className="mr-1.5 h-3.5 w-3.5" />
                      {delivery.isPaid ? 'Shëno pa paguar' : 'Shëno paguar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Porositë e fundit</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Ende nuk ka porosi</p>
          ) : (
            <div className="space-y-3">
              {stats?.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{order.orderNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.items.length} artikuj · {order.createdBy?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{Number(order.totalPrice).toFixed(0)} L</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
