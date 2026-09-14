import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bell,
  BusFront,
  CalendarRange,
  Camera,
  ChevronRight,
  CircleAlert,
  Building2,
  CircleCheck,
  Clock3,
  Database,
  Edit3,
  Eye,
  Handshake,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPinned,
  Menu,
  PanelsTopLeft,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Star,
  ToggleLeft,
  ToggleRight,
  UserRoundCog,
  Users,
  X,
} from 'lucide-react';

type AdminUser = {
  id: number;
  displayName: string;
  email: string;
  role: string;
};

type ModuleMetric = {
  key: string;
  label: string;
  available: boolean;
  count: number | null;
  table: string | null;
};

type AuditEvent = {
  id: number;
  eventType: string;
  email: string | null;
  createdAt: string;
};

type DashboardTour = {
  id: number;
  name: string;
  destination: string;
  duration: string | null;
  adultPrice: number;
  currency: string;
  mainImageUrl: string | null;
  status: string;
  featured: boolean;
  sortOrder: number | null;
};

const tourStatusLabel: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  inactive: 'Inactivo',
};

type DashboardPayload = {
  generatedAt: string;
  database: 'ok';
  metrics: {
    activeAdmins: number;
    activeSessions: number;
    audit24h: number;
  };
  modules: ModuleMetric[];
  revenue: {
    available: boolean;
    amount: number | null;
    currency: string;
    reason?: string;
  };
  activity: AuditEvent[];
};

const navigation = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Reservas', href: '/admin/reservas', icon: CalendarRange },
  { label: 'Tours', href: '/admin/tours', icon: MapPinned },
  { label: 'Clientes', href: '/admin/clientes', icon: Users },
  { label: 'Proveedores', href: '/admin/proveedores', icon: Handshake },
  { label: 'Flota', href: '/admin/flota', icon: BusFront },
  { label: 'Reseñas', href: '/admin/resenas', icon: Star },
  { label: 'Landing', href: '/admin/cms', icon: PanelsTopLeft },
  { label: 'Empresa', href: '/admin/empresa', icon: Building2 },
  { label: 'Usuarios', href: '/admin/usuarios', icon: UserRoundCog },
  { label: 'Configuración', href: '/admin/configuracion', icon: Settings },
  { label: 'Auditoría', href: '/admin/auditoria', icon: ScrollText },
];

const eventLabels: Record<string, string> = {
  login_success: 'Inicio de sesión correcto',
  login_failed: 'Intento de acceso fallido',
  login_locked: 'Cuenta temporalmente bloqueada',
  login_rate_limited: 'Límite de intentos aplicado',
  logout: 'Sesión cerrada',
  bootstrap_owner_created: 'Administrador inicial creado',
  bootstrap_denied: 'Intento de bootstrap rechazado',
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CA';
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat('es-CR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function moduleByKey(modules: ModuleMetric[], key: string) {
  return modules.find((item) => item.key === key) || null;
}

export function AdminDashboard() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tourCards, setTourCards] = useState<DashboardTour[] | null>(null);
  const [tourCardsError, setTourCardsError] = useState('');
  const [busyTour, setBusyTour] = useState<number | null>(null);

  const pathname = window.location.pathname.replace(/\/$/, '') || '/admin';

  async function loadDashboard() {
    setLoading(true);
    setError('');
    setTourCards(null);
    setTourCardsError('');
    try {
      const [sessionResponse, dashboardResponse, toursResponse] = await Promise.all([
        fetch('/api/auth/session', { credentials: 'same-origin' }),
        fetch('/api/admin/dashboard', { credentials: 'same-origin' }),
        fetch('/api/admin/tours?page=1&limit=100', { credentials: 'same-origin' }),
      ]);

      if (sessionResponse.status === 401 || dashboardResponse.status === 401 || toursResponse.status === 401) {
        window.location.assign('/admin/login');
        return;
      }

      if (!sessionResponse.ok) throw new Error('No fue posible validar la sesión.');
      if (!dashboardResponse.ok) throw new Error('No fue posible cargar el estado operativo.');

      if (toursResponse.ok) {
        const toursData = await toursResponse.json();
        setTourCards(toursData.tours ?? []);
      } else {
        setTourCardsError('No fue posible cargar los tours del panel.');
      }

      const sessionData = await sessionResponse.json();
      const dashboardData = await dashboardResponse.json();
      setUser(sessionData.user);
      setDashboard(dashboardData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar el dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function patchTourState(id: number, changes: { featured?: boolean; status?: string }) {
    const response = await fetch(`/api/admin/tours/${id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
      credentials: 'same-origin',
    });
    if (response.status === 401) {
      window.location.assign('/admin/login');
      return null;
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'No fue posible actualizar el tour.');
    return data?.tour as DashboardTour | null;
  }

  async function toggleTour(tour: DashboardTour) {
    setBusyTour(tour.id);
    setTourCardsError('');
    try {
      const updated = await patchTourState(tour.id, { status: tour.status === 'published' ? 'inactive' : 'published' });
      if (updated) setTourCards((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
    } catch (reason) {
      setTourCardsError(reason instanceof Error ? reason.message : 'No fue posible actualizar el tour.');
    } finally {
      setBusyTour(null);
    }
  }

  async function toggleFeatured(tour: DashboardTour) {
    setBusyTour(tour.id);
    setTourCardsError('');
    try {
      const updated = await patchTourState(tour.id, { featured: !tour.featured });
      if (updated) setTourCards((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
    } catch (reason) {
      setTourCardsError(reason instanceof Error ? reason.message : 'No fue posible actualizar el tour.');
    } finally {
      setBusyTour(null);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    window.location.assign('/admin/login');
  }

  const pageLabel = useMemo(() => {
    const current = navigation.find((item) => item.href === pathname);
    return current?.label || 'Dashboard';
  }, [pathname]);

  const reservations = moduleByKey(dashboard?.modules || [], 'reservations');
  const tours = moduleByKey(dashboard?.modules || [], 'tours');
  const customers = moduleByKey(dashboard?.modules || [], 'customers');
  const reviews = moduleByKey(dashboard?.modules || [], 'reviews');

  const isDashboard = pathname === '/admin';

  return <div className="admin-app">
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
        {navigation.map((item) => {
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
        <button onClick={logout} className="admin-logout"><LogOut size={17}/> Cerrar sesión</button>
      </div>
    </aside>

    {sidebarOpen && <button className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"/>}

    <section className="admin-main">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button className="admin-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"><Menu size={20}/></button>
          <div>
            <span className="admin-breadcrumb">Capoy / Administración</span>
            <strong>{pageLabel}</strong>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <label className="admin-search"><Search size={17}/><input type="search" placeholder="Buscar en el panel" aria-label="Buscar en el panel" /></label>
          <button className="admin-icon-button" aria-label="Notificaciones"><Bell size={18}/><span/></button>
          {user && <div className="admin-top-user"><span className="admin-avatar">{initials(user.displayName)}</span><span><strong>{user.displayName}</strong><small>{user.email}</small></span></div>}
        </div>
      </header>

      <main className="admin-content">
        {loading && <div className="admin-state-card"><RefreshCw className="admin-spin" size={22}/><div><strong>Cargando información real</strong><span>Consultando sesión, base de datos y módulos disponibles.</span></div></div>}

        {!loading && error && <div className="admin-state-card is-error"><CircleAlert size={22}/><div><strong>No pudimos cargar el dashboard</strong><span>{error}</span></div><button onClick={loadDashboard}>Reintentar</button></div>}

        {!loading && !error && dashboard && user && isDashboard && <>
          <section className="admin-hero-row">
            <div>
              <span className="admin-overline">CENTRO DE OPERACIONES</span>
              <h1>Buenos días, {user.displayName.split(' ')[0]}.</h1>
              <p>Este panel muestra únicamente información disponible en producción. Los módulos aún no creados aparecen como pendientes, nunca con datos ficticios.</p>
            </div>
            <div className="admin-hero-actions">
              <button className="admin-secondary-action" onClick={loadDashboard}><RefreshCw size={17}/> Actualizar</button>
              <a className="admin-primary-action" href="/admin/reservas">Ver reservas <ArrowUpRight size={17}/></a>
            </div>
          </section>

          <section className="admin-kpi-grid">
            <article className="admin-kpi-card">
              <div className="admin-kpi-icon"><CalendarRange size={20}/></div>
              <span>Reservas / solicitudes</span>
              <strong>{reservations?.available ? reservations.count : '—'}</strong>
              <small>{reservations?.available ? 'Dato real de producción' : 'Módulo aún no disponible'}</small>
            </article>
            <article className="admin-kpi-card">
              <div className="admin-kpi-icon"><MapPinned size={20}/></div>
              <span>Tours registrados</span>
              <strong>{tours?.available ? tours.count : '—'}</strong>
              <small>{tours?.available ? 'Dato real de producción' : 'Módulo aún no disponible'}</small>
            </article>
            <article className="admin-kpi-card">
              <div className="admin-kpi-icon"><Users size={20}/></div>
              <span>Clientes</span>
              <strong>{customers?.available ? customers.count : '—'}</strong>
              <small>{customers?.available ? 'Dato real de producción' : 'Módulo aún no disponible'}</small>
            </article>
            <article className="admin-kpi-card">
              <div className="admin-kpi-icon"><Star size={20}/></div>
              <span>Reseñas</span>
              <strong>{reviews?.available ? reviews.count : '—'}</strong>
              <small>{reviews?.available ? 'Dato real de producción' : 'Módulo aún no disponible'}</small>
            </article>
          </section>

          <section className="admin-dashboard-grid">
            <article className="admin-panel admin-operations-panel">
              <div className="admin-panel-heading"><div><span>ESTADO OPERATIVO</span><h2>Salud del sistema</h2></div><span className="admin-live"><i/> EN LÍNEA</span></div>
              <div className="admin-status-list">
                <div><span className="admin-status-icon ok"><Database size={18}/></span><span><strong>Base de datos</strong><small>MySQL conectado y respondiendo</small></span><CircleCheck size={19}/></div>
                <div><span className="admin-status-icon ok"><ShieldCheck size={18}/></span><span><strong>Autenticación</strong><small>Sesiones administrativas protegidas</small></span><CircleCheck size={19}/></div>
                <div><span className="admin-status-icon"><UserRoundCog size={18}/></span><span><strong>Administradores activos</strong><small>{dashboard.metrics.activeAdmins} cuenta(s) habilitada(s)</small></span><b>{dashboard.metrics.activeAdmins}</b></div>
                <div><span className="admin-status-icon"><Activity size={18}/></span><span><strong>Sesiones activas</strong><small>Sesiones válidas en este momento</small></span><b>{dashboard.metrics.activeSessions}</b></div>
              </div>
            </article>

            <article className="admin-panel admin-revenue-panel">
              <div className="admin-panel-heading"><div><span>INGRESOS</span><h2>Resumen financiero</h2></div></div>
              {dashboard.revenue.available ? <div className="admin-revenue-value"><span>Ingresos registrados</span><strong>{new Intl.NumberFormat('es-CR', { style:'currency', currency:dashboard.revenue.currency }).format(dashboard.revenue.amount || 0)}</strong><small>Calculado desde datos reales disponibles.</small></div> : <div className="admin-empty-compact"><CircleAlert size={22}/><strong>Sin módulo financiero</strong><span>No se muestran montos hasta que exista una fuente de ingresos real y verificable.</span></div>}
            </article>

            <article className="admin-panel admin-activity-panel">
              <div className="admin-panel-heading"><div><span>ACTIVIDAD RECIENTE</span><h2>Últimos eventos</h2></div><a href="/admin/auditoria">Ver auditoría <ChevronRight size={15}/></a></div>
              {dashboard.activity.length ? <div className="admin-activity-list">{dashboard.activity.map((event) => <div key={event.id}>
                <span className="admin-timeline-dot"/>
                <span><strong>{eventLabels[event.eventType] || event.eventType}</strong><small>{event.email || 'Sistema'} · {formatDateTime(event.createdAt)}</small></span>
              </div>)}</div> : <div className="admin-empty-compact"><Clock3 size={22}/><strong>Sin actividad reciente</strong><span>No hay eventos nuevos para mostrar.</span></div>}
            </article>

            <article className="admin-panel admin-modules-panel">
              <div className="admin-panel-heading"><div><span>MÓDULOS</span><h2>Disponibilidad real</h2></div></div>
              <div className="admin-module-list">{dashboard.modules.map((module) => <div key={module.key}>
                <span className={`admin-module-state ${module.available ? 'available' : ''}`}>{module.available ? <CircleCheck size={15}/> : <Clock3 size={15}/>}</span>
                <span><strong>{module.label}</strong><small>{module.available ? `${module.count ?? 0} registro(s) detectado(s)` : 'Pendiente de implementación'}</small></span>
              </div>)}</div>
            </article>
          </section>

          {tourCards !== null && <section className="admin-tours-section">
            <div className="admin-section-heading">
              <div><span>TOURS</span><h2>Experiencias activas</h2></div>
              <a className="admin-section-link" href="/admin/tours">Ver todos <ChevronRight size={15}/></a>
            </div>
            {tourCardsError && <div className="admin-tours-error"><CircleAlert size={15}/><span>{tourCardsError}</span></div>}
            {tourCards.length ? <div className="admin-tours-grid">
              {tourCards.slice(0, 6).map((tour) => (
                <article className="admin-tour-card" key={tour.id}>
                  <div className="admin-tour-thumb">
                    {tour.mainImageUrl ? <img src={tour.mainImageUrl} alt={tour.name} loading="lazy" /> : <span className="admin-tour-thumb-empty"><Camera size={20}/></span>}
                    <span className={`admin-tour-status ${tour.status}`}>{tourStatusLabel[tour.status] || tour.status}</span>
                    {tour.featured && <span className="admin-tour-badge">Destacado</span>}
                  </div>
                  <div className="admin-tour-body">
                    <strong>{tour.name}</strong>
                    <small>{tour.destination}{tour.duration ? ` · ${tour.duration}` : ''}</small>
                    <span className="admin-tour-price">{new Intl.NumberFormat('es-CR', { style: 'currency', currency: tour.currency }).format(tour.adultPrice)}</span>
                  </div>
                  <div className="admin-tour-actions">
                    <a className="admin-tour-action" href="/#tours" title="Ver en landing"><Eye size={16}/> Ver</a>
                    <a className="admin-tour-action" href="/admin/tours" title="Editar"><Edit3 size={16}/> Editar</a>
                    <button className="admin-tour-action" disabled={busyTour === tour.id} onClick={() => toggleTour(tour)}>{tour.status === 'published' ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>} {tour.status === 'published' ? 'Desactivar' : 'Activar'}{busyTour === tour.id && <Loader2 className="admin-spin" size={14}/>}</button>
                    <button className={`admin-tour-action ${tour.featured ? 'active' : ''}`} disabled={busyTour === tour.id} onClick={() => toggleFeatured(tour)}><Star size={16}/> Destacar</button>
                  </div>
                </article>
              ))}
            </div> : <div className="admin-empty-compact"><MapPinned size={22}/><strong>Sin tours disponibles</strong><span>Crea el primer tour desde el módulo Tours para verlo aquí.</span></div>}
          </section>}

          <section className="admin-quick-section">
            <div className="admin-section-heading"><div><span>ACCESOS RÁPIDOS</span><h2>Gestiona Capoy desde un solo lugar</h2></div></div>
            <div className="admin-quick-grid">
              {navigation.slice(1, 7).map((item) => {
                const Icon = item.icon;
                return <a key={item.href} href={item.href}><span><Icon size={19}/></span><div><strong>{item.label}</strong><small>Abrir módulo</small></div><ChevronRight size={17}/></a>;
              })}
            </div>
          </section>
        </>}

        {!loading && !error && dashboard && user && !isDashboard && <section className="admin-module-placeholder">
          <span className="admin-placeholder-icon"><Clock3 size={24}/></span>
          <span className="admin-overline">MÓDULO ADMINISTRATIVO</span>
          <h1>{pageLabel}</h1>
          <p>La navegación ya está integrada y protegida por la sesión real. Este módulo todavía no tiene implementación funcional; se desarrollará en su fase correspondiente sin datos simulados.</p>
          <div className="admin-placeholder-actions"><a href="/admin">Volver al dashboard</a><span><ShieldCheck size={16}/> Acceso protegido</span></div>
        </section>}
      </main>
    </section>
  </div>;
}
