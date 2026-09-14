import { ReactNode, useState } from 'react';
import {
  Building2,
  BusFront,
  CalendarRange,
  Handshake,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  PanelsTopLeft,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  UserRoundCog,
  Users,
  X,
} from 'lucide-react';

type ShellUser = {
  displayName: string;
  email?: string;
  role: string;
};

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Reservas', href: '/admin/reservas', icon: CalendarRange },
  { label: 'Tours', href: '/admin/tours', icon: MapPinned },
  { label: 'Clientes', href: '/admin/clientes', icon: Users },
  { label: 'Proveedores', href: '/admin/proveedores', icon: Handshake },
  { label: 'Flota', href: '/admin/flota', icon: BusFront },
  { label: 'Reseñas', href: '/admin/resenas', icon: Star },
  { label: 'Landing', href: '/admin/cms', icon: PanelsTopLeft },
  { label: 'Empresa', href: '/admin/empresa', icon: Building2 },
  { label: 'Seguridad', href: '/admin/seguridad', icon: ShieldCheck },
  { label: 'Usuarios', href: '/admin/usuarios', icon: UserRoundCog },
  { label: 'Configuración', href: '/admin/configuracion', icon: Settings },
  { label: 'Auditoría', href: '/admin/auditoria', icon: ScrollText },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CA';
}

export function AdminShell({
  user,
  title,
  onLogout,
  children,
  className,
  topbarRight,
}: {
  user: ShellUser | null;
  title: string;
  onLogout: () => void;
  children: ReactNode;
  className?: string;
  topbarRight?: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = window.location.pathname.replace(/\/$/, '') || '/admin';

  return (
    <div className={`admin-app ${className ?? ''}`}>
      <aside className={`admin-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="admin-brand-row">
          <a className="admin-brand" href="/admin">
            <span className="admin-brand-mark">C</span>
            <span><strong>Capoy</strong><small>Costa Rica</small></span>
          </a>
          <button className="admin-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"><X size={20}/></button>
        </div>

        <div className="admin-sidebar-caption">OPERACIONES</div>
        <nav className="admin-nav" aria-label="Navegación administrativa">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.href === pathname || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));
            return <a key={item.href} href={item.href} className={active ? 'active' : ''} onClick={() => setSidebarOpen(false)}>
              <Icon size={18}/><span>{item.label}</span>{active && <span className="admin-active-dot"/>}
            </a>;
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-security-pill"><ShieldCheck size={16}/><span>Sesión protegida</span></div>
          {user && <div className="admin-user-mini">
            <span className="admin-avatar">{initials(user.displayName)}</span>
            <span><strong>{user.displayName}</strong><small>{user.role}</small></span>
          </div>}
          <button onClick={onLogout} className="admin-logout"><LogOut size={17}/> Cerrar sesión</button>
        </div>
      </aside>

      {sidebarOpen && <button className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"/>}

      <section className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"><Menu size={20}/></button>
            <div>
              <span className="admin-breadcrumb">Capoy / Administración</span>
              <strong>{title}</strong>
            </div>
          </div>
          {topbarRight}
        </header>

        {children}
      </section>
    </div>
  );
}