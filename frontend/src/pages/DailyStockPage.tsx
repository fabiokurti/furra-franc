import { useEffect, useState } from 'react';
import { PackageCheck, Lock, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import type { DailyStock, Product } from '@/types';

type InputMap = Record<string, number>;

export function DailyStockPage() {
  const [entry, setEntry] = useState<DailyStock | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<InputMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // filters
  const [categoryFilter, setCategoryFilter] = useState('Të gjitha');
  const [showOnlyRemaining, setShowOnlyRemaining] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      const [stockRes, productsRes] = await Promise.all([
        api.get('/daily-stock/today'),
        api.get('/products'),
      ]);
      setEntry(stockRes.data.entry);
      const prods: Product[] = productsRes.data.products ?? productsRes.data;
      setProducts(prods.filter((p) => p.isActive));
      if (!stockRes.data.entry) {
        const init: InputMap = {};
        prods.filter((p) => p.isActive).forEach((p) => { init[p.id] = 0; });
        setQuantities(init);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }));
      const res = await api.post('/daily-stock', { items });
      setEntry(res.data.entry);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClose() {
    if (!entry) return;
    setIsClosing(true);
    try {
      await api.patch(`/daily-stock/${entry.id}/close`);
      await load();
    } finally {
      setIsClosing(false);
    }
  }

  const today = new Date().toLocaleDateString('sq-AL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Stoku Ditor</h1>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // derive categories from entry items or products
  const allCategories = entry
    ? [...new Set(entry.items.map((i) => i.product.category))]
    : [...new Set(products.map((p) => p.category))];

  const filterItems = (items: DailyStock['items']) => {
    let filtered = items;
    if (categoryFilter !== 'Të gjitha') {
      filtered = filtered.filter((i) => i.product.category === categoryFilter);
    }
    if (showOnlyRemaining) {
      filtered = filtered.filter((i) => i.remaining > 0);
    }
    return filtered;
  };

  const grouped = (items: DailyStock['items']) => {
    const visible = filterItems(items);
    const map: Record<string, DailyStock['items']> = {};
    for (const item of visible) {
      const cat = item.product.category;
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return map;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Stoku Ditor</h1>
          <p className="text-muted-foreground">{today}</p>
        </div>
        {entry && (
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={entry.status === 'OPEN' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
              {entry.status === 'OPEN' ? 'I hapur' : 'Mbyllur'}
            </Badge>
            {entry.status === 'OPEN' && (
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="h-4 w-4 mr-1" /> Rifresko
              </Button>
            )}
            {entry.status === 'OPEN' && (
              <Button variant="destructive" size="sm" onClick={handleClose} disabled={isClosing}>
                <Lock className="h-4 w-4 mr-1" />
                {isClosing ? 'Duke mbyllur...' : 'Mbyllo ditën'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* No entry yet — show form to start the day */}
      {!entry && (
        <form onSubmit={handleStart} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Shkruaj sasinë e çdo produkti për sot dhe kliko <strong>Hap ditën</strong>.
          </p>
          {Object.entries(
            products.reduce<Record<string, Product[]>>((acc, p) => {
              if (!acc[p.category]) acc[p.category] = [];
              acc[p.category].push(p);
              return acc;
            }, {})
          ).map(([category, prods]) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {prods.map((p) => (
                    <div key={p.id} className="space-y-1">
                      <label className="text-sm font-medium">{p.name}</label>
                      <Input
                        type="number"
                        min={0}
                        value={quantities[p.id] ?? 0}
                        onChange={(e) =>
                          setQuantities((q) => ({ ...q, [p.id]: Number(e.target.value) }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            <PackageCheck className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Duke hapur...' : 'Hap ditën'}
          </Button>
        </form>
      )}

      {/* Entry exists — filters + stock table */}
      {entry && (
        <div className="space-y-4">

          {/* Summary totals */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Fillimi</p>
                <p className="text-xl font-bold mt-0.5">{entry.items.reduce((s, i) => s + i.quantity, 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Dërguar</p>
                <p className="text-xl font-bold mt-0.5 text-orange-600">{entry.items.reduce((s, i) => s + i.delivered, 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Mbetur</p>
                <p className="text-xl font-bold mt-0.5 text-green-600">{entry.items.reduce((s, i) => s + i.remaining, 0)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground shrink-0">Kategoria:</span>
            {['Të gjitha', ...allCategories].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  categoryFilter === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                {cat}
              </button>
            ))}
            <div className="ml-auto">
              <button
                onClick={() => setShowOnlyRemaining((v) => !v)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  showOnlyRemaining
                    ? 'bg-green-600 text-white border-green-600'
                    : 'border-border hover:bg-accent'
                }`}
              >
                Vetëm të mbetura
              </button>
            </div>
          </div>

          {/* Tables by category */}
          {Object.entries(grouped(entry.items)).map(([category, items]) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{category}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium">Produkti</th>
                      <th className="text-center px-4 py-2 font-medium">Fillimi</th>
                      <th className="text-center px-4 py-2 font-medium">Dërguar</th>
                      <th className="text-center px-4 py-2 font-medium">Mbetur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-4 py-2 font-medium">{item.product.name}</td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-center text-orange-600">{item.delivered}</td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={
                              item.remaining < 0
                                ? 'text-red-600 font-semibold'
                                : item.remaining === 0
                                ? 'text-muted-foreground'
                                : 'text-green-600 font-semibold'
                            }
                          >
                            {item.remaining}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}

          {Object.keys(grouped(entry.items)).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nuk ka produkte për filtrin e zgjedhur.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
