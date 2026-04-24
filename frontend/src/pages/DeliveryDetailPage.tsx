import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Phone, CheckCircle2, Clock, XCircle,
  Banknote, Loader2, Trash2, User, CalendarDays, StickyNote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';
import type { Delivery } from '@/types';
import { useAuth } from '@/context/AuthContext';

const statusConfig = {
  PENDING:   { label: 'Në pritje',  icon: Clock,        color: 'warning'     as const },
  COMPLETED: { label: 'Kryer',      icon: CheckCircle2, color: 'success'     as const },
  CANCELLED: { label: 'Anuluar',    icon: XCircle,      color: 'destructive' as const },
};

export function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [delivery, setDelivery] = useState<Delivery & { totalPrice?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    api.get(`/deliveries/${id}`)
      .then((res) => setDelivery(res.data.delivery))
      .catch(() => setError('Dërgimi nuk u gjet'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const markStatus = async (status: 'COMPLETED' | 'CANCELLED') => {
    if (!delivery) return;
    setIsUpdating(true);
    try {
      const res = await api.patch(`/deliveries/${delivery.id}/status`, { status });
      setDelivery(res.data.delivery);
    } catch {
      setError('Ndryshimi dështoi');
    } finally {
      setIsUpdating(false);
    }
  };

  const togglePaid = async () => {
    if (!delivery) return;
    setIsUpdating(true);
    try {
      const res = await api.patch(`/deliveries/${delivery.id}/paid`);
      setDelivery((prev) => prev ? { ...prev, isPaid: res.data.delivery.isPaid } : prev);
    } catch {
      setError('Ndryshimi dështoi');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!delivery || !confirm('Fshi këtë dërgim?')) return;
    await api.delete(`/deliveries/${delivery.id}`);
    navigate('/deliveries');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Kthehu
        </Button>
        <p className="text-destructive">{error || 'Dërgimi nuk u gjet'}</p>
      </div>
    );
  }

  const cfg = statusConfig[delivery.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back */}
      <Button variant="ghost" className="gap-2 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" /> Kthehu
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{delivery.client.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={cfg.color} className="gap-1">
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
        </div>
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive gap-2"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" /> Fshi
          </Button>
        )}
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Client info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Klienti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold">{delivery.client.name}</p>
            {delivery.client.address && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />{delivery.client.address}
              </p>
            )}
            {delivery.client.phone && (
              <a
                href={`tel:${delivery.client.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />{delivery.client.phone}
              </a>
            )}
          </CardContent>
        </Card>

        {/* Delivery info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Detajet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="flex items-center gap-2 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Shpërndarësi:</span>
              <span className="font-medium">{delivery.createdBy.name}</span>
            </p>
            <p className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Data:</span>
              <span className="font-medium">
                {new Date(delivery.deliveryDate).toLocaleDateString('sq-AL', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </span>
            </p>
            {delivery.notes && (
              <p className="flex items-start gap-2 text-sm">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground italic">{delivery.notes}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium">Produktet</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {delivery.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground">{item.product.category}</p>
                </div>
                <span className="text-sm font-bold text-primary">×{item.quantity}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {delivery.status === 'PENDING' && (
          <>
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => markStatus('COMPLETED')}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Shëno si kryer
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
              onClick={() => markStatus('CANCELLED')}
              disabled={isUpdating}
            >
              <XCircle className="h-4 w-4" /> Anulo
            </Button>
          </>
        )}
        {delivery.status === 'COMPLETED' && (
          <Button
            variant={delivery.isPaid ? 'outline' : 'default'}
            className={`gap-2 ${delivery.isPaid ? '' : 'bg-green-600 hover:bg-green-700'}`}
            onClick={togglePaid}
            disabled={isUpdating}
          >
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
            {delivery.isPaid ? 'Shëno pa paguar' : 'Shëno si paguar'}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
    </div>
  );
}
