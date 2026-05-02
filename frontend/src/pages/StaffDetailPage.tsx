import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDateAL } from '@/lib/date';
import { ArrowLeft, Banknote, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import api from '@/lib/api';
import type { Delivery } from '@/types';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

function statusLabel(status: string) {
  if (status === 'COMPLETED') return { label: 'Dërguar', icon: CheckCircle2, color: 'text-green-600' };
  if (status === 'CANCELLED') return { label: 'Anuluar', icon: XCircle, color: 'text-destructive' };
  return { label: 'Në pritje', icon: Clock, color: 'text-orange-500' };
}

export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([
      api.get('/auth/staff-users'),
      api.get('/deliveries', { params: { staffId: id } }),
    ])
      .then(([staffRes, deliveriesRes]) => {
        const found = staffRes.data.users.find((u: StaffUser) => u.id === id);
        setStaff(found ?? null);
        setDeliveries(deliveriesRes.data.deliveries);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-32 rounded-lg border bg-card animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (!staff) {
    return <p className="text-muted-foreground">Stafi nuk u gjet.</p>;
  }

  const initials = staff.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const totalAmount = deliveries.reduce((s, d) => s + (d.totalPrice ?? 0), 0);
  const paidAmount = deliveries.filter((d) => d.isPaid).reduce((s, d) => s + (d.totalPrice ?? 0), 0);
  const unpaidAmount = totalAmount - paidAmount;

  // Group by date descending
  const grouped: Record<string, Delivery[]> = {};
  for (const d of [...deliveries].sort((a, b) =>
    new Date(b.deliveryDate ?? b.createdAt).getTime() - new Date(a.deliveryDate ?? a.createdAt).getTime()
  )) {
    const key = formatDateAL(d.deliveryDate ?? d.createdAt, true);
    (grouped[key] ??= []).push(d);
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate('/staff')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Stafi
        </Button>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-primary-foreground font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{staff.name}</h1>
            <p className="text-sm text-muted-foreground">{staff.email}</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Totali</p>
            <p className="text-xl font-bold mt-0.5">{totalAmount.toFixed(0)} L</p>
            <p className="text-xs text-muted-foreground mt-0.5">{deliveries.length} dërgesa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Paguar</p>
            <p className="text-xl font-bold mt-0.5 text-green-600">{paidAmount.toFixed(0)} L</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Pa paguar</p>
            <p className="text-xl font-bold mt-0.5 text-destructive">{unpaidAmount.toFixed(0)} L</p>
          </CardContent>
        </Card>
      </div>

      {/* Delivery history */}
      {deliveries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Ky shpërndarës nuk ka dërgesa ende.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <Card key={dateLabel}>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">{dateLabel}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {items.map((d) => {
                  const st = statusLabel(d.status);
                  const Icon = st.icon;
                  return (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${st.color}`} />
                          <span className="text-sm font-medium">{d.client?.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.items.map((i) => `${i.product.name} ×${i.quantity}`).join(', ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={d.isPaid ? 'default' : 'destructive'} className={d.isPaid ? 'bg-green-600' : ''}>
                          <Banknote className="h-3 w-3 mr-1" />
                          {d.isPaid ? 'Paguar' : 'Pa paguar'}
                        </Badge>
                        <span className="text-sm font-bold text-primary">{(d.totalPrice ?? 0).toFixed(0)} L</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
