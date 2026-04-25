import { useEffect, useState } from 'react';
import { Plus, Trash2, ShoppingCart, Package, Pencil, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/lib/api';
import type { ShopProduct, ShopSale, Delivery, DeliveryStatus } from '@/types';

interface SaleItem { shopProductId: string; name: string; quantity: number; unitPrice: number }

const statusLabel: Record<DeliveryStatus, string> = {
  PENDING: 'Në pritje',
  COMPLETED: 'Dërguar',
  CANCELLED: 'Anuluar',
};

const statusClass: Record<DeliveryStatus, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-muted text-muted-foreground border',
};

export function ShopPage() {
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [sales, setSales] = useState<ShopSale[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // manage shop products
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

  // create sale
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleNotes, setSaleNotes] = useState('');
  const [submittingSale, setSubmittingSale] = useState(false);
  const [saleError, setSaleError] = useState('');

  async function load() {
    setIsLoading(true);
    try {
      const [productsRes, salesRes, deliveriesRes] = await Promise.all([
        api.get('/shop/products'),
        api.get('/shop/sales'),
        api.get('/shop/my-deliveries'),
      ]);
      setShopProducts(productsRes.data.products);
      setSales(salesRes.data.sales);
      setDeliveries(deliveriesRes.data.deliveries);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Shop product management ────────────────────────────────────
  function openAddProduct() {
    setEditingProduct(null);
    setProductName('');
    setProductPrice('');
    setShowProductForm(true);
  }

  function openEditProduct(p: ShopProduct) {
    setEditingProduct(p);
    setProductName(p.name);
    setProductPrice(String(p.price));
    setShowProductForm(true);
  }

  async function saveProduct() {
    setSavingProduct(true);
    try {
      if (editingProduct) {
        await api.patch(`/shop/products/${editingProduct.id}`, { name: productName, price: Number(productPrice) });
      } else {
        await api.post('/shop/products', { name: productName, price: Number(productPrice) });
      }
      setShowProductForm(false);
      await load();
    } finally {
      setSavingProduct(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Fshi produktin?')) return;
    await api.delete(`/shop/products/${id}`);
    await load();
  }

  // ── Sale creation ──────────────────────────────────────────────
  function openSaleDialog() {
    setSaleItems(shopProducts.map((p) => ({ shopProductId: p.id, name: p.name, quantity: 0, unitPrice: Number(p.price) })));
    setSaleNotes('');
    setSaleError('');
    setShowSaleDialog(true);
  }

  function setItemQty(productId: string, qty: number) {
    setSaleItems((prev) => prev.map((i) => i.shopProductId === productId ? { ...i, quantity: Math.max(0, qty) } : i));
  }

  async function submitSale() {
    const items = saleItems.filter((i) => i.quantity > 0);
    if (items.length === 0) { setSaleError('Vendosni sasinë për të paktën një produkt'); return; }
    setSaleError('');
    setSubmittingSale(true);
    try {
      await api.post('/shop/sales', { items, notes: saleNotes || undefined });
      setShowSaleDialog(false);
      await load();
    } catch (err: any) {
      setSaleError(err.response?.data?.message || 'Ndodhi një gabim');
    } finally {
      setSubmittingSale(false);
    }
  }

  async function deleteSale(id: string) {
    if (!confirm('Fshi këtë shitje?')) return;
    await api.delete(`/shop/sales/${id}`);
    await load();
  }

  const today = new Date().toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' });
  const totalToday = sales.reduce((s, sale) => s + sale.items.reduce((si, i) => si + i.quantity * Number(i.unitPrice), 0), 0);
  const completedDeliveries = deliveries.filter((d) => d.status === 'COMPLETED');
  const totalDelivered = completedDeliveries.reduce((s, d) => s + d.items.reduce((si, i) => si + i.quantity, 0), 0);

  if (isLoading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shitjet e Dyqanit</h1>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-lg border bg-card animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Shitjet e Dyqanit</h1>
          <p className="text-muted-foreground">{today}</p>
        </div>
        <Button onClick={openSaleDialog} disabled={shopProducts.length === 0}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Regjistro shitje
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Shitje sot</p>
          <p className="text-2xl font-bold mt-0.5">{sales.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total sot</p>
          <p className="text-2xl font-bold mt-0.5 text-green-600">{totalToday.toFixed(0)} L</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Dërguar nga furra</p>
          <p className="text-2xl font-bold mt-0.5 text-primary">{totalDelivered} copë</p>
        </CardContent></Card>
      </div>

      {/* Deliveries from bakery */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            Dërgesat nga Furra Sot
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nuk ka dërgesa të regjistruara sot.</p>
          ) : (
            <div className="space-y-2">
              {deliveries.map((delivery) => (
                <div key={delivery.id} className="rounded-md border px-3 py-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      {delivery.createdBy.name} · {new Date(delivery.deliveryDate).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass[delivery.status]}`}>
                      {statusLabel[delivery.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {delivery.items.map((item) => (
                      <span key={item.id} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                        {item.product.name} <span className="ml-1 font-bold">×{item.quantity}</span>
                      </span>
                    ))}
                  </div>
                  {delivery.notes && <p className="text-xs text-muted-foreground mt-1 italic">{delivery.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shop products */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produktet e Dyqanit
            </CardTitle>
            <Button size="sm" variant="outline" onClick={openAddProduct}>
              <Plus className="h-3.5 w-3.5 mr-1" />Shto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {shopProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nuk ka produkte. Shto produktet e dyqanit tuaj.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {shopProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{Number(p.price).toFixed(0)} L</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditProduct(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteProduct(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales today */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Shitjet e Sotme</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nuk ka shitje të regjistruara sot.</p>
          ) : (
            <div className="space-y-2">
              {sales.map((sale) => {
                const total = sale.items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
                return (
                  <div key={sale.id} className="flex items-center justify-between rounded-md border px-3 py-2.5 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5">
                        {sale.items.map((item) => (
                          <span key={item.id} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                            {item.shopProduct.name} <span className="ml-1 font-bold">×{item.quantity}</span>
                          </span>
                        ))}
                      </div>
                      {sale.notes && <p className="text-xs text-muted-foreground mt-1 italic">{sale.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-green-600">{total.toFixed(0)} L</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteSale(sale.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit product dialog */}
      <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Ndrysho Produktin' : 'Shto Produkt të Ri'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Emri i produktit</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="p.sh. Ujë, Kafe..." />
            </div>
            <div className="space-y-1">
              <Label>Çmimi (L)</Label>
              <Input type="number" min={0} value={productPrice} onChange={(e) => setProductPrice(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowProductForm(false)}>Anulo</Button>
              <Button onClick={saveProduct} disabled={savingProduct || !productName.trim()}>
                {savingProduct ? 'Duke ruajtur...' : 'Ruaj'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record sale dialog */}
      <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle>Regjistro Shitje</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {saleError && <p className="text-sm text-destructive">{saleError}</p>}
            {saleItems.map((item) => (
              <div key={item.shopProductId} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.unitPrice} L / copë</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setItemQty(item.shopProductId, item.quantity - 1)}>-</Button>
                  <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setItemQty(item.shopProductId, item.quantity + 1)}>+</Button>
                </div>
              </div>
            ))}
            <div className="space-y-1 pt-2">
              <Label className="text-xs">Shënime (opsionale)</Label>
              <Input value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} placeholder="..." />
            </div>
            {saleItems.filter((i) => i.quantity > 0).length > 0 && (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs font-semibold mb-1">Totali:</p>
                <p className="text-lg font-bold text-green-600">
                  {saleItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(0)} L
                </p>
              </div>
            )}
          </div>
          <div className="border-t px-5 py-3 shrink-0 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSaleDialog(false)}>Anulo</Button>
            <Button onClick={submitSale} disabled={submittingSale}>
              {submittingSale ? 'Duke ruajtur...' : 'Regjistro'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
