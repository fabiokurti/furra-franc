import React, { useEffect, useState } from 'react';
import { PackageCheck, Lock, RefreshCw, Plus, ChevronDown, ChevronUp, History, Trash2, TrendingUp, Truck, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/lib/api';
import { formatDateAL } from '@/lib/date';
import { useAuth } from '@/context/AuthContext';
import type { DailyStock, Product } from '@/types';

type InputMap = Record<string, number>;

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function fmt(n: number) {
  return (isNaN(n) ? 0 : n).toLocaleString('sq-AL');
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
    <div className="space-y-5">
      {Object.entries(byCategory).map(([category, prods]) => (
        <div key={category}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{category}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {prods.map((p) => (
              <div key={p.id} className="space-y-1">
                <label className="text-sm font-medium leading-tight">{p.name}</label>
                <p className="text-xs text-muted-foreground">{Number(p.price).toFixed(0)} L / copë</p>
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
        </div>
      ))}
    </div>
  );
}

export function DailyStockPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [entry, setEntry] = useState<DailyStock | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<InputMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showAddMore, setShowAddMore] = useState(false);
  const [addQuantities, setAddQuantities] = useState<InputMap>({});
  const [isAdding, setIsAdding] = useState(false);

  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [nextQuantities, setNextQuantities] = useState<InputMap>({});
  const [isClosing, setIsClosing] = useState(false);

  const [isReopening, setIsReopening] = useState(false);
  const [showNextDay, setShowNextDay] = useState(false);
  const [nextDayQuantities, setNextDayQuantities] = useState<InputMap>({});
  const [isCreatingNext, setIsCreatingNext] = useState(false);
  const [nextDayCreated, setNextDayCreated] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState('Të gjitha');
  const [showOnlyRemaining, setShowOnlyRemaining] = useState(false);

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

  // Price lookup from products state
  function getPrice(productId: string): number {
    const p = Number(products.find((p) => p.id === productId)?.price ?? 0);
    return isNaN(p) ? 0 : p;
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
      await api.patch(`/daily-stock/${entry.id}/close`);
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

  async function handleDelete(id: string) {
    if (!confirm('Fshi këtë prodhim ditor? Ky veprim është i pakthyeshëm.')) return;
    await api.delete(`/daily-stock/${id}`);
    if (entry?.id === id) setEntry(null);
    setHistory((prev) => prev.filter((h) => h.id !== id));
    await load();
  }

  async function handleCloseHistory(id: string) {
    await api.patch(`/daily-stock/${id}/close`);
    setHistory((prev) => prev.map((h) => h.id === id ? { ...h, status: 'CLOSED' } : h));
    if (entry?.id === id) await load();
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

  const today = formatDateAL(new Date(), true);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Prodhimi Ditor</h1>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg border bg-card animate-pulse" />
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

  // Totals for summary
  const totalProdhuar  = entry?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const totalDerguar   = entry?.items.reduce((s, i) => s + i.delivered, 0) ?? 0;
  const totalMbetur    = entry?.items.reduce((s, i) => s + i.remaining, 0) ?? 0;
  const totalVlera     = entry?.items.reduce((s, i) => s + i.quantity * getPrice(i.productId), 0) ?? 0;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Prodhimi Ditor</h1>
          <p className="text-muted-foreground">{today}</p>
        </div>
        {entry && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={entry.status === 'OPEN' ? 'default' : 'secondary'}
              className="text-sm px-3 py-1"
            >
              {entry.status === 'OPEN' ? '● I hapur' : '■ Mbyllur'}
            </Badge>
            {entry.status === 'OPEN' && (
              <>
                <Button variant="outline" size="sm" onClick={load}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Rifresko
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddMore((v) => !v)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Shto Produkte
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowCloseDialog(true)}>
                  <Lock className="h-3.5 w-3.5 mr-1.5" /> Mbyll
                </Button>
              </>
            )}
            {entry.status === 'CLOSED' && (
              <>
                <Button variant="outline" size="sm" onClick={handleReopen} disabled={isReopening}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  {isReopening ? 'Duke hapur...' : 'Hap Sërisht'}
                </Button>
                <Button size="sm" onClick={() => setShowNextDay((v) => !v)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Prodhimi i Nesërm
                </Button>
              </>
            )}
            {isAdmin && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Fshi
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── No entry — start form ── */}
      {!entry && (
        <form onSubmit={handleStart} className="space-y-5">
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Shkruaj sasinë e çdo produkti dhe kliko <strong>Hap Prodhimin</strong>.
          </div>
          <ProductForm
            products={products}
            quantities={quantities}
            onChange={(id, val) => setQuantities((q) => ({ ...q, [id]: val }))}
          />
          <Button type="submit" disabled={isSubmitting}>
            <PackageCheck className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Duke hapur...' : 'Hap Prodhimin'}
          </Button>
        </form>
      )}

      {/* ── Entry exists ── */}
      {entry && (
        <div className="space-y-5">

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Package className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Prodhuar</p>
                  <p className="text-xl font-bold">{fmt(totalProdhuar)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                  <Truck className="h-4.5 w-4.5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dërguar</p>
                  <p className="text-xl font-bold text-orange-600">{fmt(totalDerguar)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <PackageCheck className="h-4.5 w-4.5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mbetur</p>
                  <p className="text-xl font-bold text-green-600">{fmt(totalMbetur)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="sm:col-span-1 col-span-2">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vlera Totale</p>
                  <p className="text-xl font-bold text-primary">{fmt(totalVlera)} L</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add-more form */}
          {showAddMore && entry.status === 'OPEN' && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Shto Produkte në Prodhim</CardTitle>
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
                    <Button type="button" variant="outline" onClick={() => setShowAddMore(false)}>Anulo</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">Kategoria:</span>
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
            <button
              onClick={() => setShowOnlyRemaining((v) => !v)}
              className={`ml-auto px-3 py-1 rounded-full text-sm border transition-colors ${
                showOnlyRemaining ? 'bg-green-600 text-white border-green-600' : 'border-border hover:bg-accent'
              }`}
            >
              Vetëm të mbetura
            </button>
          </div>

          {/* Main stock table — all categories in one table */}
          {Object.keys(grouped(entry.items)).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nuk ka produkte për filtrin e zgjedhur.
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="text-left px-4 py-3 font-semibold">Produkti</th>
                    <th className="text-right px-4 py-3 font-semibold">Çmimi</th>
                    <th className="text-center px-4 py-3 font-semibold">Prodhuar</th>
                    <th className="text-center px-4 py-3 font-semibold">Dërguar</th>
                    <th className="text-center px-4 py-3 font-semibold">Mbetur</th>
                    <th className="text-right px-4 py-3 font-semibold">Vlera</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped(entry.items)).map(([category, items]) => {
                    const catVlera = items.reduce((s, i) => s + i.quantity * getPrice(i.productId), 0);
                    return (
                      <React.Fragment key={category}>
                        {/* Category header row */}
                        <tr className="bg-muted/30 border-b border-t">
                          <td colSpan={5} className="px-4 py-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {category}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className="text-xs font-semibold text-muted-foreground">{fmt(catVlera)} L</span>
                          </td>
                        </tr>
                        {items.map((item) => {
                          const price     = getPrice(item.productId);
                          const vlera     = item.quantity * price;
                          const pct       = item.quantity > 0 ? Math.round((item.delivered / item.quantity) * 100) : 0;
                          return (
                            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-medium">{item.product.name}</span>
                                {/* delivery progress bar */}
                                {item.quantity > 0 && (
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-orange-400 transition-all"
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-7 text-right">{pct}%</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                                {fmt(price)} L
                              </td>
                              <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                              <td className="px-4 py-3 text-center text-orange-600 font-medium">{item.delivered}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-semibold ${
                                  item.remaining < 0 ? 'text-red-600' :
                                  item.remaining === 0 ? 'text-muted-foreground' :
                                  'text-green-600'
                                }`}>
                                  {item.remaining}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-primary whitespace-nowrap">
                                {fmt(vlera)} L
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                {/* Footer totals row */}
                <tfoot>
                  <tr className="border-t-2 bg-muted/40">
                    <td className="px-4 py-3 font-bold" colSpan={2}>TOTALI</td>
                    <td className="px-4 py-3 text-center font-bold">{fmt(totalProdhuar)}</td>
                    <td className="px-4 py-3 text-center font-bold text-orange-600">{fmt(totalDerguar)}</td>
                    <td className="px-4 py-3 text-center font-bold text-green-600">{fmt(totalMbetur)}</td>
                    <td className="px-4 py-3 text-right font-bold text-primary">{fmt(totalVlera)} L</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Next-day form */}
          {entry.status === 'CLOSED' && showNextDay && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Prodhimi i Nesërm</CardTitle>
              </CardHeader>
              <CardContent>
                {nextDayCreated ? (
                  <p className="text-sm text-green-600 font-medium py-2">✓ Prodhimi i nesërm u hap me sukses.</p>
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
                      <Button type="button" variant="outline" onClick={() => setShowNextDay(false)}>Anulo</Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── History ── */}
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
              const tProd  = h.items.reduce((s, i) => s + i.quantity, 0);
              const tDerg  = h.items.reduce((s, i) => s + i.delivered, 0);
              const tMbet  = h.items.reduce((s, i) => s + i.remaining, 0);
              const tVlera = h.items.reduce((s, i) => s + i.quantity * getPrice(i.productId), 0);
              const isExp  = expandedIds.has(h.id);
              return (
                <div key={h.id} className="rounded-lg border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 gap-2 bg-card">
                    <button
                      className="flex-1 flex items-center gap-3 flex-wrap text-left"
                      onClick={() => toggleExpand(h.id)}
                    >
                      <span className="font-semibold text-sm">{formatDateAL(h.date, true)}</span>
                      <Badge variant={h.status === 'OPEN' ? 'default' : 'secondary'} className="text-xs">
                        {h.status === 'OPEN' ? 'I hapur' : 'Mbyllur'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        <span className="font-medium">{fmt(tProd)}</span> prod ·{' '}
                        <span className="text-orange-600 font-medium">{fmt(tDerg)}</span> dërg ·{' '}
                        <span className="text-green-600 font-medium">{fmt(tMbet)}</span> mbetur ·{' '}
                        <span className="text-primary font-semibold">{fmt(tVlera)} L</span>
                      </span>
                      {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </button>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        {h.status === 'OPEN' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleCloseHistory(h.id)}>
                            <Lock className="h-3 w-3" /> Mbyll
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive gap-1" onClick={() => handleDelete(h.id)}>
                          <Trash2 className="h-3 w-3" /> Fshi
                        </Button>
                      </div>
                    )}
                  </div>
                  {isExp && (
                    <div className="border-t overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left px-4 py-2 font-medium">Produkti</th>
                            <th className="text-right px-4 py-2 font-medium">Çmimi</th>
                            <th className="text-center px-4 py-2 font-medium">Prodhuar</th>
                            <th className="text-center px-4 py-2 font-medium">Dërguar</th>
                            <th className="text-center px-4 py-2 font-medium">Mbetur</th>
                            <th className="text-right px-4 py-2 font-medium">Vlera</th>
                          </tr>
                        </thead>
                        <tbody>
                          {h.items.map((item) => {
                            const price = getPrice(item.productId);
                            return (
                              <tr key={item.id} className="border-t hover:bg-muted/20">
                                <td className="px-4 py-2 font-medium">{item.product.name}</td>
                                <td className="px-4 py-2 text-right text-muted-foreground">{fmt(price)} L</td>
                                <td className="px-4 py-2 text-center">{item.quantity}</td>
                                <td className="px-4 py-2 text-center text-orange-600">{item.delivered}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className={item.remaining < 0 ? 'text-red-600 font-semibold' : item.remaining === 0 ? 'text-muted-foreground' : 'text-green-600 font-semibold'}>
                                    {item.remaining}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right text-primary font-medium">{fmt(item.quantity * price)} L</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 bg-muted/40">
                            <td className="px-4 py-2 font-bold" colSpan={2}>TOTALI</td>
                            <td className="px-4 py-2 text-center font-bold">{fmt(tProd)}</td>
                            <td className="px-4 py-2 text-center font-bold text-orange-600">{fmt(tDerg)}</td>
                            <td className="px-4 py-2 text-center font-bold text-green-600">{fmt(tMbet)}</td>
                            <td className="px-4 py-2 text-right font-bold text-primary">{fmt(tVlera)} L</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* ── Close dialog ── */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle>Mbyll Prodhimin & Fillo të Ardhmen</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Plotëso sasitë për prodhimin e radhës (opsionale). Lëri bosh nëse nuk dëshiron të hapësh tani.
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
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
              {isClosing ? 'Duke mbyllur...' : 'Mbyll & Fillo të Ardhmen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
