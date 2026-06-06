import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api';
import { formatDateAL } from '@/lib/date';
import type { Delivery, Product } from '@/types';

interface ProductSummary {
  productId: string;
  name: string;
  category: string;
  totalQty: number;
  unitPrice: number;
  totalValue: number;
}

function fmt(n: number) {
  return (isNaN(n) ? 0 : n).toLocaleString('sq-AL');
}

export function DeliverySummaryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const date     = searchParams.get('date') ?? '';
  const staffId  = searchParams.get('staffId') ?? '';
  const clientId = searchParams.get('clientId') ?? '';

  const [rows, setRows]       = useState<ProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateLabel, setDateLabel] = useState('');

  useEffect(() => {
    if (date && date !== 'all') setDateLabel(formatDateAL(date, true));
    else setDateLabel('Të gjitha datat');

    async function load() {
      setIsLoading(true);
      try {
        const params: Record<string, string> = {};
        if (date)     params.date     = date;
        if (staffId)  params.staffId  = staffId;
        if (clientId) params.clientId = clientId;

        const [deliveriesRes, productsRes] = await Promise.all([
          api.get('/deliveries', { params }),
          api.get('/products'),
        ]);

        const deliveries: Delivery[] = deliveriesRes.data.deliveries;
        const products: Product[]   = productsRes.data.products ?? productsRes.data;
        const priceMap: Record<string, number> = {};
        const categoryMap: Record<string, string> = {};
        for (const p of products) {
          priceMap[p.id]    = Number(p.price);
          categoryMap[p.id] = p.category;
        }

        const map: Record<string, ProductSummary> = {};
        for (const d of deliveries) {
          if (d.status === 'CANCELLED') continue;
          for (const item of d.items) {
            const pid = item.productId;
            if (!map[pid]) {
              map[pid] = {
                productId: pid,
                name:       item.product.name,
                category:   categoryMap[pid] ?? '',
                totalQty:   0,
                unitPrice:  priceMap[pid] ?? 0,
                totalValue: 0,
              };
            }
            map[pid].totalQty   += item.quantity;
            map[pid].totalValue += item.quantity * (priceMap[pid] ?? 0);
          }
        }

        const sorted = Object.values(map).sort((a, b) =>
          a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
        );
        setRows(sorted);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [date, staffId, clientId]);

  const grandQty   = rows.reduce((s, r) => s + r.totalQty, 0);
  const grandValue = rows.reduce((s, r) => s + r.totalValue, 0);

  const byCategory: Record<string, ProductSummary[]> = {};
  for (const r of rows) {
    (byCategory[r.category] ??= []).push(r);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Totali i Artikujve</h1>
          <p className="text-muted-foreground text-sm">{dateLabel}</p>
        </div>
      </div>

      {/* Grand total cards */}
      {!isLoading && rows.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-bold text-lg">{fmt(grandQty)}</span>
            <span className="text-muted-foreground">copë totale</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm">
            <span className="font-bold text-lg text-green-600">{fmt(grandValue)} L</span>
            <span className="text-muted-foreground">vlerë totale</span>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Nuk ka dërgesa për filtrin e zgjedhur.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="text-left px-4 py-3 font-semibold">Produkti</th>
                <th className="text-right px-4 py-3 font-semibold">Çmimi</th>
                <th className="text-center px-4 py-3 font-semibold">Sasia</th>
                <th className="text-right px-4 py-3 font-semibold">Vlera</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byCategory).map(([category, items]) => {
                const catQty   = items.reduce((s, r) => s + r.totalQty, 0);
                const catValue = items.reduce((s, r) => s + r.totalValue, 0);
                return (
                  <>
                    <tr key={category} className="bg-muted/30 border-b border-t">
                      <td colSpan={2} className="px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-xs font-semibold text-muted-foreground">{fmt(catQty)} copë</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="text-xs font-semibold text-muted-foreground">{fmt(catValue)} L</span>
                      </td>
                    </tr>
                    {items.map((row) => (
                      <tr key={row.productId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                          {fmt(row.unitPrice)} L
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold px-3 py-0.5 min-w-[2.5rem]">
                            {fmt(row.totalQty)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600 whitespace-nowrap">
                          {fmt(row.totalValue)} L
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/40">
                <td className="px-4 py-3 font-bold" colSpan={2}>TOTALI</td>
                <td className="px-4 py-3 text-center font-bold">{fmt(grandQty)}</td>
                <td className="px-4 py-3 text-right font-bold text-green-600">{fmt(grandValue)} L</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
