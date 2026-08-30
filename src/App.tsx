import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Camera, CheckCircle2, ChevronRight, Eye, EyeOff, Headphones, Heart, Leaf, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, Star, Users, Van } from 'lucide-react';

const tours = [
  { badge: 'Más popular', title: 'Aventura en La Fortuna', place: 'La Fortuna, Alajuela', copy: 'Volcán Arenal, senderos, puentes colgantes y aguas termales.', hours: '8 horas', price: '$129', image: 'https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format&fit=crop&w=900&q=85' },
  { badge: 'Ideal para familias', title: 'Cataratas & Naturaleza', place: 'Pérez Zeledón', copy: 'Cascadas espectaculares y vida silvestre en su hábitat natural.', hours: '6 horas', price: '$95', image: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=900&q=85' },
  { badge: 'Romántico', title: 'Catamarán al Atardecer', place: 'Golfo de Papagayo', copy: 'Navega, disfruta del atardecer y snorkel en aguas cristalinas.', hours: '4 horas', price: '$89', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85' },
  { badge: 'Relajante', title: 'Volcán y Termales', place: 'Arenal, Alajuela', copy: 'Visita al volcán Arenal y relájate en termas naturales.', hours: '7 horas', price: '$119', image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=900&q=85' },
];

const gallery = [
  'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=600&q=85',
  'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=600&q=85',
  'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=600&q=85',
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=600&q=85',
  'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=600&q=85',
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=85',
];

const destinations = [
  ['Manuel Antonio', 'Playas y vida silvestre', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=700&q=85'],
  ['Arenal', 'Aventura y relajación', 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=700&q=85'],
  ['Monteverde', 'Bosques nubosos', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=85'],
  ['Guanacaste', 'Playas y sol todo el año', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=700&q=85'],
  ['Tortuguero', 'Canales y biodiversidad', 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=700&q=85'],
];

const testimonials = [
  ['La experiencia en La Fortuna fue increíble. Los guías súper profesionales y muy amables. 100% recomendado.', 'María Fernanda', 'México'],
  ['Todo salió perfecto, desde la reserva hasta el último detalle del tour. Capoy hizo nuestro viaje inolvidable.', 'Carlos Alberto', 'Colombia'],
  ['El catamarán al atardecer fue mágico. Paisajes hermosos, excelente servicio y mucha diversión.', 'Laura y Andrés', 'Argentina'],
];

function AdminLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: String(form.get('email') || ''),
          password: String(form.get('password') || ''),
          remember: form.get('remember') === 'on',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error || 'No fue posible iniciar sesión.');
        return;
      }
      window.location.assign('/admin');
    } catch {
      setMessage('No fue posible conectar con el servidor. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="login-page">
    <section className="login-visual" aria-label="Costa Rica">
      <div className="login-visual-overlay" />
      <a className="login-back" href="/"><ArrowLeft size={17}/> Volver al sitio</a>
      <div className="login-brand"><div className="login-brand-mark">C</div><div><strong>Capoy</strong><span>Costa Rica</span></div></div>
      <div className="login-story">
        <span className="login-kicker">PANEL DE OPERACIONES</span>
        <h1>Todo tu negocio,<br/>en un solo lugar.</h1>
        <p>Gestiona tours, reservas, clientes y contenido desde una experiencia diseñada para trabajar rápido y con claridad.</p>
        <div className="login-benefits">
          <div><CheckCircle2/><span><b>Operación centralizada</b>Reservas, clientes y proveedores conectados.</span></div>
          <div><CheckCircle2/><span><b>Datos en tiempo real</b>Decisiones claras con información actualizada.</span></div>
          <div><CheckCircle2/><span><b>Acceso protegido</b>Tu panel administrativo permanece privado.</span></div>
        </div>
      </div>
      <div className="login-visual-footer"><span>Capoy Costa Rica</span><span>Administración segura</span></div>
    </section>

    <section className="login-panel">
      <div className="login-card">
        <div className="login-mobile-brand"><div className="login-brand-mark">C</div><div><strong>Capoy</strong><span>Costa Rica</span></div></div>
        <div className="login-heading"><span>BIENVENIDO DE NUEVO</span><h2>Inicia sesión</h2><p>Ingresa tus credenciales para acceder al panel administrativo.</p></div>
        <form className="login-form" onSubmit={submitLogin}>
          <label>Correo electrónico
            <div className="login-input"><Mail size={18}/><input type="email" name="email" autoComplete="email" placeholder="nombre@capoycostarica.com" maxLength={190} required /></div>
          </label>
          <label>Contraseña
            <div className="login-input"><LockKeyhole size={18}/><input type={showPassword?'text':'password'} name="password" autoComplete="current-password" placeholder="Ingresa tu contraseña" minLength={12} maxLength={200} required /><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar contraseña':'Mostrar contraseña'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
          </label>
          <div className="login-options"><label className="remember"><input type="checkbox" name="remember"/><span>Recordarme</span></label><a href="mailto:soporte@capoycostarica.com?subject=Recuperar%20acceso%20administrativo">¿Olvidaste tu contraseña?</a></div>
          <button className="login-submit" type="submit" disabled={loading}>{loading ? 'Verificando…' : <>Entrar al panel <ChevronRight size={18}/></>}</button>
          {message && <div className="login-notice" role="alert"><ShieldCheck size={18}/><span>{message}</span></div>}
        </form>
        <div className="login-security"><ShieldCheck size={16}/><span>Acceso exclusivo para personal autorizado de Capoy Costa Rica.</span></div>
        <p className="login-help">¿Necesitas ayuda? <a href="mailto:soporte@capoycostarica.com">Contacta a soporte</a></p>
      </div>
    </section>
  </main>;
}

function AdminAccess() {
  const [user, setUser] = useState<{displayName:string; email:string; role:string} | null>(null);

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unauthorized');
        return response.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => window.location.assign('/admin/login'));
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    window.location.assign('/admin/login');
  }

  return <main className="login-page">
    <section className="login-panel" style={{width:'100%', minHeight:'100vh'}}>
      <div className="login-card">
        <div className="login-mobile-brand" style={{display:'flex'}}><div className="login-brand-mark">C</div><div><strong>Capoy</strong><span>Costa Rica</span></div></div>
        <div className="login-heading"><span>ACCESO AUTORIZADO</span><h2>{user ? `Hola, ${user.displayName}` : 'Verificando sesión…'}</h2><p>{user ? `${user.email} · ${user.role}` : 'Estamos validando tu sesión segura.'}</p></div>
        {user && <><div className="login-notice" role="status"><ShieldCheck size={18}/><span><b>Sesión protegida activa.</b> La siguiente fase construirá aquí el Dashboard administrativo completo.</span></div><button className="login-submit" type="button" onClick={logout}>Cerrar sesión</button></>}
      </div>
    </section>
  </main>;
}

export function App() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  if (pathname === '/admin/login' || pathname === '/login') return <AdminLogin/>;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return <AdminAccess/>;

  return <div className="site-shell">
    <section className="hero" id="inicio">
      <div className="hero-overlay" />
      <header className="topbar container">
        <a className="brand" href="#inicio" aria-label="Capoy Costa Rica"><div className="brand-mark">◒</div><div><strong>Capoy</strong><span>Costa Rica</span></div></a>
        <nav className="nav" aria-label="Navegación principal">
          {['Inicio','Tours','Destinos','Galería','FAQ','Contacto'].map((item) => <a key={item} href={`#${item.toLowerCase().replace('í','i')}`}>{item}</a>)}
        </nav>
        <div className="nav-actions"><a className="phone" href="tel:+50688801234"><Phone size={16}/>+506 8880-1234</a><a className="reserve-btn" href="#tours"><CalendarDays size={17}/>Reservar ahora</a></div>
      </header>

      <div className="container hero-content">
        <div className="hero-copy">
          <p className="script">Explora</p>
          <h1>Costa Rica<br/>como nunca<br/>antes</h1>
          <p className="lead">Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país.</p>
          <div className="hero-buttons"><a className="primary-ghost" href="#tours">Ver tours <ChevronRight size={18}/></a><a className="secondary-btn" href="#como-funciona">Planear mi viaje ✈</a></div>
        </div>
        <div className="hero-stats">
          <div className="stat"><Users/><div><strong>15,000+</strong><span>Viajeros felices</span><em>★★★★★</em></div></div>
          <div className="stat"><Star/><div><strong>4.9/5</strong><span>Calificación promedio</span><em>★★★★★</em></div></div>
          <div className="stat"><MapPin/><div><strong>50+</strong><span>Destinos increíbles</span></div></div>
        </div>
      </div>
    </section>

    <section className="trust-strip"><div className="container trust-grid">
      <div><ShieldCheck/><span><b>Operador 100% local</b>y certificado</span></div>
      <div><Leaf/><span><b>Turismo sostenible</b>y responsable</span></div>
      <div><Headphones/><span><b>Soporte 24/7</b>antes y durante tu viaje</span></div>
      <div><LockKeyhole/><span><b>Reservas seguras</b>y confirmación inmediata</span></div>
    </div></section>

    <main>
      <section className="section container" id="tours">
        <div className="section-heading"><div><p className="eyebrow">🍃 TOURS DESTACADOS</p><h2>Vive experiencias inolvidables</h2></div><a href="#tours">Ver todos los tours →</a></div>
        <div className="tour-grid">{tours.map((tour) => <article className="tour-card" key={tour.title}>
          <div className="tour-image" style={{backgroundImage:`url(${tour.image})`}}><span className="badge">{tour.badge}</span><button aria-label="Agregar a favoritos"><Heart size={19}/></button></div>
          <div className="tour-body"><h3>{tour.title}</h3><p className="place"><MapPin size={14}/>{tour.place}</p><p>{tour.copy}</p><div className="tour-meta"><span>◷ {tour.hours}</span><div><small>Desde</small><strong>{tour.price}</strong><small>por persona</small></div></div><a href="#contacto" className="card-btn">Ver detalles</a></div>
        </article>)}</div>
      </section>

      <section className="why container">
        <p className="eyebrow center">🍃 ¿POR QUÉ ELEGIR CAPOY COSTA RICA?</p><h2>Tu aventura, nuestra pasión</h2>
        <div className="why-grid">
          <div><CalendarDays/><b>Reservas fáciles</b><span>Reserva en minutos y recibe confirmación inmediata.</span></div>
          <div><Users/><b>Guías locales</b><span>Expertos apasionados que conocen cada rincón.</span></div>
          <div><Headphones/><b>Atención personalizada</b><span>Te acompañamos antes, durante y después.</span></div>
          <div><Van/><b>Transporte confiable</b><span>Unidades cómodas y seguras con aire acondicionado.</span></div>
          <div><Leaf/><b>Experiencias auténticas</b><span>Conexión real con la cultura, naturaleza y comunidad.</span></div>
        </div>
      </section>

      <section className="section container" id="galeria"><p className="eyebrow">🍃 GALERÍA DE COSTA RICA</p><h2>Inspírate con nuestra tierra</h2><div className="gallery-grid">{gallery.map((src, i)=><img key={src} src={src} alt={`Costa Rica ${i+1}`}/>)}</div><div className="center-action"><a className="outline-btn" href="#galeria">Ver más fotos en la galería <Camera size={17}/></a></div></section>

      <section className="section container" id="destinos"><div className="section-heading"><div><p className="eyebrow">🍃 DESTINOS POPULARES</p><h2>Descubre lo mejor de Costa Rica</h2></div><a href="#destinos">Ver todos los destinos →</a></div><div className="destination-grid">{destinations.map(([name,sub,img])=><article key={name} style={{backgroundImage:`linear-gradient(0deg, rgba(0,0,0,.68), transparent 65%),url(${img})`}}><div><h3>{name}</h3><p>{sub}</p></div></article>)}</div></section>

      <section className="section container how" id="como-funciona"><p className="eyebrow center">🍃 ¿CÓMO FUNCIONA?</p><h2>Reservar tu aventura es fácil</h2><div className="steps"><div><MapPin/><i>1</i><b>Elige tu tour</b><span>Explora nuestras experiencias y selecciona tu favorita.</span></div><span className="arrow">→</span><div><CalendarDays/><i>2</i><b>Reserva</b><span>Completa tus datos, realiza el pago y recibe confirmación.</span></div><span className="arrow">→</span><div><Camera/><i>3</i><b>Disfruta</b><span>Vive una experiencia increíble y crea recuerdos inolvidables.</span></div></div></section>

      <section className="section container testimonials"><p className="eyebrow center">🍃 LO QUE DICEN NUESTROS VIAJEROS</p><h2>Historias reales, experiencias increíbles</h2><div className="testimonial-grid">{testimonials.map(([quote,name,country])=><blockquote key={name}><span className="quote">“</span><p>{quote}</p><div className="stars">★★★★★</div><b>{name}</b><small>{country}</small></blockquote>)}</div></section>

      <section className="section container faq" id="faq"><p className="eyebrow center">PREGUNTAS FRECUENTES</p><h2>Resolvemos tus dudas</h2><div className="faq-grid">{['¿Cómo puedo hacer una reserva?','¿Qué métodos de pago aceptan?','¿Puedo cancelar o cambiar mi reserva?','¿Incluye transporte desde mi hotel?','¿Qué debo llevar a los tours?','¿Los tours son aptos para niños y adultos mayores?'].map(q=><details key={q}><summary>{q}<span>⌄</span></summary><p>Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.</p></details>)}</div></section>

      <section className="cta container" id="contacto"><div className="cta-copy"><div className="cta-logo">◒</div><div><h2>¿Listo para tu próxima aventura?</h2><p>Reserva hoy y vive Costa Rica como nunca antes.<br/>Tu mejor historia comienza aquí.</p></div></div><div className="cta-actions"><a className="reserve-btn" href="#tours"><CalendarDays size={17}/>Reservar ahora</a><span>🟢 o escríbenos por WhatsApp</span></div></section>
    </main>

    <footer className="footer"><div className="container footer-grid"><div><a className="brand footer-brand" href="#inicio"><div className="brand-mark">◒</div><div><strong>Capoy</strong><span>Costa Rica</span></div></a><p>Tours locales, experiencias auténticas y recuerdos que duran para siempre.</p><div className="socials">● ● ● ● ●</div></div><div><b>Enlaces rápidos</b><a href="#inicio">Inicio</a><a href="#tours">Tours</a><a href="#destinos">Destinos</a><a href="#galeria">Galería</a></div><div><b>Información</b><a href="#faq">Sobre nosotros</a><a href="#faq">FAQ</a><a href="#faq">Términos y condiciones</a><a href="#faq">Política de privacidad</a></div><div><b>Contacto</b><span>+506 8880-1234</span><span>info@capoycostarica.com</span><span>La Fortuna, Alajuela, Costa Rica</span></div><div><b>Suscríbete a nuestras aventuras</b><p>Recibe ofertas exclusivas y novedades en tu correo.</p><form onSubmit={(e)=>e.preventDefault()}><input type="email" placeholder="Tu correo electrónico" aria-label="Tu correo electrónico"/><button>Suscribirme</button></form></div></div><div className="container copyright">© 2026 Capoy Costa Rica. Todos los derechos reservados.<span>Diseñado con ❤ en Costa Rica</span></div></footer>
  </div>;
}
