import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Phone, CheckCircle2, Loader2, Trash2,
  User, CalendarDays, StickyNote, Pencil, Plus, Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { formatDateAL } from '@/lib/date';
import type { Return, Product, ClientProductPrice } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface SelectedItem { productId: string; quantity: number | null }

export function KthimetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [ret, setRet]           = useState<Return | null>(null);
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState('');

  // Edit dialog state
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [products, setProducts]         = useState<Product[]>([]);
  const [clientPrices, setClientPrices] = useState<ClientProductPrice[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [notes, setNotes]               = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogError, setDialogError]   = useState('');

  // Load return + resolve prices
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    api.get(`/kthimet/${id}`)
      .then(async (res) => {
        const data: Return = res.data.return;
        setRet(data);

        const [clientRes, productsRes] = await Promise.all([
          api.get(`/clients/${data.clientId}`),
          api.get('/products'),
        ]);
        const cp: ClientProductPrice[] = clientRes.data.client.prices || [];
        const allProducts: Product[]   = productsRes.data.products;

        const map: Record<string, number> = {};
        for (const item of data.items) {
          const custom = cp.find((p) => p.productId === item.productId);
          map[item.productId] = custom
            ? Number(custom.price)
            : Number(allProducts.find((p) => p.id === item.productId)?.price ?? 0);
        }
        setPriceMap(map);
      })
      .catch(() => setError('Kthimi nuk u gjet'))
      .finally(() => setIsLoading(false));
  }, [id]);

  // Open edit dialog — load products + client prices on demand
  const openEdit = async () => {
    if (!ret) return;
    setDialogError('');
    setNotes(ret.notes || '');
    setSelectedItems(ret.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));

    const [clientRes, productsRes] = await Promise.all([
      api.get(`/clients/${ret.clientId}`),
      api.get('/products'),
    ]);
    setClientPrices(clientRes.data.client.prices || []);
    setProducts((productsRes.data.products as Product[]).filter((p) => p.showInDelivery));
    setDialogOpen(true);
  };

  function getPriceForProduct(productId: string): number {
    const cp = clientPrices.find((p) => p.productId === productId);
    return cp
      ? Number(cp.price)
      : Number(products.find((p) => p.id === productId)?.price ?? 0);
  }

  const toggleProduct = (productId: string) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.productId === productId);
      if (exists) return prev.filter((i) => i.productId !== productId);
      return [...prev, { productId, quantity: null }];
    });
  };

  const setQty = (productId: string, qty: number | null) => {
    if (qty !== null && qty < 0) return;
    setSelectedItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
    );
  };

  const isSelected = (pid: string) => selectedItems.some((i) => i.productId === pid);

  const onSubmit = async () => {
    setDialogError('');
    const itemsToSend = selectedItems.filter((i) => (i.quantity ?? 0) > 0);
    if (itemsToSend.length === 0) { setDialogError('Zgjidhni të paktën një produkt me sasi > 0'); return; }
    setIsSubmitting(true);
    try {
      const res = await api.patch(`/kthimet/${ret!.id}`, { notes: notes || undefined, items: itemsToSend });
      const updated: Return = res.data.return;
      setRet(updated);

      // Recalculate prices for any newly added products
      const map: Record<string, number> = { ...priceMap };
      for (const item of updated.items) {
        if (!(item.productId in map)) {
          const cp = clientPrices.find((p) => p.productId === item.productId);
          map[item.productId] = cp
            ? Number(cp.price)
            : Number(products.find((p) => p.id === item.productId)?.price ?? 0);
        }
      }
      setPriceMap(map);
      setDialogOpen(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setDialogError(e.response?.data?.message || 'Operacioni dështoi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!ret || !confirm('Fshi këtë kthim?')) return;
    await api.delete(`/kthimet/${ret.id}`);
    navigate('/kthimet');
  };

  // ── loading / error states ────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !ret) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Kthehu
        </Button>
        <p className="text-destructive">{error || 'Kthimi nuk u gjet'}</p>
      </div>
    );
  }

  const grandTotal = ret.items.reduce((sum, item) => {
    return sum + (priceMap[item.productId] ?? 0) * item.quantity;
  }, 0);

  const sortedDialogProducts = [...products].sort(
    (a, b) => getPriceForProduct(a.id) - getPriceForProduct(b.id) || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back */}
      <Button variant="ghost" className="gap-2 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" /> Kthehu
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ret.client.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Kthyer
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Ndrysho
          </Button>
          {isAdmin && (
            <Button size="sm" variant="ghost"
              className="text-destructive hover:text-destructive gap-2"
              onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Fshi
            </Button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Klienti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold">{ret.client.name}</p>
            {ret.client.address && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />{ret.client.address}
              </p>
            )}
            {ret.client.phone && (
              <a href={`tel:${ret.client.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                <Phone className="h-3.5 w-3.5 shrink-0" />{ret.client.phone}
              </a>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Detajet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="flex items-center gap-2 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Dërgues:</span>
              <span className="font-medium">{ret.createdBy.name}</span>
            </p>
            <p className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Data:</span>
              <span className="font-medium">{formatDateAL(ret.returnDate, true)}</span>
            </p>
            {ret.notes && (
              <p className="flex items-start gap-2 text-sm">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground italic">{ret.notes}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products table with prices */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium">Produktet e kthyera</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Produkti</th>
                  <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Çmimi</th>
                  <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Sasia</th>
                  <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Totali</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ret.items.map((item) => {
                  const unit  = priceMap[item.productId] ?? 0;
                  const total = unit * item.quantity;
                  return (
                    <tr key={item.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">{item.product.category}</p>
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{unit.toFixed(0)} L</td>
                      <td className="px-5 py-3 text-right font-semibold text-primary">×{item.quantity}</td>
                      <td className="px-5 py-3 text-right font-bold">{total.toFixed(0)} L</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-right text-muted-foreground">
                    Totali
                  </td>
                  <td className="px-5 py-3 text-right text-base font-bold text-primary">
                    {grandTotal.toFixed(0)} L
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle>Ndrysho kthimin — {ret.client.name}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {dialogError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{dialogError}</div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Produktet
                {selectedItems.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({selectedItems.length} zgjedhur)
                  </span>
                )}
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {sortedDialogProducts.map((product) => {
                  const selected = isSelected(product.id);
                  const price    = getPriceForProduct(product.id);
                  const item     = selectedItems.find((i) => i.productId === product.id);
                  return (
                    <div key={product.id}>
                      <button
                        type="button"
                        onClick={() => toggleProduct(product.id)}
                        className={`w-full rounded-lg border-2 px-3 py-2 text-left transition-all ${
                          selected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card hover:border-primary/40 hover:bg-accent'
                        }`}
                      >
                        <p className="text-sm font-semibold leading-tight">{product.name}</p>
                        <p className="text-xs font-medium opacity-80 mt-0.5">{price} L</p>
                      </button>
                      {selected && item && (
                        <div className="flex items-center justify-between mt-1 px-1">
                          <span className="text-xs text-muted-foreground">Sasia:</span>
                          <div className="flex items-center gap-1">
                            <button type="button"
                              onClick={() => setQty(product.id, Math.max(0, (item.quantity ?? 0) - 1))}
                              className="h-6 w-6 rounded border flex items-center justify-center hover:bg-accent">
                              <Minus className="h-3 w-3" />
                            </button>
                            <Input
                              type="text" inputMode="numeric" pattern="[0-9]*"
                              value={item.quantity ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '');
                                setQty(product.id, raw === '' ? null : parseInt(raw));
                              }}
                              className="h-6 w-12 text-center text-xs px-1"
                            />
                            <button type="button"
                              onClick={() => setQty(product.id, (item.quantity ?? 0) + 1)}
                              className="h-6 w-6 rounded border flex items-center justify-center hover:bg-accent">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="k-notes" className="text-sm font-semibold">Shënime</Label>
              <Input
                id="k-notes"
                placeholder="Instruksione opsionale..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t px-5 py-4 shrink-0 space-y-3">
            {selectedItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedItems.map((item) => {
                  const p = products.find((pr) => pr.id === item.productId);
                  return p ? (
                    <span key={item.productId}
                      className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                      {p.name} ×{item.quantity}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Anulo
              </Button>
              <Button onClick={onSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ruaj ndryshimet
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
