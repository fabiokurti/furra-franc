import { useEffect, useState } from 'react';
import { Users, MapPin, Phone, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import api from '@/lib/api';
import type { User, Client } from '@/types';

interface StaffWithClients extends User {
  clients: Client[];
}

export function StaffPage() {
  const [staffList, setStaffList] = useState<StaffWithClients[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [staffRes, clientsRes] = await Promise.all([
          api.get('/auth/staff-users'),
          api.get('/clients'),
        ]);

        const allClients: Client[] = clientsRes.data.clients;
        const staff: User[] = staffRes.data.users;

        const combined: StaffWithClients[] = staff
          .map((s) => ({
            ...s,
            clients: allClients.filter((c) => c.staffId === s.id),
          }))
          .filter((s) => s.clients.length > 0);

        setStaffList(combined);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const totalClients = staffList.reduce((sum, s) => sum + s.clients.length, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Stafi & Klientët</h1>
          <p className="text-muted-foreground">Menaxhim i shpërndarësve</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Stafi & Klientët</h1>
          <p className="text-muted-foreground">Menaxhim i shpërndarësve dhe klientëve të tyre</p>
        </div>
        <div className="flex gap-3">
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
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {staffList.map((staff) => {
          const initials = staff.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
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
                  <Badge variant="secondary" className="shrink-0">
                    {staff.clients.length} klientë
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex-1 flex flex-col">
                {staff.clients.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-3">
                    Nuk ka klientë të caktuar
                  </p>
                ) : (
                  <>
                    {/* Always show first 3 */}
                    <div className="space-y-1.5">
                      {(isExpanded ? staff.clients : staff.clients.slice(0, 3)).map((client) => (
                        <div
                          key={client.id}
                          className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2"
                        >
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

                    {/* Show more / less toggle */}
                    {staff.clients.length > 3 && (
                      <button
                        className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                        onClick={() => setExpandedStaff(isExpanded ? null : staff.id)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            Shfaq më pak
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            Shfaq të gjithë ({staff.clients.length - 3} të tjerë)
                          </>
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
    </div>
  );
}
