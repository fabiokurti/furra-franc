import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Phone, MapPin, User, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/lib/api';
import type { Client, ClientProductPrice, Product, User as UserType } from '@/types';
import { useAuth } from '@/context/AuthContext';

const clientSchema = z.object({
  name: z.string().min(1, 'Emri është i detyrueshëm'),
  address: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  staffId: z.string().min(1, 'Zgjidhni një shpërndarës'),
});

type ClientFormData = z.infer<typeof clientSchema>;

// Per-product editable row
function PriceRow({
  product,
  currentPrice,
  defaultPrice,
  clientId,
  onSaved,
}: {
  product: Pick<Product, 'id' | 'name' | 'category'>;
  currentPrice: number | null;
  defaultPrice: number;
  clientId: string;
  onSaved: (productId: string, price: number) => void;
}) {
  const [value, setValue] = useState(String(currentPrice ?? defaultPrice));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) return;
    setSaving(true);
    try {
      await api.put(`/clients/${clientId}/prices/${product.id}`, { price });
      onSaved(product.id, price);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {/* silent */} finally {
      setSaving(false);
    }
  };

  const isDirty = parseFloat(value) !== (currentPrice ?? defaultPrice);

  return (
    <div className="flex items-center justify-between px-3 py-2 gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.category}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {currentPrice === null && (
          <span className="text-xs text-muted-foreground">def: {defaultPrice} L</span>
        )}
        <Input
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && isDirty && save()}
          className="h-7 w-20 text-xs text-right px-2"
        />
        <span className="text-xs text-muted-foreground">L</span>
        {saved ? (
          <Check className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <Button
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={!isDirty || saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ClientsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [clients, setClients] = useState<Client[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [serverError, setServerError] = useState('');
  const [expandedPrices, setExpandedPrices] = useState<string | null>(null);
  // priceCache: clientId -> map of productId -> price
  const [priceCache, setPriceCache] = useState<Record<string, Record<string, number>>>({});

  const togglePrices = async (clientId: string) => {
    if (expandedPrices === clientId) { setExpandedPrices(null); return; }
    setExpandedPrices(clientId);
    if (!priceCache[clientId]) {
      const res = await api.get(`/clients/${clientId}`);
      const prices: ClientProductPrice[] = res.data.client.prices || [];
      const map: Record<string, number> = {};
      for (const p of prices) map[p.productId] = Number(p.price);
      setPriceCache((prev) => ({ ...prev, [clientId]: map }));
    }
  };

  const handlePriceSaved = (clientId: string, productId: string, price: number) => {
    setPriceCache((prev) => ({
      ...prev,
      [clientId]: { ...(prev[clientId] || {}), [productId]: price },
    }));
  };

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({ resolver: zodResolver(clientSchema) });

  const selectedStaffId = watch('staffId');

  const fetchClients = () => {
    setIsLoading(true);
    api.get('/clients')
      .then((res) => setClients(res.data.clients))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchClients();
    if (isAdmin) {
      api.get('/auth/staff-users').then((res) => setStaffUsers(res.data.users));
      api.get('/products').then((res) => setAllProducts(res.data.products));
    }
  }, [isAdmin]);

  const openCreate = () => {
    setEditingClient(null);
    reset({ name: '', address: '', phone: '', notes: '', staffId: '' });
    setServerError('');
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    reset({ name: client.name, address: client.address || '', phone: client.phone || '', notes: client.notes || '', staffId: client.staffId });
    setServerError('');
    setDialogOpen(true);
  };

  const onSubmit = async (data: ClientFormData) => {
    setServerError('');
    try {
      if (editingClient) {
        await api.patch(`/clients/${editingClient.id}`, data);
      } else {
        await api.post('/clients', data);
      }
      setDialogOpen(false);
      fetchClients();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error.response?.data?.message || 'Operacioni dështoi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Fshi këtë klient?')) return;
    await api.delete(`/clients/${id}`);
    fetchClients();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Klientët</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Menaxho listën e klientëve dhe shpërndarësve' : 'Lista juaj e klientëve'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Shto klient
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {isAdmin ? 'Ende nuk ka klientë. Shto klientin e parë!' : 'Nuk keni klientë të caktuar.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => {
            const isExpanded = expandedPrices === client.id;
            const clientPriceMap = priceCache[client.id] || {};

            return (
              <Card key={client.id} className="flex flex-col">
                <CardContent className="flex flex-col flex-1 p-5 gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">{client.name}</p>
                      {isAdmin && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          <User className="h-3 w-3 mr-1" />{client.assignedTo?.name}
                        </Badge>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(client)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(client.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm text-muted-foreground mt-1">
                    {client.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{client.address}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.notes && (
                      <p className="text-xs italic line-clamp-2 pt-1 border-t">{client.notes}</p>
                    )}
                  </div>

                  {/* Price list toggle */}
                  <button
                    className="mt-3 flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                    onClick={() => togglePrices(client.id)}
                  >
                    <span>{isAdmin ? 'Ndrysho çmimet' : 'Çmimet (CMIMET)'}</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="rounded-md border overflow-hidden">
                      {isAdmin ? (
                        // Admin: all products with editable inputs
                        allProducts.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-3 text-center">Duke ngarkuar produktet...</p>
                        ) : (
                          <div className="divide-y max-h-64 overflow-y-auto">
                            {allProducts.map((product) => (
                              <PriceRow
                                key={product.id}
                                product={product}
                                currentPrice={clientPriceMap[product.id] ?? null}
                                defaultPrice={Number(product.price)}
                                clientId={client.id}
                                onSaved={(productId, price) => handlePriceSaved(client.id, productId, price)}
                              />
                            ))}
                          </div>
                        )
                      ) : (
                        // Staff: read-only
                        Object.keys(clientPriceMap).length === 0 ? (
                          <p className="text-xs text-muted-foreground p-3 text-center">Nuk ka çmime të regjistruara</p>
                        ) : (
                          <div className="divide-y max-h-48 overflow-y-auto">
                            {Object.entries(clientPriceMap).map(([productId, price]) => {
                              const product = allProducts.find((p) => p.id === productId);
                              return (
                                <div key={productId} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                  <span className="font-medium">{product?.name ?? productId}</span>
                                  <span className="text-primary font-bold">{price} L</span>
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      {isAdmin && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Ndrysho klientin' : 'Klient i ri'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-4 py-2">
                {serverError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="c-name">Emri *</Label>
                  <Input id="c-name" placeholder="Dyqani ABC" {...register('name')} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-address">Adresa</Label>
                  <Input id="c-address" placeholder="Rruga Skënderbej 12, Tiranë" {...register('address')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-phone">Telefoni</Label>
                  <Input id="c-phone" placeholder="+355 69 123 4567" {...register('phone')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-notes">Shënime</Label>
                  <Input id="c-notes" placeholder="Instruksione speciale..." {...register('notes')} />
                </div>
                <div className="space-y-2">
                  <Label>Shpërndarësi *</Label>
                  <Select value={selectedStaffId} onValueChange={(v) => setValue('staffId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Zgjidhni shpërndarësin" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.staffId && <p className="text-xs text-destructive">{errors.staffId.message}</p>}
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Anulo</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingClient ? 'Ruaj ndryshimet' : 'Shto klientin'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
