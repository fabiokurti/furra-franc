import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDateAL } from '@/lib/date';
import {
  ArrowLeft, MapPin, Phone, FileText, Banknote, CheckCircle2, Clock, XCircle,
  Printer, CheckCheck, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { printClientStatement } from '@/lib/printPreventiv';
import { printClientStatementBT } from '@/lib/btPrint';
import type { Client, Delivery } from '@/types';

type FilterMode = 'unpaid' | 'week' | 'month' | 'all';

const FILTER_LABELS: Record<FilterMode, string> = {
  unpaid: 'Pa Paguar',
  week:   'Java e Fundit',
  month:  'Muaji i Fundit',
  all:    'Të Gjitha',
};

function statusLabel(status: string) {
  if (status === 'COMPLETED') return { label: 'Dërguar',  icon: CheckCircle2, color: 'text-green-600'    };
  if (status === 'CANCELLED') return { label: 'Anuluar',  icon: XCircle,      color: 'text-destructive'  };
  return                             { label: 'Në pritje', icon: Clock,        color: 'text-orange-500'  };
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('unpaid');
  const [printingType, setPrintingType] = useState<'80mm' | 'a4' | null>(null);
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

  const completedDeliveries = deliveries.filter((d) => d.status === 'COMPLETED');

  const now = new Date();
  const weekAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const filteredMap: Record<FilterMode, Delivery[]> = {
    unpaid: completedDeliveries.filter((d) => !d.isPaid),
    week:   completedDeliveries.filter((d) => new Date(d.deliveryDate ?? d.createdAt) >= weekAgo),
    month:  completedDeliveries.filter((d) => new Date(d.deliveryDate ?? d.createdAt) >= monthAgo),
    all:    completedDeliveries,
  };

  const filteredDeliveries = filteredMap[filterMode];

  const handlePrint = async (type: '80mm' | 'a4') => {
    if (!client || filteredDeliveries.length === 0) return;
    setPrintingType(type);
    try {
      const label = FILTER_LABELS[filterMode];
      if (type === '80mm') await printClientStatementBT(client, filteredDeliveries, label);
      else printClientStatement(client, filteredDeliveries, label);
      if (filterMode === 'unpaid') setShowAfterPrintConfirm(true);
    } finally {
      setPrintingType(null);
    }
  };

  const handleMarkAllPaid = async () => {
    const unpaid = filteredMap.unpaid;
    setIsMarkingPaid(true);
    try {
      await Promise.all(unpaid.map((d) => api.patch(`/deliveries/${d.id}/paid`)));
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

  const totalAmount  = deliveries.reduce((s, d) => s + (d.totalPrice ?? 0), 0);
  const paidAmount   = completedDeliveries.filter((d) => d.isPaid).reduce((s, d) => s + (d.totalPrice ?? 0), 0);
  const unpaidAmount = completedDeliveries.filter((d) => !d.isPaid).reduce((s, d) => s + (d.totalPrice ?? 0), 0);

  // Group filtered deliveries by date (newest first) for display
  const grouped: Record<string, Delivery[]> = {};
  for (const d of [...filteredDeliveries].sort(
    (a, b) => new Date(b.deliveryDate ?? b.createdAt).getTime() - new Date(a.deliveryDate ?? a.createdAt).getTime(),
  )) {
    const key = formatDateAL(d.deliveryDate ?? d.createdAt, true);
    (grouped[key] ??= []).push(d);
  }

  const filteredTotal = filteredDeliveries.reduce((s, d) => s + (d.totalPrice ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* After-print confirm banner */}
      {showAfterPrintConfirm && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 px-4 py-3 gap-3">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Shëno të gjitha {filteredMap.unpaid.length} dërgesa si të paguara?
          </p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setShowAfterPrintConfirm(false)}>Jo</Button>
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
        <div className="flex items-start justify-between gap-3 flex-wrap">
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

      {/* Filter + Print bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">Shfaq:</span>
        {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => { setFilterMode(mode); setShowAfterPrintConfirm(false); }}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              filterMode === mode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {FILTER_LABELS[mode]}
            {filteredMap[mode].length > 0 && (
              <span className={`ml-1.5 text-xs ${filterMode === mode ? 'opacity-80' : 'text-muted-foreground'}`}>
                ({filteredMap[mode].length})
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {filteredTotal > 0 && (
            <span className="text-sm text-muted-foreground">{filteredDeliveries.length} · {filteredTotal.toFixed(0)} L</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            title="Printo në printer termal 80mm (Bluetooth)"
            disabled={filteredDeliveries.length === 0 || printingType === '80mm'}
            onClick={() => handlePrint('80mm')}
          >
            {printingType === '80mm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            80mm
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            title="Printo në printer A4"
            disabled={filteredDeliveries.length === 0 || printingType === 'a4'}
            onClick={() => handlePrint('a4')}
          >
            {printingType === 'a4' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            A4
          </Button>
        </div>
      </div>

      {/* Delivery list */}
      {filteredDeliveries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nuk ka dërgesa për filtrin e zgjedhur.
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
  );
}
