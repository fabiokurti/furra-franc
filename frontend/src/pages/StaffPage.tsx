import { useEffect, useState } from 'react';
import { Users, MapPin, Phone, ChevronDown, ChevronUp, Package, UserPlus, Pencil, ArrowRightLeft, Plus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import type { User, Client } from '@/types';

interface StaffWithClients extends User {
  clients: Client[];
}

export function StaffPage() {
  const [staffList, setStaffList] = useState<StaffWithClients[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Create staff dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit staff dialog
  const [editingStaff, setEditingStaff] = useState<StaffWithClients | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [moveMap, setMoveMap] = useState<Record<string, string>>({});
  const [importClientId, setImportClientId] = useState('');

  async function load() {
    setIsLoading(true);
    try {
      const [staffRes, clientsRes] = await Promise.all([
        api.get('/auth/staff-users'),
        api.get('/clients'),
      ]);
      const clients: Client[] = clientsRes.data.clients;
      const staff: User[] = staffRes.data.users;
      const combined: StaffWithClients[] = staff.map((s) => ({
        ...s,
        clients: clients.filter((c) => c.staffId === s.id),
      }));
      setStaffList(combined);
      setAllClients(clients);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totalClients = staffList.reduce((sum, s) => sum + s.clients.length, 0);

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setIsCreating(true);
    try {
      await api.post('/auth/create-staff', createForm);
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '' });
      await load();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Ndodhi një gabim');
    } finally {
      setIsCreating(false);
    }
  }

  function openEdit(staff: StaffWithClients) {
    setEditingStaff(staff);
    setEditName(staff.name);
    setEditEmail(staff.email);
    setEditError('');
    setMoveMap({});
    setNewClientName('');
    setNewClientAddress('');
    setNewClientPhone('');
    setImportClientId('');
  }

  async function handleSaveEdit() {
    if (!editingStaff) return;
    setEditError('');
    setIsSaving(true);
    try {
      if (editName !== editingStaff.name || editEmail !== editingStaff.email) {
        await api.patch(`/auth/staff/${editingStaff.id}`, { name: editName, email: editEmail });
      }
      for (const [clientId, toStaffId] of Object.entries(moveMap)) {
        if (toStaffId) await api.patch(`/clients/${clientId}`, { staffId: toStaffId });
      }
      if (importClientId) {
        await api.patch(`/clients/${importClientId}`, { staffId: editingStaff.id });
      }
      if (newClientName.trim()) {
        await api.post('/clients', {
          name: newClientName.trim(),
          address: newClientAddress.trim() || undefined,
          phone: newClientPhone.trim() || undefined,
          staffId: editingStaff.id,
        });
      }
      setEditingStaff(null);
      await load();
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Ndodhi një gabim');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Stafi & Klientët</h1></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const importableClients = editingStaff
    ? allClients.filter((c) => c.staffId !== editingStaff.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Stafi & Klientët</h1>
          <p className="text-muted-foreground">Menaxhim i shpërndarësve dhe klientëve të tyre</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm bg-card">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-semibold">{staffList.length}</span>
            <span className="text-muted-foreground">shpërndarës</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm bg-card">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-semibold">{totalClients}</span>
            <span className="text-muted-foreground">klientë gjithsej</span>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Shto Staf
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Kërko staf..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {staffList.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())).map((staff) => {
          const initials = staff.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
          const isExpanded = expandedStaff === staff.id;

          return (
            <Card key={staff.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight">{staff.name}</CardTitle>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{staff.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="secondary">{staff.clients.length} klientë</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(staff)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex-1 flex flex-col">
                {staff.clients.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-3">
                    Nuk ka klientë të caktuar
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      {(isExpanded ? staff.clients : staff.clients.slice(0, 3)).map((client) => (
                        <div key={client.id} className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{client.name}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                              {client.address && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[140px]">{client.address}</span>
                                </span>
                              )}
                              {client.phone && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  {client.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {staff.clients.length > 3 && (
                      <button
                        className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                        onClick={() => setExpandedStaff(isExpanded ? null : staff.id)}
                      >
                        {isExpanded ? (
                          <><ChevronUp className="h-3.5 w-3.5" />Shfaq më pak</>
                        ) : (
                          <><ChevronDown className="h-3.5 w-3.5" />Shfaq të gjithë ({staff.clients.length - 3} të tjerë)</>
                        )}
                      </button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Staff Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Shto Staf të Ri</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateStaff} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Emri i plotë</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Fjalëkalimi</Label>
              <Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required minLength={6} />
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Anulo</Button>
              <Button type="submit" disabled={isCreating}>{isCreating ? 'Duke krijuar...' : 'Krijo llogari'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => { if (!open) setEditingStaff(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle>Ndrysho Stafin — {editingStaff?.name}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {editError && <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{editError}</p>}

            {/* Info */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informacioni</p>
              <div className="space-y-1">
                <Label>Emri</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
            </div>

            {/* Current clients with move option */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Klientët Aktualë ({editingStaff?.clients.length ?? 0})
              </p>
              {editingStaff?.clients.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nuk ka klientë</p>
              )}
              {editingStaff?.clients.map((client) => (
                <div key={client.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <span className="flex-1 text-sm font-medium truncate">{client.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select
                      value={moveMap[client.id] ?? ''}
                      onValueChange={(v) => setMoveMap((m) => ({ ...m, [client.id]: v }))}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue placeholder="Lëviz te..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.filter((s) => s.id !== editingStaff.id).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {/* Import from another staff */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Shto Klient nga Staff Tjetër
              </p>
              <Select value={importClientId} onValueChange={setImportClientId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Zgjidhni klientin për të shtuar..." />
                </SelectTrigger>
                <SelectContent>
                  {importableClients.map((c) => {
                    const owner = staffList.find((s) => s.id === c.staffId);
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{owner ? ` (${owner.name})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Add new client */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Shto Klient të Ri
              </p>
              <div className="space-y-2 rounded-md border p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Emri i biznesit</Label>
                  <Input placeholder="p.sh. BALLIU" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Adresa (opsionale)</Label>
                    <Input placeholder="Adresa..." value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefoni (opsional)</Label>
                    <Input placeholder="Numri..." value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t px-5 py-3 shrink-0 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingStaff(null)}>Anulo</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              <Plus className="h-4 w-4 mr-1" />
              {isSaving ? 'Duke ruajtur...' : 'Ruaj ndryshimet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
