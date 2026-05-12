import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDateAL } from '@/lib/date';
import { ArrowLeft, MapPin, Phone, FileText, Banknote, CheckCircle2, Clock, XCircle, Printer, CheckCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import type { Client, Delivery } from '@/types';

function statusLabel(status: string) {
  if (status === 'COMPLETED') return { label: 'Dërguar', icon: CheckCircle2, color: 'text-green-600' };
  if (status === 'CANCELLED') return { label: 'Anuluar', icon: XCircle, color: 'text-destructive' };
  return { label: 'Në pritje', icon: Clock, color: 'text-orange-500' };
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAfterPrintConfirm, setShowAfterPrintConfirm] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([
      api.get(`/clients/${id}`),
      api.get('/deliveries', { params: { clientId: id } }),
    ])
      .then(([clientRes, deliveriesRes]) => {
        setClient(clientRes.data.client);
        setDeliveries(deliveriesRes.data.deliveries);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id]);

  const unpaidDeliveries = deliveries.filter((d) => !d.isPaid);

  const handlePrint = () => {
    const afterPrint = () => {
      window.removeEventListener('afterprint', afterPrint);
      if (unpaidDeliveries.length > 0) setShowAfterPrintConfirm(true);
    };
    window.addEventListener('afterprint', afterPrint);
    window.print();
  };

  const handleMarkAllPaid = async () => {
    setIsMarkingPaid(true);
    try {
      await Promise.all(unpaidDeliveries.map((d) => api.patch(`/deliveries/${d.id}/paid`)));
      setDeliveries((prev) => prev.map((d) => (d.isPaid ? d : { ...d, isPaid: true })));
      setShowAfterPrintConfirm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsMarkingPaid(false);
    }
  };

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

  if (!client) {
    return <p className="text-muted-foreground">Klienti nuk u gjet.</p>;
  }

  const totalAmount = deliveries.reduce((s, d) => s + (d.totalPrice ?? 0), 0);
  const paidAmount = deliveries.filter((d) => d.isPaid).reduce((s, d) => s + (d.totalPrice ?? 0), 0);
  const unpaidAmount = totalAmount - paidAmount;

  // Group deliveries by date
  const grouped: Record<string, Delivery[]> = {};
  for (const d of [...deliveries].sort((a, b) =>
    new Date(b.deliveryDate ?? b.createdAt).getTime() - new Date(a.deliveryDate ?? a.createdAt).getTime()
  )) {
    const key = formatDateAL(d.deliveryDate ?? d.createdAt, true);
    (grouped[key] ??= []).push(d);
  }

  // Group unpaid deliveries by date for the print section
  const unpaidGrouped: Record<string, Delivery[]> = {};
  for (const d of [...unpaidDeliveries].sort((a, b) =>
    new Date(a.deliveryDate ?? a.createdAt).getTime() - new Date(b.deliveryDate ?? b.createdAt).getTime()
  )) {
    const key = formatDateAL(d.deliveryDate ?? d.createdAt, true);
    (unpaidGrouped[key] ??= []).push(d);
  }

  return (
    <>
      {/* Print-only section — hidden on screen, shown during print */}
      <div className="hidden print:block p-6 font-sans text-black">
        <div className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          {client.address && <p className="text-sm mt-1">{client.address}</p>}
          {client.phone && <p className="text-sm">{client.phone}</p>}
          <p className="text-sm mt-2 text-gray-500">
            Fatura — {formatDateAL(new Date())}
          </p>
        </div>

        {Object.entries(unpaidGrouped).map(([dateLabel, items]) => (
          <div key={dateLabel} className="mb-4">
            <p className="font-semibold text-sm mb-1 text-gray-600">{dateLabel}</p>
            {items.map((d) => (
              <div key={d.id} className="flex justify-between text-sm border-b py-1.5">
                <span>{d.items.map((i) => `${i.product.name} ×${i.quantity}`).join(', ')}</span>
                <span className="font-bold ml-4 shrink-0">{(d.totalPrice ?? 0).toFixed(0)} L</span>
              </div>
            ))}
          </div>
        ))}

        <div className="mt-6 flex justify-between font-bold text-base border-t pt-3">
          <span>Totali </span>
          <span>{unpaidAmount.toFixed(0)} L</span>
        </div>
      </div>

      {/* Main UI — hidden during print */}
      <div className="space-y-6 print:hidden">
        {/* After-print confirm banner */}
        {showAfterPrintConfirm && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 px-4 py-3 gap-3">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Shëno të gjitha {unpaidDeliveries.length} dërgesa si të paguara?
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAfterPrintConfirm(false)}
              >
                Jo
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleMarkAllPaid}
                disabled={isMarkingPaid}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                {isMarkingPaid ? 'Duke shënuar...' : 'Po, shëno'}
              </Button>
            </div>
          </div>
        )}

        {/* Back + Header */}
        <div>
          <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate('/clients')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Klientët
          </Button>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                {client.address && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{client.address}</span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>
                )}
                {client.notes && (
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{client.notes}</span>
                )}
              </div>
            </div>
            {unpaidDeliveries.length > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrint} className="shrink-0 mt-1">
                <Printer className="h-4 w-4 mr-1.5" />
                Printo ({unpaidDeliveries.length})
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Card>
            <CardContent className="pt-3 pb-3 px-3 sm:px-6">
              <p className="text-xs text-muted-foreground">Totali</p>
              <p className="text-lg sm:text-xl font-bold mt-0.5">{totalAmount.toFixed(0)} L</p>
              <p className="text-xs text-muted-foreground mt-0.5">{deliveries.length} dërgesa</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 px-3 sm:px-6">
              <p className="text-xs text-muted-foreground">Paguar</p>
              <p className="text-lg sm:text-xl font-bold mt-0.5 text-green-600">{paidAmount.toFixed(0)} L</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 px-3 sm:px-6">
              <p className="text-xs text-muted-foreground">Pa paguar</p>
              <p className="text-lg sm:text-xl font-bold mt-0.5 text-destructive">{unpaidAmount.toFixed(0)} L</p>
            </CardContent>
          </Card>
        </div>

        {/* Delivery history */}
        {deliveries.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Ky klient nuk ka dërgesa ende.
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
                            <span className="text-sm">{d.items.map((i) => `${i.product.name} ×${i.quantity}`).join(', ')}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{d.createdBy?.name}</p>
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
    </>
  );
}
