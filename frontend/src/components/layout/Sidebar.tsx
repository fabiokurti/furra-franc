import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, LogOut, ChefHat, Users, Truck, UserCog, PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

const allNavItems = [
  { to: '/dashboard', label: 'Paneli',       icon: LayoutDashboard, adminOnly: false },
  { to: '/deliveries', label: 'Dërgimet',    icon: Truck,           adminOnly: false },
  { to: '/clients',   label: 'Klientët',     icon: Users,           adminOnly: false },
  { to: '/daily-stock', label: 'Stoku Ditor', icon: PackageCheck,    adminOnly: true  },
  { to: '/staff',     label: 'Stafi',        icon: UserCog,         adminOnly: true  },
  { to: '/products',  label: 'Produktet',    icon: Package,         adminOnly: true  },
  { to: '/orders',    label: 'Porositë',     icon: ShoppingBag,     adminOnly: true  },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navItems = allNavItems.filter((item) => !item.adminOnly || user?.role === 'ADMIN');

  const initials = user?.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <ChefHat className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">Furra Franc</p>
          <p className="text-xs text-muted-foreground">Menaxhimi i Furrës</p>
        </div>
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Separator />

      {/* User */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={logout}>
          <LogOut className="h-3.5 w-3.5" />
          Dil
        </Button>
      </div>
    </div>
  );
}
