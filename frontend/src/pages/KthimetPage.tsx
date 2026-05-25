import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, CheckCircle2, Minus, CalendarDays, Pencil, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import type { Return, Client, ClientProductPrice, Product, User as UserType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { todayLocalISO, formatDateAL } from '@/lib/date';

function todayISO() {
  return todayLocalISO();
}

function formatDate(d: string) {
  return formatDateAL(d, true);
}


interface SelectedItem { productId: string; quantity: number | null }

export function KthimetPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const [returns, setReturns]           = useState<Return[]>([]);
  const [clients, setClients]           = useState<Client[]>([]);
  const [products, setProducts]         = useState<Product[]>([]);
  const [staffUsers, setStaffUsers]     = useState<UserType[]>([]);
  const [clientPrices, setClientPrices] = useState<ClientProductPrice[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [serverError, setServerError]   = useState('');
  const [staffFilter, setStaffFilter]   = useState('ALL');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [dateFilter, setDateFilter]     = useState(todayISO());

  const [selectedClientId, setSelectedClientId] = useState('');
  const [notes, setNotes]                       = useState('');
  const [selectedItems, setSelectedItems]       = useState<SelectedItem[]>([]);
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [editingReturn, setEditingReturn]       = useState<Return | null>(null);

  const today = todayISO();
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const fetchReturns = () => {
    setIsLoading(true);
    const params: Record<string, string> = { date: dateFilter };
    if (isAdmin && staffFilter !== 'ALL') params.staffId = staffFilter;
    if (clientFilter !== 'ALL') params.clientId = clientFilter;
    api.get('/kthimet', { params })
      .then((res) => setReturns(res.data.returns))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchReturns(); }, [staffFilter, clientFilter, dateFilter]);

  useEffect(() => {
    api.get('/clients').then((res) => setClients(res.data.clients));
    api.get('/products').then((res) => setProducts(res.data.products));
    if (isAdmin) api.get('/auth/staff-users').then((res) => setStaffUsers(res.data.users));
  }, [isAdmin]);

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

  const openCreate = () => {
    setEditingReturn(null);
    setSelectedClientId('');
    setNotes('');
    setSelectedItems([]);
    setServerError('');
    setDialogOpen(true);
  };

  const openEdit = (ret: Return) => {
    setEditingReturn(ret);
    setSelectedClientId(ret.clientId);
    setNotes(ret.notes || '');
    setSelectedItems(ret.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
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
      if (editingReturn) {
        await api.patch(`/kthimet/${editingReturn.id}`, { notes: notes || undefined, items: itemsToSend });
      } else {
        await api.post('/kthimet', { clientId: selectedClientId, notes: notes || undefined, items: itemsToSend });
      }
      setDialogOpen(false);
      fetchReturns();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error.response?.data?.message || 'Operacioni dështoi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Fshi këtë kthim?')) return;
    await api.delete(`/kthimet/${id}`);
    fetchReturns();
  };

  const deliveryProducts = products.filter((p) => p.showInDelivery);
  const sortedByPrice = [...deliveryProducts].sort(
    (a, b) => getPriceForProduct(a.id) - getPriceForProduct(b.id) || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="h-6 w-6" /> Kthimet
          </h1>
          <p className="text-muted-foreground capitalize">{formatDate(today)}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Krijo kthim
        </Button>
      </div>

      {/* Non-admin filters */}
      {!isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="date"
            value={dateFilter === 'all' ? '' : dateFilter}
            onChange={(e) => setDateFilter(e.target.value || today)}
            className="h-8 w-36 text-sm"
          />
          <Button size="sm" variant={dateFilter === today ? 'default' : 'outline'} className="h-8 text-xs px-3" onClick={() => setDateFilter(today)}>Sot</Button>
          <Button size="sm" variant={dateFilter === yesterday ? 'default' : 'outline'} className="h-8 text-xs px-3" onClick={() => setDateFilter(yesterday)}>Dje</Button>
          <Button size="sm" variant={dateFilter === 'all' ? 'default' : 'outline'} className="h-8 text-xs px-3" onClick={() => setDateFilter('all')}>Të gjitha</Button>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Klienti..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Të gjithë klientët</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Admin filters */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-sm flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Data:</span>
            </Label>
            <Input type="date" value={dateFilter === 'all' ? '' : dateFilter} onChange={(e) => setDateFilter(e.target.value || today)} className="h-8 flex-1 sm:flex-none sm:w-36 text-sm" />
            <Button size="sm" variant={dateFilter === today ? 'default' : 'outline'} className="h-8 text-xs px-2 sm:px-3 shrink-0" onClick={() => setDateFilter(today)}>Sot</Button>
            <Button size="sm" variant={dateFilter === 'all' ? 'default' : 'outline'} className="h-8 text-xs px-2 sm:px-3 shrink-0" onClick={() => setDateFilter('all')}>
              <span className="sm:hidden">Gjitha</span>
              <span className="hidden sm:inline">Të gjitha</span>
            </Button>
          </div>
          {staffUsers.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-sm hidden sm:block">Stafi:</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="h-8 w-full sm:w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Të gjithë</SelectItem>
                    {staffUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-sm hidden sm:block">Klienti:</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="h-8 w-full sm:w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Të gjithë</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {staffUsers.length === 0 && (
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-sm hidden sm:block">Klienti:</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-8 w-full sm:w-44 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Të gjithë</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : returns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">Nuk ka kthime.</p>
            <Button onClick={openCreate} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Krijo kthimin e parë
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="min-w-[600px] w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Data</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Klienti</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Dërgues</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Produktet</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Statusi</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {returns.map((ret) => (
                  <tr key={ret.id} className="bg-card hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                      {formatDate(ret.returnDate)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{ret.client.name}</p>
                      {ret.client.address && (
                        <p className="text-xs text-muted-foreground">{ret.client.address}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {ret.createdBy.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ret.items.map((item) => (
                          <span key={item.id} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {item.product.name}<span className="ml-1 font-bold text-primary">×{item.quantity}</span>
                          </span>
                        ))}
                      </div>
                      {ret.notes && (
                        <p className="text-xs italic text-muted-foreground mt-1">📝 {ret.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Kthyer
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="sm" variant="outline" className="gap-1.5 h-8"
                          onClick={() => openEdit(ret)}>
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Ndrysho</span>
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 h-8"
                          onClick={() => navigate(`/kthimet/${ret.id}`)}>
                          <span className="hidden sm:inline">Detajet</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(ret.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle>
              {editingReturn ? `Ndrysho kthimin — ${editingReturn.client.name}` : 'Kthim i ri'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {serverError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</div>
            )}

            {/* Client dropdown (hidden when editing) */}
            {!editingReturn && (
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

            {/* Product buttons */}
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
                {sortedByPrice.map((product) => {
                  const selected = isSelected(product.id);
                  const price = getPriceForProduct(product.id);
                  const item = selectedItems.find((i) => i.productId === product.id);
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
            </div>

            {/* Notes */}
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

          {/* Footer */}
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
                {editingReturn ? 'Ruaj ndryshimet' : 'Krijo kthimin'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
