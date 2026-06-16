import { useEffect, useState } from 'react';
import { Plus, Trash2, ShoppingCart, Package, Pencil, Truck, History, X, Minus, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/lib/api';
import { formatDateAL, formatDateTimeAL } from '@/lib/date';
import { printShopReceiptUSB } from '@/lib/printPreventiv';
import { useAuth } from '@/context/AuthContext';
import type { ShopProduct, ShopSale, Delivery, DeliveryStatus } from '@/types';

interface CartItem { shopProductId: string; name: string; quantity: number; unitPrice: number }

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

type Tab = 'history' | 'deliveries' | 'products';

export function ShopPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [sales, setSales] = useState<ShopSale[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('history');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleNotes, setSaleNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [lastSale, setLastSale] = useState<ShopSale | null>(null);

  // Product management
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

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

  // ── Cart logic ─────────────────────────────────────────────────
  function addToCart(product: ShopProduct) {
    setCart((prev) => {
      const existing = prev.find((i) => i.shopProductId === product.id);
      if (existing) {
        return prev.map((i) => i.shopProductId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { shopProductId: product.id, name: product.name, quantity: 1, unitPrice: Number(product.price) }];
    });
  }

  function setCartQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.shopProductId !== productId));
    } else {
      setCart((prev) => prev.map((i) => i.shopProductId === productId ? { ...i, quantity: qty } : i));
    }
  }

  function clearCart() {
    setCart([]);
    setSaleNotes('');
    setSaleError('');
  }

  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  function getCartQty(productId: string) {
    return cart.find((i) => i.shopProductId === productId)?.quantity ?? 0;
  }

  async function checkout() {
    if (cart.length === 0) return;
    setSaleError('');
    setSubmitting(true);
    try {
      const res = await api.post('/shop/sales', { items: cart, notes: saleNotes || undefined });
      clearCart();
      await load();
      setLastSale(res.data.sale ?? null);
      setActiveTab('history');
    } catch (err: any) {
      setSaleError(err.response?.data?.message || 'Ndodhi një gabim');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Product management ─────────────────────────────────────────
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

  async function deleteSale(id: string) {
    if (!confirm('Fshi këtë shitje?')) return;
    await api.delete(`/shop/sales/${id}`);
    await load();
  }

  const today = formatDateAL(new Date(), true);
  const totalToday = sales.reduce((s, sale) => s + sale.items.reduce((si, i) => si + i.quantity * Number(i.unitPrice), 0), 0);

  if (isLoading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shitjet e Dyqanit</h1>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-lg border bg-card animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Shitjet e Dyqanit</h1>
          <p className="text-muted-foreground text-sm">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total sot</p>
            <p className="text-xl font-bold text-green-600">{totalToday.toFixed(0)} L</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Shitje</p>
            <p className="text-xl font-bold">{sales.length}</p>
          </div>
        </div>
      </div>

      {/* Last sale confirmation banner */}
      {lastSale !== null && (
        <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 gap-2">
          <p className="text-sm font-medium text-green-800">
            Shitja u regjistrua! Totali: <span className="font-bold">{lastSale.items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0).toFixed(0)} L</span>
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-green-700" onClick={() => printShopReceiptUSB(lastSale!)}>
              <Printer className="h-3.5 w-3.5 mr-1" />Printo
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-700" onClick={() => setLastSale(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Main POS area: products + cart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Product grid */}
        <div className="lg:col-span-3">
          {shopProducts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground mb-3">Nuk ka produkte të shtuara.</p>
                <Button size="sm" onClick={openAddProduct}>
                  <Plus className="h-4 w-4 mr-1" /> Shto Produkt
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {shopProducts.map((p) => {
                const qty = getCartQty(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all active:scale-95 focus:outline-none ${
                      qty > 0
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                    }`}
                  >
                    {qty > 0 && (
                      <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {qty}
                      </span>
                    )}
                    <p className="font-semibold text-sm leading-tight pr-6">{p.name}</p>
                    <p className="mt-1 text-lg font-bold text-primary">{Number(p.price).toFixed(0)} L</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="lg:col-span-2">
          <Card className="sticky top-4">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Shporta
                {cartCount > 0 && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{cartCount} artikuj</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Asnjë produkt i zgjedhur.<br />Trokit mbi produkt për ta shtuar.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.shopProductId} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.unitPrice} L / copë</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6"
                            onClick={() => setCartQty(item.shopProductId, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6"
                            onClick={() => setCartQty(item.shopProductId, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="w-14 text-right text-sm font-semibold shrink-0">
                          {(item.quantity * item.unitPrice).toFixed(0)} L
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Totali</span>
                      <span className="text-xl font-bold text-green-600">{cartTotal.toFixed(0)} L</span>
                    </div>
                    <Input
                      value={saleNotes}
                      onChange={(e) => setSaleNotes(e.target.value)}
                      placeholder="Shënime (opsionale)"
                      className="text-sm h-8"
                    />
                    {saleError && <p className="text-xs text-destructive">{saleError}</p>}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={clearCart} className="flex-1">
                        Pastro
                      </Button>
                      <Button onClick={checkout} disabled={submitting} className="flex-1">
                        {submitting ? 'Duke...' : 'Regjistro'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom tabs: History / Deliveries / Products */}
      <div>
        <div className="flex gap-1 border-b mb-3">
          {([
            { key: 'history', label: 'Shitjet Sot', icon: History },
            { key: 'deliveries', label: 'Dërgesat', icon: Truck },
            { key: 'products', label: 'Produktet', icon: Package },
          ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {key === 'history' && sales.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">{sales.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* History tab */}
        {activeTab === 'history' && (
          <div className="space-y-2">
            {sales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nuk ka shitje të regjistruara sot.</p>
            ) : (
              sales.map((sale) => {
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
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm font-bold text-green-600">{total.toFixed(0)} L</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printShopReceiptUSB(sale)}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteSale(sale.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Deliveries tab */}
        {activeTab === 'deliveries' && (
          <div className="space-y-2">
            {deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nuk ka dërgesa të regjistruara sot.</p>
            ) : (
              deliveries.map((delivery) => (
                <div key={delivery.id} className="rounded-md border px-3 py-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      {delivery.createdBy.name} · {formatDateTimeAL(delivery.deliveryDate).split(' ')[1]}
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
              ))
            )}
          </div>
        )}

        {/* Products tab */}
        {activeTab === 'products' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openAddProduct}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Shto Produkt
              </Button>
            </div>
            {shopProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nuk ka produkte.</p>
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
                      {isAdmin && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteProduct(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
    </div>
  );
}
