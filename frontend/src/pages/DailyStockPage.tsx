import { useEffect, useState } from 'react';
import { PackageCheck, Lock, RefreshCw, Plus, ChevronDown, ChevronUp, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/lib/api';
import type { DailyStock, Product } from '@/types';

type InputMap = Record<string, number>;

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function ProductForm({
  products,
  quantities,
  onChange,
}: {
  products: Product[];
  quantities: InputMap;
  onChange: (id: string, val: number) => void;
}) {
  const byCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(byCategory).map(([category, prods]) => (
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
                    value={quantities[p.id] === 0 ? '' : (quantities[p.id] ?? '')}
                    placeholder="0"
                    onChange={(e) => {
                      const n = parseInt(e.target.value);
                      onChange(p.id, isNaN(n) ? 0 : n);
                    }}
                    onBlur={(e) => { if (!e.target.value) onChange(p.id, 0); }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export function DailyStockPage() {
  const [entry, setEntry] = useState<DailyStock | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<InputMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // add-more state
  const [showAddMore, setShowAddMore] = useState(false);
  const [addQuantities, setAddQuantities] = useState<InputMap>({});
  const [isAdding, setIsAdding] = useState(false);

  // close dialog state
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [nextQuantities, setNextQuantities] = useState<InputMap>({});
  const [isClosing, setIsClosing] = useState(false);

  // reopen / next-day state
  const [isReopening, setIsReopening] = useState(false);
  const [showNextDay, setShowNextDay] = useState(false);
  const [nextDayQuantities, setNextDayQuantities] = useState<InputMap>({});
  const [isCreatingNext, setIsCreatingNext] = useState(false);
  const [nextDayCreated, setNextDayCreated] = useState(false);

  // filters
  const [categoryFilter, setCategoryFilter] = useState('Të gjitha');
  const [showOnlyRemaining, setShowOnlyRemaining] = useState(false);

  // history
  const [history, setHistory] = useState<DailyStock[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await api.get('/daily-stock/history');
      setHistory(res.data.entries);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function load() {
    setIsLoading(true);
    try {
      const [stockRes, productsRes] = await Promise.all([
        api.get('/daily-stock/today'),
        api.get('/products'),
      ]);
      setEntry(stockRes.data.entry);
      const prods: Product[] = productsRes.data.products ?? productsRes.data;
      const active = prods.filter((p) => p.isActive);
      setProducts(active);
      const blank: InputMap = {};
      active.forEach((p) => { blank[p.id] = 0; });
      if (!stockRes.data.entry) setQuantities({ ...blank });
      setAddQuantities({ ...blank });
      setNextQuantities({ ...blank });
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

  async function handleAddMore(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    setIsAdding(true);
    try {
      const items = Object.entries(addQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }));
      if (items.length === 0) return;
      const res = await api.patch(`/daily-stock/${entry.id}/add-items`, { items });
      setEntry(res.data.entry);
      setShowAddMore(false);
      const blank: InputMap = {};
      products.forEach((p) => { blank[p.id] = 0; });
      setAddQuantities(blank);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleCloseAndNext() {
    if (!entry) return;
    setIsClosing(true);
    try {
      // 1. Close today
      await api.patch(`/daily-stock/${entry.id}/close`);

      // 2. Create tomorrow's prodhim if any quantities were entered
      const nextItems = Object.entries(nextQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }));
      if (nextItems.length > 0) {
        await api.post('/daily-stock', { items: nextItems, date: tomorrow() });
      }

      setShowCloseDialog(false);
      await load();
    } finally {
      setIsClosing(false);
    }
  }

  async function handleReopen() {
    if (!entry) return;
    setIsReopening(true);
    try {
      const res = await api.patch(`/daily-stock/${entry.id}/reopen`);
      setEntry(res.data.entry);
      setNextDayCreated(false);
      setShowNextDay(false);
    } finally {
      setIsReopening(false);
    }
  }

  async function handleCreateNextDay(e: React.FormEvent) {
    e.preventDefault();
    setIsCreatingNext(true);
    try {
      const items = Object.entries(nextDayQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }));
      if (items.length === 0) return;
      await api.post('/daily-stock', { items, date: tomorrow() });
      setNextDayCreated(true);
      setShowNextDay(false);
    } finally {
      setIsCreatingNext(false);
    }
  }

  const today = new Date().toLocaleDateString('sq-AL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Prodhimi Ditor</h1>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const allCategories = entry
    ? [...new Set(entry.items.map((i) => i.product.category))]
    : [...new Set(products.map((p) => p.category))];

  const filterItems = (items: DailyStock['items']) => {
    let filtered = items;
    if (categoryFilter !== 'Të gjitha') filtered = filtered.filter((i) => i.product.category === categoryFilter);
    if (showOnlyRemaining) filtered = filtered.filter((i) => i.remaining > 0);
    return filtered;
  };

  const grouped = (items: DailyStock['items']) => {
    const visible = filterItems(items);
    const map: Record<string, DailyStock['items']> = {};
    for (const item of visible) {
      (map[item.product.category] ??= []).push(item);
    }
    return map;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Prodhimi Ditor</h1>
          <p className="text-muted-foreground">{today}</p>
        </div>
        {entry && (
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={entry.status === 'OPEN' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
              {entry.status === 'OPEN' ? 'I hapur' : 'Mbyllur'}
            </Badge>
            {entry.status === 'OPEN' && (
              <>
                <Button variant="outline" size="sm" onClick={load}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Rifresko
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddMore((v) => !v)}>
                  <Plus className="h-4 w-4 mr-1" /> Shto Produkte
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowCloseDialog(true)}>
                  <Lock className="h-4 w-4 mr-1" /> Mbyllo Prodhimin
                </Button>
              </>
            )}
            {entry.status === 'CLOSED' && (
              <>
                <Button variant="outline" size="sm" onClick={handleReopen} disabled={isReopening}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {isReopening ? 'Duke hapur...' : 'Hap Sërisht'}
                </Button>
                <Button size="sm" onClick={() => setShowNextDay((v) => !v)}>
                  <Plus className="h-4 w-4 mr-1" /> Hap Prodhimin e Nesërm
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* No entry — start form */}
      {!entry && (
        <form onSubmit={handleStart} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Shkruaj sasinë e çdo produkti dhe kliko <strong>Hap Prodhimin</strong>.
          </p>
          <ProductForm
            products={products}
            quantities={quantities}
            onChange={(id, val) => setQuantities((q) => ({ ...q, [id]: val }))}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            <PackageCheck className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Duke hapur...' : 'Hap Prodhimin'}
          </Button>
        </form>
      )}

      {/* Entry exists */}
      {entry && (
        <div className="space-y-4">

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Prodhuar</p>
              <p className="text-xl font-bold mt-0.5">{entry.items.reduce((s, i) => s + i.quantity, 0)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Dërguar</p>
              <p className="text-xl font-bold mt-0.5 text-orange-600">{entry.items.reduce((s, i) => s + i.delivered, 0)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Mbetur</p>
              <p className="text-xl font-bold mt-0.5 text-green-600">{entry.items.reduce((s, i) => s + i.remaining, 0)}</p>
            </CardContent></Card>
          </div>

          {/* Add-more form (inline, collapsible) */}
          {showAddMore && entry.status === 'OPEN' && (
            <Card className="border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Shto Produkte në Prodhim</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddMore} className="space-y-4">
                  <ProductForm
                    products={products}
                    quantities={addQuantities}
                    onChange={(id, val) => setAddQuantities((q) => ({ ...q, [id]: val }))}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isAdding}>
                      {isAdding ? 'Duke shtuar...' : 'Shto'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowAddMore(false)}>
                      Anulo
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

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
                  showOnlyRemaining ? 'bg-green-600 text-white border-green-600' : 'border-border hover:bg-accent'
                }`}
              >
                Vetëm të mbetura
              </button>
            </div>
          </div>

          {/* Table by category */}
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
                      <th className="text-center px-4 py-2 font-medium">Prodhuar</th>
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
                          <span className={
                            item.remaining < 0 ? 'text-red-600 font-semibold' :
                            item.remaining === 0 ? 'text-muted-foreground' :
                            'text-green-600 font-semibold'
                          }>
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

          {/* Next-day form (visible when closed) */}
          {entry.status === 'CLOSED' && showNextDay && (
            <Card className="border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Prodhimi i Nesërm</CardTitle>
              </CardHeader>
              <CardContent>
                {nextDayCreated ? (
                  <p className="text-sm text-green-600 font-medium py-2">
                    ✓ Prodhimi i nesërm u hap me sukses.
                  </p>
                ) : (
                  <form onSubmit={handleCreateNextDay} className="space-y-4">
                    <ProductForm
                      products={products}
                      quantities={nextDayQuantities}
                      onChange={(id, val) => setNextDayQuantities((q) => ({ ...q, [id]: val }))}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={isCreatingNext}>
                        <PackageCheck className="h-4 w-4 mr-2" />
                        {isCreatingNext ? 'Duke hapur...' : 'Hap Prodhimin e Nesërm'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowNextDay(false)}>
                        Anulo
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* History section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Historiku i Prodhimeve
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { if (!history.length) loadHistory(); else setHistory([]); }}
              disabled={historyLoading}
            >
              {historyLoading ? 'Duke ngarkuar...' : history.length ? 'Fshih' : 'Shiko historikun'}
            </Button>
          </div>
        </CardHeader>
        {history.length > 0 && (
          <CardContent className="space-y-2 pt-0">
            {history.map((h) => {
              const totalProdhuar = h.items.reduce((s, i) => s + i.quantity, 0);
              const totalDerguar = h.items.reduce((s, i) => s + i.delivered, 0);
              const totalMbetur = h.items.reduce((s, i) => s + i.remaining, 0);
              const isExpanded = expandedIds.has(h.id);
              const dateLabel = new Date(h.date).toLocaleDateString('sq-AL', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              });
              return (
                <div key={h.id} className="rounded-md border overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => toggleExpand(h.id)}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium text-sm">{dateLabel}</span>
                      <Badge variant={h.status === 'OPEN' ? 'default' : 'secondary'} className="text-xs">
                        {h.status === 'OPEN' ? 'I hapur' : 'Mbyllur'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Prodhuar <strong>{totalProdhuar}</strong> · Dërguar <strong className="text-orange-600">{totalDerguar}</strong> · Mbetur <strong className="text-green-600">{totalMbetur}</strong>
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left px-4 py-2 font-medium">Produkti</th>
                            <th className="text-center px-4 py-2 font-medium">Prodhuar</th>
                            <th className="text-center px-4 py-2 font-medium">Dërguar</th>
                            <th className="text-center px-4 py-2 font-medium">Mbetur</th>
                          </tr>
                        </thead>
                        <tbody>
                          {h.items.map((item) => (
                            <tr key={item.id} className="border-t">
                              <td className="px-4 py-2 font-medium">{item.product.name}</td>
                              <td className="px-4 py-2 text-center">{item.quantity}</td>
                              <td className="px-4 py-2 text-center text-orange-600">{item.delivered}</td>
                              <td className="px-4 py-2 text-center">
                                <span className={item.remaining < 0 ? 'text-red-600 font-semibold' : item.remaining === 0 ? 'text-muted-foreground' : 'text-green-600 font-semibold'}>
                                  {item.remaining}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* Close dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle>Mbyllo Prodhimin & Fillo të Ardhmen</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Plotëso sasitë për prodhimin e radhës (opsionale). Lëri bosh nëse nuk dëshiron të hapësh tani.
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <ProductForm
              products={products}
              quantities={nextQuantities}
              onChange={(id, val) => setNextQuantities((q) => ({ ...q, [id]: val }))}
            />
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Anulo</Button>
            <Button variant="destructive" onClick={handleCloseAndNext} disabled={isClosing}>
              <Lock className="h-4 w-4 mr-2" />
              {isClosing ? 'Duke mbyllur...' : 'Mbyllo & Fillo të Ardhmen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
