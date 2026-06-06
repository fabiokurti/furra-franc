import { useEffect, useState } from 'react';
import { Store, TrendingUp, Package, ChevronRight, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
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

function saleTotal(sale: ShopSale) {
  return sale.items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
}

function isToday(dateStr: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  const d = new Date(dateStr);
  return d >= start && d < end;
}

function fmt(n: number) {
  return (isNaN(n) ? 0 : n).toLocaleString('sq-AL');
}

export function BusinessSalesPage() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [sales, setSales]           = useState<ShopSale[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [bRes, sRes] = await Promise.all([
          api.get('/shop/businesses'),
          api.get('/shop/sales/all'),
        ]);
        setBusinesses(bRes.data.businesses);
        setSales(sRes.data.sales);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const todaySales  = sales.filter((s) => isToday(s.saleDate));
  const todayTotal  = todaySales.reduce((s, sale) => s + saleTotal(sale), 0);
  const grandTotal  = sales.reduce((s, sale) => s + saleTotal(sale), 0);

  if (isLoading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dyqanet</h1>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-lg border bg-card animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dyqanet</h1>
        <p className="text-muted-foreground text-sm">Shitjet e çdo dyqani</p>
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Dyqane</p>
          <p className="text-2xl font-bold mt-0.5">{businesses.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Shitje sot</p>
          <p className="text-2xl font-bold mt-0.5">{todaySales.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total sot</p>
          <p className="text-2xl font-bold mt-0.5 text-green-600">{fmt(todayTotal)} L</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total gjithsej</p>
          <p className="text-2xl font-bold mt-0.5 text-primary">{fmt(grandTotal)} L</p>
        </CardContent></Card>
      </div>

      {/* Business list */}
      {businesses.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nuk ka dyqane të regjistruara.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {businesses.map((biz) => {
            const shopName      = biz.client?.name ?? biz.name;
            const bizAllSales   = sales.filter((s) => s.userId === biz.id);
            const bizTodaySales = bizAllSales.filter((s) => isToday(s.saleDate));
            const bizTodayTotal = bizTodaySales.reduce((s, sale) => s + saleTotal(sale), 0);
            const bizGrandTotal = bizAllSales.reduce((s, sale) => s + saleTotal(sale), 0);

            return (
              <Card key={biz.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Store className="h-5 w-5 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base leading-tight">{shopName}</p>
                      <p className="text-xs text-muted-foreground">{biz.email}</p>
                      {biz.client?.phone && (
                        <p className="text-xs text-muted-foreground">{biz.client.phone}</p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sot</p>
                        <p className="font-bold text-sm">{bizTodaySales.length} shitje</p>
                        <p className="text-xs text-green-600 font-medium">{fmt(bizTodayTotal)} L</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 justify-center">
                          <TrendingUp className="h-2.5 w-2.5" />Total
                        </p>
                        <p className="font-bold text-sm">{bizAllSales.length} shitje</p>
                        <p className="text-xs text-primary font-medium">{fmt(bizGrandTotal)} L</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 justify-center">
                          <Package className="h-2.5 w-2.5" />Produkte
                        </p>
                        <p className="font-bold text-sm">{biz.shopProducts.length}</p>
                      </div>
                    </div>

                    {/* Mobile stats */}
                    <div className="flex sm:hidden flex-col items-end gap-0.5 shrink-0 text-right">
                      <span className="text-xs text-green-600 font-bold">{fmt(bizTodayTotal)} L sot</span>
                      <span className="text-xs text-muted-foreground">{bizTodaySales.length} shitje</span>
                    </div>

                    {/* Navigate button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => navigate(`/business-sales/${biz.id}`)}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Products row */}
                  {biz.shopProducts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 pl-13">
                      {biz.shopProducts.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                          <ShoppingBag className="h-2.5 w-2.5 text-muted-foreground" />
                          {p.name}
                          <span className="font-bold text-primary">{Number(p.price).toFixed(0)} L</span>
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
