import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/api';
import type { Product } from '@/types';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.coerce.number().positive('Price must be positive'),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  category: z.string().min(1, 'Category is required'),
});

type ProductFormData = z.infer<typeof productSchema>;

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({ resolver: zodResolver(productSchema) });

  const fetchProducts = () => {
    setIsLoading(true);
    api
      .get('/products')
      .then((res) => setProducts(res.data.products))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openCreate = () => {
    setEditingProduct(null);
    reset({ name: '', description: '', price: 0, stock: 0, category: '' });
    setServerError('');
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    reset({
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      category: product.category,
    });
    setServerError('');
    setDialogOpen(true);
  };

  const onSubmit = async (data: ProductFormData) => {
    setServerError('');
    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, data);
      } else {
        await api.post('/products', data);
      }
      setDialogOpen(false);
      fetchProducts();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error.response?.data?.message || 'Operacioni dështoi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Fshi këtë produkt?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produktet</h1>
          <p className="text-muted-foreground">Menaxho katalogun e furrës</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Shto produkt
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Ende nuk ka produkte. Shto produktin e parë!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="flex flex-col">
              <CardContent className="flex flex-col flex-1 p-5 gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{product.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0">{product.category}</Badge>
                </div>

                <div className="flex items-center justify-between mt-auto pt-2 border-t">
                  <div>
                    <p className="text-lg font-bold text-primary">{Number(product.price).toFixed(0)} L</p>
                    <p className="text-xs text-muted-foreground">{product.stock} in stock</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Ndrysho produktin' : 'Produkt i ri'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-2">
              {serverError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="p-name">Emri</Label>
                <Input id="p-name" placeholder="Kroasan" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-desc">Përshkrimi</Label>
                <Input id="p-desc" placeholder="Përshkrim opsional" {...register('description')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-price">Çmimi (L)</Label>
                  <Input id="p-price" type="number" step="0.01" placeholder="2.50" {...register('price')} />
                  {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-stock">Sasia</Label>
                  <Input id="p-stock" type="number" placeholder="10" {...register('stock')} />
                  {errors.stock && <p className="text-xs text-destructive">{errors.stock.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cat">Kategoria</Label>
                <Input id="p-cat" placeholder="Bukë, Pastë, Tortë..." {...register('category')} />
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Anulo
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingProduct ? 'Ruaj ndryshimet' : 'Krijo produkt'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
