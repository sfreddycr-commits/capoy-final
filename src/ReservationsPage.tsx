import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Filter,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';

type AdminUser = { id:number; displayName:string; email:string; role:string };
type Reservation = {
  id:number; referenceCode:string; customerName:string; customerEmail:string|null; customerPhone:string|null;
  tourId:number|null; tourName:string; tourLinked:boolean; currentTourStatus:string|null; travelDate:string; adults:number; children:number; status:string; currency:string;
  totalAmount:number|null; notes:string|null; source:string; createdAt:string; updatedAt:string;
};
type TourOption = { id:number; name:string; destination:string; adultPrice:number; childPrice:number|null; currency:string; status:string };
type Payload = {
  summary:{total:number;new:number;confirmed:number;completed:number;cancelled:number;upcoming:number};
  pagination:{page:number;limit:number;total:number;pages:number};
  reservations:Reservation[];
};

const statuses = [
  ['new','Nueva'],['contacted','Contactada'],['quoted','Cotizada'],['confirmed','Confirmada'],['completed','Completada'],['cancelled','Cancelada'],
] as const;

function initials(name:string) {
  return name.split(/\s+/).filter(Boolean).slice(0,2).map((part)=>part[0]?.toUpperCase()).join('') || 'CA';
}
function dateOnly(value:string) {
  try { return new Intl.DateTimeFormat('es-CR',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value)); } catch { return value; }
}
function money(value:number|null,currency:string) {
  if (value === null) return 'Sin monto';
  return new Intl.NumberFormat('es-CR',{style:'currency',currency}).format(value);
}

export function ReservationsPage() {
  const [user,setUser] = useState<AdminUser|null>(null);
  const [data,setData] = useState<Payload|null>(null);
  const [tourOptions,setTourOptions] = useState<TourOption[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [query,setQuery] = useState('');
  const [status,setStatus] = useState('all');
  const [page,setPage] = useState(1);
  const [drawer,setDrawer] = useState(false);
  const [creating,setCreating] = useState(false);
  const [createError,setCreateError] = useState('');
  const [mobileMenu,setMobileMenu] = useState(false);

  async function load(nextPage=page,nextStatus=status,nextQuery=query) {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({page:String(nextPage),limit:'25'});
      if (nextStatus !== 'all') params.set('status',nextStatus);
      if (nextQuery.trim()) params.set('q',nextQuery.trim());
      const [sessionResponse,reservationsResponse,toursResponse] = await Promise.all([
        fetch('/api/auth/session',{credentials:'same-origin'}),
        fetch(`/api/admin/reservations?${params.toString()}`,{credentials:'same-origin'}),
        fetch('/api/admin/tours/options',{credentials:'same-origin'}),
      ]);
      if (sessionResponse.status===401 || reservationsResponse.status===401 || toursResponse.status===401) { window.location.assign('/admin/login'); return; }
      if (!sessionResponse.ok) throw new Error('No fue posible validar tu sesión.');
      if (!reservationsResponse.ok) {
        const body = await reservationsResponse.json().catch(()=>({}));
        throw new Error(body.error || 'No fue posible cargar las reservas.');
      }
      if (!toursResponse.ok) {
        const body = await toursResponse.json().catch(()=>({}));
        throw new Error(body.error || 'No fue posible cargar los tours publicados.');
      }
      const sessionData = await sessionResponse.json();
      const reservationsData = await reservationsResponse.json();
      const toursData = await toursResponse.json();
      setUser(sessionData.user); setData(reservationsData); setTourOptions(toursData.tours || []); setPage(nextPage);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible cargar las reservas.'); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ load(1,'all',''); },[]);

  async function logout() {
    await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'}).catch(()=>null);
    window.location.assign('/admin/login');
  }

  async function createReservation(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCreating(true); setCreateError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      customerName:String(form.get('customerName')||''), customerEmail:String(form.get('customerEmail')||''), customerPhone:String(form.get('customerPhone')||''),
      tourId:Number(form.get('tourId')||0), travelDate:String(form.get('travelDate')||''), adults:Number(form.get('adults')||1), children:Number(form.get('children')||0),
      totalAmount:String(form.get('totalAmount')||''), notes:String(form.get('notes')||''), status:'new',
    };
    try {
      const response = await fetch('/api/admin/reservations',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});
      const body = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(body.error || 'No fue posible crear la reserva.');
      formElement.reset(); setDrawer(false); await load(1,status,query);
    } catch (reason) { setCreateError(reason instanceof Error ? reason.message : 'No fue posible crear la reserva.'); }
    finally { setCreating(false); }
  }

  async function updateStatus(id:number,nextStatus:string) {
    const response = await fetch(`/api/admin/reservations/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({status:nextStatus})});
    if (response.ok) await load(page,status,query);
    else setError((await response.json().catch(()=>({}))).error || 'No fue posible actualizar la reserva.');
  }

  const totalPassengers = useMemo(()=>data?.reservations.reduce((sum,item)=>sum+item.adults+item.children,0) || 0,[data]);

  return <div className="reservations-app">
    <aside className={`reservations-sidebar ${mobileMenu?'open':''}`}>
      <div className="reservations-brand"><span>C</span><div><strong>Capoy</strong><small>Costa Rica</small></div><button onClick={()=>setMobileMenu(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
      <nav>
        <a href="/admin"><LayoutDashboard size={18}/> Dashboard</a>
        <a className="active" href="/admin/reservas"><CalendarRange size={18}/> Reservas</a>
        <a href="/admin/tours"><ClipboardList size={18}/> Tours</a>
        <a href="/admin/clientes"><Users size={18}/> Clientes</a>
      </nav>
      <div className="reservations-sidebar-bottom">
        <div className="reservations-secure"><ShieldCheck size={16}/> Sesión protegida</div>
        {user && <div className="reservations-user"><span>{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{user.role}</small></div></div>}
        <button onClick={logout}><LogOut size={17}/> Cerrar sesión</button>
      </div>
    </aside>
    {mobileMenu && <button className="reservations-backdrop" onClick={()=>setMobileMenu(false)} aria-label="Cerrar menú"/>}

    <main className="reservations-main">
      <header className="reservations-topbar">
        <div><button className="reservations-menu" onClick={()=>setMobileMenu(true)}><Menu size={20}/></button><a href="/admin"><ArrowLeft size={17}/> Administración</a><span>/</span><strong>Reservas</strong></div>
        {user && <div className="reservations-top-user"><span>{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div></div>}
      </header>

      <section className="reservations-content">
        <div className="reservations-heading">
          <div><span>OPERACIÓN COMERCIAL</span><h1>Reservas</h1><p>Gestiona solicitudes y reservas reales desde un solo lugar.</p></div>
          <button onClick={()=>{setCreateError('');setDrawer(true);}}><Plus size={18}/> Nueva reserva</button>
        </div>

        {data && <div className="reservations-kpis">
          <article><CalendarRange size={20}/><span>Total</span><strong>{data.summary.total}</strong><small>Registros reales</small></article>
          <article><ClipboardList size={20}/><span>Nuevas</span><strong>{data.summary.new}</strong><small>Por gestionar</small></article>
          <article><CheckCircle2 size={20}/><span>Confirmadas</span><strong>{data.summary.confirmed}</strong><small>Reservas aseguradas</small></article>
          <article><CalendarDays size={20}/><span>Próximas</span><strong>{data.summary.upcoming}</strong><small>Viajes pendientes</small></article>
        </div>}

        <div className="reservations-toolbar">
          <form onSubmit={(event)=>{event.preventDefault();load(1,status,query);}} className="reservations-search"><Search size={17}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar código, cliente, correo, teléfono o tour"/><button>Buscar</button></form>
          <label><Filter size={16}/><select value={status} onChange={(e)=>{setStatus(e.target.value);load(1,e.target.value,query);}}><option value="all">Todos los estados</option>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        </div>

        {loading && <div className="reservations-state"><Loader2 className="spin"/><strong>Cargando reservas reales…</strong></div>}
        {!loading && error && <div className="reservations-state error"><strong>{error}</strong><button onClick={()=>load(page,status,query)}>Reintentar</button></div>}
        {!loading && !error && data && data.reservations.length===0 && <div className="reservations-empty"><CalendarRange size={34}/><h2>No hay reservas todavía</h2><p>El módulo está funcionando y conectado a MySQL. Crea la primera reserva real cuando corresponda.</p><button onClick={()=>setDrawer(true)}><Plus size={17}/> Crear primera reserva</button></div>}

        {!loading && !error && data && data.reservations.length>0 && <>
          <div className="reservations-table-wrap"><table><thead><tr><th>Reserva</th><th>Cliente</th><th>Tour / fecha</th><th>Pasajeros</th><th>Monto</th><th>Estado</th></tr></thead><tbody>{data.reservations.map((item)=><tr key={item.id}>
            <td><strong>{item.referenceCode}</strong><small>{dateOnly(item.createdAt)}</small></td>
            <td><strong>{item.customerName}</strong><small>{item.customerEmail || item.customerPhone || 'Sin contacto'}</small></td>
            <td><strong>{item.tourName}</strong><small>{dateOnly(item.travelDate)} · {item.tourLinked ? 'Tour vinculado' : 'Reserva histórica'}</small></td>
            <td><strong>{item.adults + item.children}</strong><small>{item.adults} adulto(s) · {item.children} niño(s)</small></td>
            <td><strong>{money(item.totalAmount,item.currency)}</strong><small>{item.source}</small></td>
            <td><select className={`reservation-status status-${item.status}`} value={item.status} onChange={(e)=>updateStatus(item.id,e.target.value)}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></td>
          </tr>)}</tbody></table></div>
          <div className="reservations-pagination"><span>{data.pagination.total} resultado(s) · {totalPassengers} pasajero(s) en esta página</span><div><button disabled={data.pagination.page<=1} onClick={()=>load(data.pagination.page-1,status,query)}><ChevronLeft size={17}/></button><span>Página {data.pagination.page} de {data.pagination.pages}</span><button disabled={data.pagination.page>=data.pagination.pages} onClick={()=>load(data.pagination.page+1,status,query)}><ChevronRight size={17}/></button></div></div>
        </>}
      </section>
    </main>

    {drawer && <div className="reservation-modal"><button className="reservation-modal-backdrop" onClick={()=>setDrawer(false)} aria-label="Cerrar"/><section><header><div><span>NUEVA RESERVA</span><h2>Registrar solicitud</h2></div><button onClick={()=>setDrawer(false)}><X size={20}/></button></header>
      <form onSubmit={createReservation}>
        <div className="reservation-form-grid"><label>Nombre del cliente<input name="customerName" maxLength={120} required/></label><label>Tour publicado<select name="tourId" required defaultValue=""><option value="" disabled>Selecciona un tour</option>{tourOptions.map((tour)=><option key={tour.id} value={tour.id}>{tour.name} · {tour.destination} · {money(tour.adultPrice,tour.currency)}</option>)}</select></label><label>Correo<input name="customerEmail" type="email" maxLength={190}/></label><label>Teléfono<input name="customerPhone" maxLength={40}/></label><label>Fecha del viaje<input name="travelDate" type="date" required/></label><label>Monto estimado<input name="totalAmount" type="number" min="0" step="0.01" placeholder="Vacío = cálculo automático"/></label><label>Adultos<input name="adults" type="number" min="1" max="99" defaultValue="1" required/></label><label>Niños<input name="children" type="number" min="0" max="99" defaultValue="0" required/></label></div>
        <label>Notas<textarea name="notes" rows={4} maxLength={4000} placeholder="Detalles operativos, punto de encuentro, necesidades especiales…"/></label>
        {tourOptions.length===0 && <p className="reservation-form-help"><ClipboardList size={16}/> No hay tours publicados. Publica al menos un tour antes de crear nuevas reservas.</p>}
        <p className="reservation-form-help"><UserRound size={16}/> El nombre, moneda y precio base del tour se toman del catálogo oficial. El nombre queda guardado como fotografía histórica de la reserva.</p>
        {createError && <div className="reservation-form-error">{createError}</div>}
        <footer><button type="button" onClick={()=>setDrawer(false)}>Cancelar</button><button className="primary" disabled={creating || tourOptions.length===0}>{creating?<><Loader2 className="spin" size={17}/> Guardando…</>:<><CircleDollarSign size={17}/> Crear reserva</>}</button></footer>
      </form>
    </section></div>}
  </div>;
}
