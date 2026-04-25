import { useEffect, useState } from 'react';
import { Trash2, Store } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import type { ShopSale } from '@/types';

export function BusinessSalesPage() {
  const [sales, setSales] = useState<ShopSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    try {
      const res = await api.get('/shop/sales/all');
      setSales(res.data.sales);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function deleteSale(id: string) {
    if (!confirm('Fshi këtë shitje?')) return;
    await api.delete(`/shop/sales/${id}`);
    await load();
  }

  // group by date string (YYYY-MM-DD)
  const grouped = sales.reduce<Record<string, ShopSale[]>>((acc, sale) => {
    const day = new Date(sale.saleDate).toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    (acc[day] ??= []).push(sale);
    return acc;
  }, {});

  const totalAll = sales.reduce((s, sale) => s + sale.items.reduce((si, i) => si + i.quantity * Number(i.unitPrice), 0), 0);

  if (isLoading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shitjet Biznese</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-lg border bg-card animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shitjet Biznese</h1>
        <p className="text-muted-foreground text-sm">Të gjitha shitjet e bizneseve të regjistruara</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total shitje</p>
          <p className="text-2xl font-bold mt-0.5">{sales.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total të ardhura</p>
          <p className="text-2xl font-bold mt-0.5 text-green-600">{totalAll.toFixed(0)} L</p>
        </CardContent></Card>
      </div>

      {sales.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nuk ka shitje të regjistruara.
        </CardContent></Card>
      ) : (
        Object.entries(grouped).map(([day, daySales]) => {
          const dayTotal = daySales.reduce((s, sale) => s + sale.items.reduce((si, i) => si + i.quantity * Number(i.unitPrice), 0), 0);
          return (
            <Card key={day}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{day}</CardTitle>
                  <span className="text-sm font-bold text-green-600">{dayTotal.toFixed(0)} L</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {daySales.map((sale) => {
                  const total = sale.items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
                  const userName = sale.user.client?.name ?? sale.user.name;
                  const time = new Date(sale.saleDate).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={sale.id} className="flex items-center justify-between rounded-md border px-3 py-2.5 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-semibold text-primary">{userName}</span>
                          <span className="text-xs text-muted-foreground">{time}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {sale.items.map((item) => (
                            <span key={item.id} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                              {item.shopProduct.name} <span className="ml-1 font-bold">×{item.quantity}</span>
                            </span>
                          ))}
                        </div>
                        {sale.notes && <p className="text-xs text-muted-foreground mt-1 italic">{sale.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-green-600">{total.toFixed(0)} L</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteSale(sale.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
