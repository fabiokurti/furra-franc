import { useEffect, useState } from 'react';
import { Trash2, Store, Package, TrendingUp, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { formatDateAL, formatDateTimeAL } from '@/lib/date';
import type { ShopSale } from '@/types';

interface ShopProduct { id: string; name: string; price: number }

interface Business {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  client: { id: string; name: string; phone?: string; address?: string } | null;
  shopProducts: ShopProduct[];
}

type DateFilter = 'today' | 'all';

function saleTotal(sale: ShopSale) {
  return sale.items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
}

function todayRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function isToday(dateStr: string) {
  const { start, end } = todayRange();
  const d = new Date(dateStr);
  return d >= start && d < end;
}

export function BusinessSalesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [sales, setSales] = useState<ShopSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());

  async function load() {
    setIsLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        api.get('/shop/businesses'),
        api.get('/shop/sales/all'),
      ]);
      setBusinesses(bRes.data.businesses);
      setSales(sRes.data.sales);
      // expand all shops by default
      setExpandedShops(new Set(bRes.data.businesses.map((b: Business) => b.id)));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function deleteSale(id: string) {
    if (!confirm('Fshi këtë shitje?')) return;
    await api.delete(`/shop/sales/${id}`);
    setSales((prev) => prev.filter((s) => s.id !== id));
  }

  function toggleShop(id: string) {
    setExpandedShops((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filteredSales = dateFilter === 'today'
    ? sales.filter((s) => isToday(s.saleDate))
    : sales;

  const grandTotal = filteredSales.reduce((s, sale) => s + saleTotal(sale), 0);
  const grandCount = filteredSales.length;

  if (isLoading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dyqanet</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-lg border bg-card animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dyqanet</h1>
          <p className="text-muted-foreground text-sm">Detaje dhe shitje për çdo dyqan</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${dateFilter === 'today' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Sot
          </button>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${dateFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Të gjitha
          </button>
        </div>
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Dyqane</p>
          <p className="text-2xl font-bold mt-0.5">{businesses.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Shitje</p>
          <p className="text-2xl font-bold mt-0.5">{grandCount}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold mt-0.5 text-green-600">{grandTotal.toFixed(0)} L</p>
        </CardContent></Card>
      </div>

      {/* Per-shop cards */}
      {businesses.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nuk ka dyqane të regjistruara.
        </CardContent></Card>
      ) : (
        businesses.map((biz) => {
          const bizSales = filteredSales.filter((s) => s.userId === biz.id);
          const bizTotal = bizSales.reduce((s, sale) => s + saleTotal(sale), 0);
          const bizTodaySales = sales.filter((s) => s.userId === biz.id && isToday(s.saleDate));
          const bizTodayTotal = bizTodaySales.reduce((s, sale) => s + saleTotal(sale), 0);
          const shopName = biz.client?.name ?? biz.name;
          const expanded = expandedShops.has(biz.id);

          // Group filtered sales by day
          const grouped = bizSales.reduce<Record<string, ShopSale[]>>((acc, sale) => {
            const day = formatDateAL(sale.saleDate, true);
            (acc[day] ??= []).push(sale);
            return acc;
          }, {});

          return (
            <Card key={biz.id}>
              <CardHeader className="pb-3">
                {/* Shop header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <Store className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base">{shopName}</CardTitle>
                      <p className="text-xs text-muted-foreground">{biz.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleShop(biz.id)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Quick stats row */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="rounded-md bg-muted/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sot</p>
                    <p className="text-lg font-bold">{bizTodaySales.length}</p>
                    <p className="text-xs text-green-600 font-medium">{bizTodayTotal.toFixed(0)} L</p>
                  </div>
                  <div className="rounded-md bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                    </div>
                    <p className="text-lg font-bold">{bizSales.length}</p>
                    <p className="text-xs text-green-600 font-medium">{bizTotal.toFixed(0)} L</p>
                  </div>
                  <div className="rounded-md bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Produkte</p>
                    </div>
                    <p className="text-lg font-bold">{biz.shopProducts.length}</p>
                  </div>
                </div>
              </CardHeader>

              {expanded && (
                <CardContent className="space-y-4 pt-0">
                  {/* Products */}
                  {biz.shopProducts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Produktet e dyqanit</p>
                      <div className="flex flex-wrap gap-1.5">
                        {biz.shopProducts.map((p) => (
                          <span key={p.id} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                            {p.name}
                            <span className="font-bold text-primary">{Number(p.price).toFixed(0)} L</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sales list */}
                  {bizSales.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {dateFilter === 'today' ? 'Nuk ka shitje sot.' : 'Nuk ka shitje të regjistruara.'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <ShoppingBag className="inline h-3 w-3 mr-1" />Shitjet
                      </p>
                      {Object.entries(grouped).map(([day, daySales]) => {
                        const dayTotal = daySales.reduce((s, sale) => s + saleTotal(sale), 0);
                        return (
                          <div key={day}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-muted-foreground">{day}</span>
                              <span className="text-xs font-bold text-green-600">{dayTotal.toFixed(0)} L</span>
                            </div>
                            <div className="space-y-1.5">
                              {daySales.map((sale) => {
                                const total = saleTotal(sale);
                                const time = formatDateTimeAL(sale.saleDate).split(' ')[1];
                                return (
                                  <div key={sale.id} className="flex items-center justify-between rounded-md border px-3 py-2 gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap gap-1 mb-0.5">
                                        {sale.items.map((item) => (
                                          <span key={item.id} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                                            {item.shopProduct.name} <span className="ml-1 font-bold">×{item.quantity}</span>
                                          </span>
                                        ))}
                                      </div>
                                      <p className="text-[10px] text-muted-foreground">{time}{sale.notes ? ` · ${sale.notes}` : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-sm font-bold text-green-600">{total.toFixed(0)} L</span>
                                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteSale(sale.id)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
