import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Store, Phone, MapPin, ShoppingBag, Trash2, TrendingUp, Package, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { formatDateAL, formatDateTimeAL, todayLocalISO } from '@/lib/date';
import type { ShopSale } from '@/types';

interface ShopProductInfo { id: string; name: string; price: number }

interface Business {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  client: { id: string; name: string; phone?: string; address?: string } | null;
  shopProducts: ShopProductInfo[];
}

type QuickFilter = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

function saleTotal(sale: ShopSale) {
  return sale.items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
}

function fmt(n: number) {
  return (isNaN(n) ? 0 : n).toLocaleString('sq-AL');
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function offsetDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

export function BusinessDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [business, setBusiness] = useState<Business | null>(null);
  const [sales, setSales]       = useState<ShopSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = todayLocalISO();
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('today');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo]     = useState(today);

  function applyQuick(f: QuickFilter) {
    setQuickFilter(f);
    if (f === 'today')     { setDateFrom(today);       setDateTo(today); }
    if (f === 'yesterday') { const y = offsetDate(-1); setDateFrom(y); setDateTo(y); }
    if (f === 'week')      { setDateFrom(weekStart());  setDateTo(today); }
    if (f === 'month')     { setDateFrom(monthStart()); setDateTo(today); }
    if (f === 'custom')    { /* keep current */ }
  }

  useEffect(() => {
    async function loadBusiness() {
      const res = await api.get('/shop/businesses');
      const found = res.data.businesses.find((b: Business) => b.id === userId);
      setBusiness(found ?? null);
    }
    loadBusiness();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    async function loadSales() {
      setIsLoading(true);
      try {
        const params: Record<string, string> = { userId, date: 'all' };
        if (quickFilter !== 'custom' || (dateFrom && dateTo)) {
          params.dateFrom = dateFrom;
          params.dateTo   = dateTo;
          delete params.date;
        }
        const res = await api.get('/shop/sales', { params });
        setSales(res.data.sales);
      } finally {
        setIsLoading(false);
      }
    }
    loadSales();
  }, [userId, dateFrom, dateTo]);

  async function deleteSale(id: string) {
    if (!confirm('Fshi këtë shitje?')) return;
    await api.delete(`/shop/sales/${id}`);
    setSales((prev) => prev.filter((s) => s.id !== id));
  }

  // ── Aggregations ───────────────────────────────────────────────
  const totalRevenue = sales.reduce((s, sale) => s + saleTotal(sale), 0);
  const totalCount   = sales.length;

  // Per-product totals
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const sale of sales) {
    for (const item of sale.items) {
      const pid = item.shopProductId;
      if (!productMap[pid]) productMap[pid] = { name: item.shopProduct.name, qty: 0, revenue: 0 };
      productMap[pid].qty     += item.quantity;
      productMap[pid].revenue += item.quantity * Number(item.unitPrice);
    }
  }
  const productRows = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

  // Grouped by day
  const grouped: Record<string, ShopSale[]> = {};
  for (const sale of sales) {
    const day = formatDateAL(sale.saleDate, true);
    (grouped[day] ??= []).push(sale);
  }

  const shopName = business?.client?.name ?? business?.name ?? '…';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate('/business-sales')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{shopName}</h1>
            <Badge variant="secondary" className="gap-1">
              <Store className="h-3 w-3" /> Dyqan
            </Badge>
          </div>
          {business && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
              <span>{business.email}</span>
              {business.client?.phone && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{business.client.phone}</span>
              )}
              {business.client?.address && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{business.client.address}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex gap-1 rounded-lg border p-1 w-fit">
          {(['today', 'yesterday', 'week', 'month', 'custom'] as QuickFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => applyQuick(f)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                quickFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'today' ? 'Sot' : f === 'yesterday' ? 'Dje' : f === 'week' ? 'Javë' : f === 'month' ? 'Muaj' : 'Manual'}
            </button>
          ))}
        </div>
        {quickFilter === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36 text-sm"
            />
            <span className="text-muted-foreground text-sm">—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingBag className="h-3 w-3" />Shitje</p>
          <p className="text-2xl font-bold mt-1">{totalCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />Të ardhura</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{fmt(totalRevenue)} L</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Mesatare / shitje</p>
          <p className="text-2xl font-bold mt-1 text-primary">
            {totalCount > 0 ? fmt(Math.round(totalRevenue / totalCount)) : 0} L
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" />Produkte</p>
          <p className="text-2xl font-bold mt-1">{business?.shopProducts.length ?? 0}</p>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg border bg-card animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">

          {/* Left: per-product totals */}
          <div className="lg:col-span-2 space-y-3">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                  Totali sipas produktit
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                {productRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nuk ka shitje.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Produkti</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Sasia</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Vlera</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.map((row) => (
                        <tr key={row.name} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium">{row.name}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold px-2.5 py-0.5 text-xs min-w-[2rem]">
                              {fmt(row.qty)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-green-600 whitespace-nowrap">
                            {fmt(row.revenue)} L
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/40">
                        <td className="px-4 py-2 font-bold text-xs">TOTALI</td>
                        <td className="px-3 py-2 text-center font-bold text-xs">
                          {fmt(productRows.reduce((s, r) => s + r.qty, 0))}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-green-600 text-xs whitespace-nowrap">
                          {fmt(totalRevenue)} L
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Shop products info */}
            {business && business.shopProducts.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm">Produktet e dyqanit</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-1.5">
                    {business.shopProducts.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                        {p.name}
                        <span className="font-bold text-primary">{Number(p.price).toFixed(0)} L</span>
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: sales list */}
          <div className="lg:col-span-3 space-y-4">
            {Object.keys(grouped).length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nuk ka shitje për periudhën e zgjedhur.
              </CardContent></Card>
            ) : (
              Object.entries(grouped).map(([day, daySales]) => {
                const dayTotal = daySales.reduce((s, sale) => s + saleTotal(sale), 0);
                return (
                  <div key={day} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{day}</span>
                      <span className="text-sm font-bold text-green-600">{fmt(dayTotal)} L</span>
                    </div>
                    {daySales.map((sale) => {
                      const total = saleTotal(sale);
                      const time  = formatDateTimeAL(sale.saleDate).split(' ')[1];
                      return (
                        <div key={sale.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 gap-3 hover:bg-muted/20 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1 mb-0.5">
                              {sale.items.map((item) => (
                                <span key={item.id} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                                  {item.shopProduct.name}
                                  <span className="ml-1 font-bold">×{item.quantity}</span>
                                </span>
                              ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {time}{sale.notes ? ` · ${sale.notes}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-sm font-bold text-green-600 whitespace-nowrap">{fmt(total)} L</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteSale(sale.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
