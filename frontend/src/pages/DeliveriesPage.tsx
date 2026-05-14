import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, MapPin, Phone, CheckCircle2, Clock, XCircle, Minus, Banknote, ChevronRight, CalendarDays, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import type { Delivery, Client, ClientProductPrice, Product, User as UserType, DailyStock } from '@/types';
import { useAuth } from '@/context/AuthContext';

import { todayLocalISO, formatDateAL } from '@/lib/date';

function todayISO() {
  return todayLocalISO();
}

function formatDate(d: string) {
  return formatDateAL(d, true);
}

const statusConfig = {
  PENDING:   { label: 'Në pritje',  icon: Clock,         badge: 'warning'     as const },
  COMPLETED: { label: 'Kryer',      icon: CheckCircle2,  badge: 'success'     as const },
  CANCELLED: { label: 'Anuluar',    icon: XCircle,       badge: 'destructive' as const },
};

// Selected product with quantity
interface SelectedItem { productId: string; quantity: number | null }

export function DeliveriesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const [deliveries, setDeliveries]   = useState<Delivery[]>([]);
  const [clients, setClients]         = useState<Client[]>([]);
  const [products, setProducts]       = useState<Product[]>([]);
  const [staffUsers, setStaffUsers]   = useState<UserType[]>([]);
  const [clientPrices, setClientPrices] = useState<ClientProductPrice[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [serverError, setServerError] = useState('');
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [dateFilter, setDateFilter]   = useState(todayISO());
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [dailyStock, setDailyStock]   = useState<DailyStock | null>(null);

  // Form state (managed manually for this simple UI)
  const [selectedClientId, setSelectedClientId] = useState('');
  const [notes, setNotes]                       = useState('');
  const [selectedItems, setSelectedItems]       = useState<SelectedItem[]>([]);
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [editingDelivery, setEditingDelivery]   = useState<Delivery | null>(null);

  const today = todayISO();

  // ── data fetching ──────────────────────────────────────────────
  const fetchDeliveries = () => {
    setIsLoading(true);
    const params: Record<string, string> = { date: isAdmin ? dateFilter : today };
    if (isAdmin && staffFilter !== 'ALL') params.staffId = staffFilter;
    if (isAdmin && clientFilter !== 'ALL') params.clientId = clientFilter;
    api.get('/deliveries', { params })
      .then((res) => setDeliveries(res.data.deliveries))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchDeliveries(); }, [staffFilter, clientFilter, dateFilter]);

  useEffect(() => {
    api.get('/clients').then((res) => setClients(res.data.clients));
    api.get('/products').then((res) => setProducts(res.data.products));
    api.get('/daily-stock/today').then((res) => setDailyStock(res.data.entry)).catch(() => {});
    if (isAdmin) api.get('/auth/staff-users').then((res) => setStaffUsers(res.data.users));
  }, [isAdmin]);

  // Load per-client prices when client changes
  useEffect(() => {
    if (!selectedClientId) { setClientPrices([]); return; }
    api.get(`/clients/${selectedClientId}`)
      .then((res) => setClientPrices(res.data.client.prices || []))
      .catch(() => setClientPrices([]));
  }, [selectedClientId]);

  function getPriceForProduct(productId: string): number {
    const entry = clientPrices.find((p) => p.productId === productId);
    return entry ? Number(entry.price) : Number(products.find((p) => p.id === productId)?.price ?? 0);
  }

  // ── dialog helpers ─────────────────────────────────────────────
  const openCreate = () => {
    setEditingDelivery(null);
    setSelectedClientId('');
    setNotes('');
    setSelectedItems([]);
    setServerError('');
    setDialogOpen(true);
  };

  const openEdit = (delivery: Delivery) => {
    setEditingDelivery(delivery);
    setSelectedClientId(delivery.clientId);
    setNotes(delivery.notes || '');
    setSelectedItems(delivery.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
    setServerError('');
    setDialogOpen(true);
  };

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

  const isSelected = (productId: string) => selectedItems.some((i) => i.productId === productId);

  const onSubmit = async () => {
    setServerError('');
    if (!selectedClientId) { setServerError('Zgjidhni një klient'); return; }
    const itemsToSend = selectedItems.filter((i) => (i.quantity ?? 0) > 0);
    if (itemsToSend.length === 0) { setServerError('Zgjidhni të paktën një produkt me sasi > 0'); return; }
    setIsSubmitting(true);
    try {
      if (editingDelivery) {
        await api.patch(`/deliveries/${editingDelivery.id}`, { notes: notes || undefined, items: itemsToSend });
      } else {
        await api.post('/deliveries', { clientId: selectedClientId, notes: notes || undefined, items: itemsToSend });
      }
      setDialogOpen(false);
      fetchDeliveries();
      api.get('/daily-stock/today').then((res) => setDailyStock(res.data.entry)).catch(() => {});
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error.response?.data?.message || 'Operacioni dështoi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── delivery actions ───────────────────────────────────────────
  const togglePaid = async (id: string) => {
    setUpdatingId(id);
    try {
      const res = await api.patch(`/deliveries/${id}/paid`);
      setDeliveries((prev) => prev.map((d) => (d.id === id ? res.data.delivery : d)));
    } catch (err) { console.error(err); }
    finally { setUpdatingId(null); }
  };

  const markStatus = async (id: string, status: 'COMPLETED' | 'CANCELLED') => {
    setUpdatingId(id);
    try {
      const res = await api.patch(`/deliveries/${id}/status`, { status });
      setDeliveries((prev) => prev.map((d) => (d.id === id ? res.data.delivery : d)));
    } catch (err) { console.error(err); }
    finally { setUpdatingId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Fshi këtë dërgim?')) return;
    await api.delete(`/deliveries/${id}`);
    fetchDeliveries();
  };

  // ── products available today (from daily stock if open, else all) ─
  const stockItemMap = Object.fromEntries(
    (dailyStock?.items ?? []).map((i) => [i.productId, i.remaining])
  );
  const hasDailyStock = dailyStock !== null;

  const LEFT_COLUMN  = ['Panine', 'Vogel Tregu', 'Vogel Fshati', 'Vogel Zeze', 'Vogel Integrale', 'Bageti', 'Thekrore', 'Veroll', 'Topa', 'Kulure 2 cope', 'Mistri'];
  const RIGHT_COLUMN = ['Madhe Tregu', 'Madhe Fshati', 'Madhe Integrale', 'Byrek'];
  const norm = (s: string) => s.toLowerCase().trim();
  const getByName = (name: string) => products.find((p) => norm(p.name) === norm(name)) ?? null;

  const pendingCount   = deliveries.filter((d) => d.status === 'PENDING').length;
  const completedCount = deliveries.filter((d) => d.status === 'COMPLETED').length;
  const grandTotal     = deliveries.reduce((s, d) => s + (d.totalPrice ?? 0), 0);
  const paidTotal      = deliveries.filter((d) => d.isPaid).reduce((s, d) => s + (d.totalPrice ?? 0), 0);

  // ── render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dërgimet e Sotme</h1>
          <p className="text-muted-foreground capitalize">{formatDate(today)}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Krijo dërgim
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm">
          <Clock className="h-4 w-4 text-yellow-500" />
          <span className="font-semibold">{pendingCount}</span>
          <span className="text-muted-foreground">në pritje</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="font-semibold">{completedCount}</span>
          <span className="text-muted-foreground">kryer</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm">
          <Banknote className="h-4 w-4 text-primary" />
          <span className="font-semibold text-green-600">{grandTotal.toFixed(0)} L</span>
          <span className="text-muted-foreground">total</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{paidTotal.toFixed(0)} L</span>
          <span className="text-muted-foreground">paguar</span>
        </div>
      </div>

      {/* Admin filters */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-sm flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />Data:
            </Label>
            <Input type="date" value={dateFilter === 'all' ? '' : dateFilter} onChange={(e) => setDateFilter(e.target.value || today)} className="h-8 w-36 text-sm" />
            <Button size="sm" variant={dateFilter === today ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setDateFilter(today)}>Sot</Button>
            <Button size="sm" variant={dateFilter === 'all' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setDateFilter('all')}>Të gjitha</Button>
          </div>
          {staffUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-sm">Stafi:</Label>
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Të gjithë</SelectItem>
                  {staffUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-sm">Klienti:</Label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Të gjithë</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Delivery list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : deliveries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">Nuk ka dërgime për sot.</p>
            <Button onClick={openCreate} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Krijo dërgimin e parë
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deliveries.map((delivery) => {
            const cfg = statusConfig[delivery.status];
            const StatusIcon = cfg.icon;
            const isUpdating = updatingId === delivery.id;

            return (
              <Card key={delivery.id} className={delivery.status === 'COMPLETED' ? 'opacity-70' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-base">{delivery.client.name}</p>
                        <Badge variant={cfg.badge} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                        {delivery.status === 'COMPLETED' && (
                          <Badge
                            variant={delivery.isPaid ? 'default' : 'destructive'}
                            className={delivery.isPaid ? 'bg-green-600' : ''}
                          >
                            {delivery.isPaid ? 'Paguar' : 'Pa paguar'}
                          </Badge>
                        )}
                      </div>
                      {isAdmin && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Shpërndarësi: {delivery.createdBy.name}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {delivery.client.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />{delivery.client.address}
                          </span>
                        )}
                        {delivery.client.phone && (
                          <a href={`tel:${delivery.client.phone}`} className="flex items-center gap-1 hover:text-primary">
                            <Phone className="h-3.5 w-3.5" />{delivery.client.phone}
                          </a>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {delivery.items.map((item) => (
                          <span key={item.id} className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                            {item.product.name}
                            <span className="ml-1 font-bold text-primary">×{item.quantity}</span>
                          </span>
                        ))}
                      </div>
                      {delivery.notes && (
                        <p className="mt-2 text-xs italic text-muted-foreground">📝 {delivery.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 items-end">
                      {delivery.totalPrice !== undefined && (
                        <span className="text-lg font-bold text-primary">{delivery.totalPrice.toFixed(0)} L</span>
                      )}
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => navigate(`/deliveries/${delivery.id}`)}
                        >
                          Detajet <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => openEdit(delivery)}
                        >
                          <Pencil className="h-3.5 w-3.5" />Ndrysho
                        </Button>
                        {delivery.status === 'PENDING' && (
                          <>
                            <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700"
                              onClick={() => markStatus(delivery.id, 'COMPLETED')} disabled={isUpdating}>
                              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              Shëno si kryer
                            </Button>
                            <Button size="sm" variant="outline"
                              className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
                              onClick={() => markStatus(delivery.id, 'CANCELLED')} disabled={isUpdating}>
                              <XCircle className="h-4 w-4" />Anulo
                            </Button>
                          </>
                        )}
                        {delivery.status === 'COMPLETED' && (
                          <Button
                            size="sm"
                            variant={delivery.isPaid ? 'outline' : 'default'}
                            className={`gap-1.5 ${delivery.isPaid ? '' : 'bg-green-600 hover:bg-green-700'}`}
                            onClick={() => togglePaid(delivery.id)}
                            disabled={isUpdating}
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            {delivery.isPaid ? 'Pa paguar' : 'Paguar'}
                          </Button>
                        )}
                        {isAdmin && (
                          <Button size="sm" variant="ghost"
                            className="text-destructive hover:text-destructive gap-2"
                            onClick={() => handleDelete(delivery.id)}>
                            <Trash2 className="h-3.5 w-3.5" />Fshi
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create Delivery Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle>{editingDelivery ? `Ndrysho dërgimin — ${editingDelivery.client.name}` : 'Dërgim i ri'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {!hasDailyStock && (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                Stoku ditor nuk është hapur sot. Po shfaqen të gjitha produktet.
              </div>
            )}
            {serverError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</div>
            )}

            {/* 1. Client dropdown (hidden when editing) */}
            {!editingDelivery && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Klienti</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Zgjidhni klientin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.address ? ` — ${c.address}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 2. Product buttons — fixed 2 columns */}
            <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Produktet
                  {selectedItems.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({selectedItems.length} zgjedhur)
                    </span>
                  )}
                </Label>
                <div className="flex gap-3">
                  {[LEFT_COLUMN, RIGHT_COLUMN].map((col, ci) => (
                    <div key={ci} className="flex-1 space-y-1.5">
                      {col.map((name) => {
                        const product = getByName(name);
                        if (!product) return null;
                        const selected = isSelected(product.id);
                        const price = getPriceForProduct(product.id);
                        const item = selectedItems.find((i) => i.productId === product.id);
                        const remaining = stockItemMap[product.id] ?? null;
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
                              <div className="flex items-center justify-between mt-0.5">
                                <p className="text-xs font-medium opacity-80">{price} L</p>
                                {remaining !== null && (
                                  <p className={`text-xs font-semibold ${remaining <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    {remaining}
                                  </p>
                                )}
                              </div>
                            </button>
                            {selected && item && (
                              <div className="flex items-center justify-between mt-1 px-1">
                                <span className="text-xs text-muted-foreground">Sasia:</span>
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => setQty(product.id, Math.max(0, (item.quantity ?? 0) - 1))} className="h-6 w-6 rounded border flex items-center justify-center hover:bg-accent">
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <Input type="text" inputMode="numeric" pattern="[0-9]*" value={item.quantity ?? ''} onChange={(e) => { const raw = e.target.value.replace(/\D/g, ''); setQty(product.id, raw === '' ? null : parseInt(raw)); }} className="h-6 w-12 text-center text-xs px-1" />
                                  <button type="button" onClick={() => setQty(product.id, (item.quantity ?? 0) + 1)} className="h-6 w-6 rounded border flex items-center justify-center hover:bg-accent">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
            </div>

            {/* 3. Notes */}
            <div className="space-y-2">
              <Label htmlFor="d-notes" className="text-sm font-semibold">Shënime</Label>
              <Input
                id="d-notes"
                placeholder="Instruksione opsionale..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer with summary */}
          <div className="border-t px-5 py-4 shrink-0 space-y-3">
            {selectedItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedItems.map((item) => {
                  const p = products.find((pr) => pr.id === item.productId);
                  return p ? (
                    <span key={item.productId} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
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
                {editingDelivery ? 'Ruaj ndryshimet' : 'Krijo dërgimin'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
