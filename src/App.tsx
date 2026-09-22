import { Fragment, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, LucideIcon } from 'lucide-react';
import { ArrowLeft, CalendarDays, Camera, CheckCircle2, ChevronRight, Eye, EyeOff, Headphones, Leaf, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, Star, Users, Van } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  ArrowLeft, CalendarDays, Camera, CheckCircle2, ChevronRight, Eye, EyeOff,
  Headphones, Leaf, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, Star, Users, Van,
};

interface HeroStat { icon: string; value: string; label: string; stars: string; }
interface TextItem { icon: string; title: string; text: string; }
interface DestinationItem { name: string; subtitle: string; image: string; }
interface TestimonialItem { quote: string; author: string; country: string; }
interface FaqItem { question: string; answer: string; }

interface Landing {
  hero: { eyebrow: string; title: string; lead: string; primaryCta: string; secondaryCta: string; image: string; stats: HeroStat[] };
  trust: { items: TextItem[] };
  tours: { eyebrow: string; title: string; linkLabel: string };
  why: { eyebrow: string; title: string; items: TextItem[] };
  destinations: { eyebrow: string; title: string; linkLabel: string; items: DestinationItem[] };
  how: { eyebrow: string; title: string; steps: TextItem[] };
  testimonials: { eyebrow: string; title: string; items: TestimonialItem[] };
  faq: { eyebrow: string; title: string; items: FaqItem[] };
  cta: { title: string; copy: string; whatsappLabel: string };
  contact: { phone: string; email: string; location: string; whatsapp: string; schedule: string; addressExtra: string; instagram: string; facebook: string; tiktok: string };
  footer: { copy: string };
  promo: { enabled: boolean; text: string };
  sections: { visible: Record<string, boolean>; order: string[] };
  seo: { title: string; description: string };
}

const DEFAULT_HERO_STATS: HeroStat[] = [
  { icon: 'Users', value: '15,000+', label: 'Viajeros felices', stars: '★★★★★' },
  { icon: 'Star', value: '4.9/5', label: 'Calificación promedio', stars: '★★★★★' },
  { icon: 'MapPin', value: '50+', label: 'Destinos increíbles', stars: '' },
];
const DEFAULT_TRUST_ITEMS: TextItem[] = [
  { icon: 'ShieldCheck', title: 'Operador 100% local', text: 'y certificado' },
  { icon: 'Leaf', title: 'Turismo sostenible', text: 'y responsable' },
  { icon: 'Headphones', title: 'Soporte 24/7', text: 'antes y durante tu viaje' },
  { icon: 'LockKeyhole', title: 'Reservas seguras', text: 'y confirmación inmediata' },
];
const DEFAULT_WHY_ITEMS: TextItem[] = [
  { icon: 'CalendarDays', title: 'Reservas fáciles', text: 'Reserva en minutos y recibe confirmación inmediata.' },
  { icon: 'Users', title: 'Guías locales', text: 'Expertos apasionados que conocen cada rincón.' },
  { icon: 'Headphones', title: 'Atención personalizada', text: 'Te acompañamos antes, durante y después.' },
  { icon: 'Van', title: 'Transporte confiable', text: 'Unidades cómodas y seguras con aire acondicionado.' },
  { icon: 'Leaf', title: 'Experiencias auténticas', text: 'Conexión real con la cultura, naturaleza y comunidad.' },
];
const DEFAULT_DESTINATIONS: DestinationItem[] = [
  { name: 'Manuel Antonio', subtitle: 'Playas, vida silvestre y aventura', image: 'https://plus.unsplash.com/premium_photo-1661964589674-21cc0d7e345a?q=80&w=600&auto=format&fit=crop' },
  { name: 'Arenal', subtitle: 'Volcán, aguas termales y bosque tropical', image: 'https://images.unsplash.com/photo-1610932748192-06f1ee748b34?q=80&w=600&auto=format&fit=crop' },
  { name: 'Monteverde', subtitle: 'Bosque nuboso y puentes colgantes', image: 'https://images.unsplash.com/photo-1580909320993-2569d592e08a?q=80&w=600&auto=format&fit=crop' },
  { name: 'Guanacaste', subtitle: 'Sol, playas doradas y atardeceres', image: 'https://images.unsplash.com/photo-1544550285-f813152bbc2a?q=80&w=600&auto=format&fit=crop' },
  { name: 'Tortuguero', subtitle: 'Canales, naturaleza y tortugas marinas', image: 'https://images.unsplash.com/photo-1577907549794-494d8d8a6e43?q=80&w=600&auto=format&fit=crop' },
];
const DEFAULT_HOW_STEPS: TextItem[] = [
  { icon: 'MapPin', title: 'Elige tu tour', text: 'Explora nuestras experiencias y selecciona tu favorita.' },
  { icon: 'CalendarDays', title: 'Reserva', text: 'Completa tus datos, realiza el pago y recibe confirmación.' },
  { icon: 'Camera', title: 'Disfruta', text: 'Vive una experiencia increíble y crea recuerdos inolvidables.' },
];
const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  { quote: 'La experiencia en La Fortuna fue increíble. Los guías súper profesionales y muy amables. 100% recomendado.', author: 'María Fernanda', country: 'México' },
  { quote: 'Todo salió perfecto, desde la reserva hasta el último detalle del tour. Capoy hizo nuestro viaje inolvidable.', author: 'Carlos Alberto', country: 'Colombia' },
  { quote: 'El catamarán al atardecer fue mágico. Paisajes hermosos, excelente servicio y mucha diversión.', author: 'Laura y Andrés', country: 'Argentina' },
];
const DEFAULT_FAQ_ITEMS: FaqItem[] = [
  { question: '¿Cómo puedo hacer una reserva?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  { question: '¿Puedo reservar un tour en otro idioma?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  { question: '¿Qué incluye el precio del tour?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  { question: '¿Cómo funcionan las reservas grupales?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  { question: '¿Qué pasa si llueve el día de mi tour?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  { question: '¿Debo pagar por adelantado?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
];
const SECTION_ORDER_DEFAULT = ['trust', 'tours', 'why', 'destinations', 'how', 'testimonials', 'faq', 'cta'];

type Breakpoint = 'desktop' | 'tablet' | 'mobile';

interface LandingComponentItem {
  id: number;
  slot: string;
  position: { x: number; y: number; w: number | null; h: number | null; z: number };
  hidden: boolean;
  props: Record<string, unknown>;
}

interface LandingComponentsPayload {
  header: Record<Breakpoint, LandingComponentItem[]>;
  hero: Record<Breakpoint, LandingComponentItem[]>;
  trust_strip: Record<Breakpoint, LandingComponentItem[]>;
}

function breakpointFromWidth(w: number): Breakpoint {
  if (w >= 1024) return 'desktop';
  if (w >= 600) return 'tablet';
  return 'mobile';
}

function cmpBaseStyle(item: LandingComponentItem): CSSProperties {
  const fixed = (item.props as Record<string, unknown>).positionFixed === true;
  return {
    position: fixed ? 'fixed' : 'absolute',
    left: `${item.position.x}px`,
    top: `${item.position.y}px`,
    width: item.position.w == null ? 'auto' : `${item.position.w}px`,
    height: item.position.h == null ? 'auto' : `${item.position.h}px`,
    zIndex: item.position.z,
  };
}

function renderHeaderComponents(items: LandingComponentItem[]) {
  const visible = items.filter((c) => !c.hidden);
  const menuLinks = visible
    .filter((c) => c.slot.startsWith('menu_link:'))
    .sort((a, b) => a.position.x - b.position.x);
  return <div className="landing-section landing-section--header">
    {visible.filter((c) => !c.slot.startsWith('menu_link:')).map((c) => {
      const props = c.props as Record<string, string>;
      if (c.slot === 'logo') {
        return <a key={c.id} className="brand" href={props.href || '#inicio'} aria-label={props.alt || 'Capoy Costa Rica'} style={cmpBaseStyle(c)} data-cmp={c.slot} data-cmp-id={c.id}>
          <div className="brand-mark">◒</div>
          <div><strong>{props.text}</strong><span>{props.alt || 'Costa Rica'}</span></div>
        </a>;
      }
      if (c.slot === 'login_btn') {
        return <a key={c.id} className="admin-login-link" href={props.href || '/admin/login'} data-admin-login aria-label={props.text || 'Iniciar sesión'} style={cmpBaseStyle(c)} data-cmp={c.slot} data-cmp-id={c.id}>{props.text || 'Iniciar sesión'}</a>;
      }
      if (c.slot === 'phone') {
        return <a key={c.id} className="phone" href={props.href || '#'} style={cmpBaseStyle(c)} data-cmp={c.slot} data-cmp-id={c.id}><Phone size={16}/>{props.text}</a>;
      }
      if (c.slot === 'reserve_btn') {
        return <a key={c.id} className="reserve-btn" href={props.href || '#tours'} style={cmpBaseStyle(c)} data-cmp={c.slot} data-cmp-id={c.id}><CalendarDays size={17}/>{props.text || 'Reservar ahora'}</a>;
      }
      return null;
    })}
    {menuLinks.map((c, idx) => {
      const props = c.props as Record<string, string>;
      return <a key={c.id} className="nav-link" href={props.href || '#'} style={cmpBaseStyle(c)} data-cmp={c.slot} data-cmp-id={c.id} data-nav-first={idx === 0 ? 'true' : undefined}>{props.text}</a>;
    })}
  </div>;
}

function renderHeroComponents(items: LandingComponentItem[]) {
  const visible = items.filter((c) => !c.hidden);
  const bg = visible.find((c) => c.slot === 'bg_image');
  const eyebrow = visible.find((c) => c.slot === 'eyebrow');
  const title = visible.find((c) => c.slot === 'title');
  const lead = visible.find((c) => c.slot === 'lead');
  const ctaPrimary = visible.find((c) => c.slot === 'cta_primary');
  const ctaSecondary = visible.find((c) => c.slot === 'cta_secondary');
  return <div className="landing-section landing-section--hero" id="inicio">
    {bg && <div className="hero-bg-image" data-cmp={bg.slot} data-cmp-id={bg.id} style={{ position: 'absolute', left: `${bg.position.x}px`, top: `${bg.position.y}px`, width: `${bg.position.w ?? 0}px`, height: `${bg.position.h ?? 0}px`, backgroundImage: `url(${(bg.props as Record<string, string>).src})`, backgroundSize: 'cover', backgroundPosition: 'center 45%', zIndex: bg.position.z }} role="img" aria-label={(bg.props as Record<string, string>).alt || ''} />}
    <div className="hero-overlay" aria-hidden="true" />
    {eyebrow && <p className="script" style={cmpBaseStyle(eyebrow)} data-cmp={eyebrow.slot} data-cmp-id={eyebrow.id}>{(eyebrow.props as Record<string, string>).text}</p>}
    {title && <h1 style={cmpBaseStyle(title)} data-cmp={title.slot} data-cmp-id={title.id} dangerouslySetInnerHTML={{ __html: (title.props as Record<string, string>).text || '' }} />}
    {lead && <p className="lead" style={cmpBaseStyle(lead)} data-cmp={lead.slot} data-cmp-id={lead.id}>{(lead.props as Record<string, string>).text}</p>}
    {ctaPrimary && <a className="primary-ghost" href={(ctaPrimary.props as Record<string, string>).href || '#tours'} style={cmpBaseStyle(ctaPrimary)} data-cmp={ctaPrimary.slot} data-cmp-id={ctaPrimary.id}>{(ctaPrimary.props as Record<string, string>).text || 'Ver tours'} <ChevronRight size={18}/></a>}
    {ctaSecondary && <a className="secondary-btn" href={(ctaSecondary.props as Record<string, string>).href || '#como-funciona'} style={cmpBaseStyle(ctaSecondary)} data-cmp={ctaSecondary.slot} data-cmp-id={ctaSecondary.id}>{(ctaSecondary.props as Record<string, string>).text || 'Planear mi viaje'}</a>}
  </div>;
}

function renderTrustStripComponents(items: LandingComponentItem[]) {
  const visible = items
    .filter((c) => !c.hidden)
    .sort((a, b) => a.slot.localeCompare(b.slot, undefined, { numeric: true }));
  return <div className="landing-section landing-section--trust_strip">
    {visible.map((c) => {
      const props = c.props as Record<string, string>;
      const Icon = ICON_MAP[props.icon] || CheckCircle2;
      return <div key={c.id} className="landing-trust-cell" style={cmpBaseStyle(c)} data-cmp={c.slot} data-cmp-id={c.id}>
        <Icon/>
        <span><b>{props.title}</b>{props.text}</span>
      </div>;
    })}
  </div>;
}

const DEFAULT_LANDING: Landing = {
  hero: { eyebrow: 'Explora', title: 'Costa Rica<br/>como nunca<br/>antes', lead: 'Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país.', primaryCta: 'Ver tours', secondaryCta: 'Planear mi viaje ✈', image: '', stats: DEFAULT_HERO_STATS },
  trust: { items: DEFAULT_TRUST_ITEMS },
  tours: { eyebrow: '🍃 TOURS DESTACADOS', title: 'Vive experiencias inolvidables', linkLabel: 'Ver todos los tours' },
  why: { eyebrow: '🍃 ¿POR QUÉ ELEGIR CAPOY COSTA RICA?', title: 'Tu aventura, nuestra pasión', items: DEFAULT_WHY_ITEMS },
  destinations: { eyebrow: '🍃 DESTINOS POPULARES', title: 'Descubre lo mejor de Costa Rica', linkLabel: 'Ver todos los destinos', items: DEFAULT_DESTINATIONS },
  how: { eyebrow: '🍃 ¿CÓMO FUNCIONA?', title: 'Reservar tu aventura es fácil', steps: DEFAULT_HOW_STEPS },
  testimonials: { eyebrow: '🍃 LO QUE DICEN NUESTROS VIAJEROS', title: 'Historias reales, experiencias increíbles', items: DEFAULT_TESTIMONIALS },
  faq: { eyebrow: 'PREGUNTAS FRECUENTES', title: 'Resolvemos tus dudas', items: DEFAULT_FAQ_ITEMS },
  cta: { title: '¿Listo para tu próxima aventura?', copy: 'Reserva hoy y vive Costa Rica como nunca antes.<br/>Tu mejor historia comienza aquí.', whatsappLabel: '🟢 o escríbenos por WhatsApp' },
  contact: { phone: '+506 8880-1234', email: 'info@capoycostarica.com', location: 'La Fortuna, Alajuela, Costa Rica', whatsapp: '50688801234', schedule: 'Lun a Dom · 7:00 a 21:00', addressExtra: '', instagram: '', facebook: '', tiktok: '' },
  footer: { copy: 'Tours locales, experiencias auténticas y recuerdos que duran para siempre.' },
  promo: { enabled: false, text: '' },
  sections: { visible: Object.fromEntries(SECTION_ORDER_DEFAULT.map((k) => [k, true])), order: SECTION_ORDER_DEFAULT },
  seo: { title: 'Capoy Costa Rica | Tours y experiencias auténticas', description: 'Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país. Tours, destinos y aventuras inolvidables.' },
};

function defaultLanding(): Landing {
  return JSON.parse(JSON.stringify(DEFAULT_LANDING)) as Landing;
}

function renderLandingSection(key: string, landing: Landing) {
  switch (key) {
    case 'trust':
      return <section className="trust-strip"><div className="container trust-grid">{landing.trust.items.map((item, index) => { const Icon = ICON_MAP[item.icon] || CheckCircle2; return <div key={index}><Icon/><span><b>{item.title}</b>{item.text}</span></div>; })}</div></section>;
    case 'tours':
      return <section className="section container" id="tours"><div className="section-heading"><div><p className="eyebrow">{landing.tours.eyebrow}</p><h2>{landing.tours.title}</h2></div><a href="#tours">{landing.tours.linkLabel} →</a></div><div className="tour-grid">{/* populated by PublicToursBridge from /api/public/tours */}</div></section>;
    case 'why':
      return <section className="why container"><p className="eyebrow center">{landing.why.eyebrow}</p><h2>{landing.why.title}</h2><div className="why-grid">{landing.why.items.map((item, index) => { const Icon = ICON_MAP[item.icon] || CheckCircle2; return <div key={index}><Icon/><b>{item.title}</b><span>{item.text}</span></div>; })}</div></section>;
    case 'destinations':
      return <section className="section container" id="destinos"><div className="section-heading"><div><p className="eyebrow">{landing.destinations.eyebrow}</p><h2>{landing.destinations.title}</h2></div><a href="#destinos">{landing.destinations.linkLabel} →</a></div><div className="destination-grid">{landing.destinations.items.map((item, index) => item.image ? <article key={index} style={{ backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.68), transparent 65%),url(${item.image})` }}><div><h3>{item.name}</h3><p>{item.subtitle}</p></div></article> : null)}</div></section>;
    case 'how':
      return <section className="section container how" id="como-funciona"><p className="eyebrow center">{landing.how.eyebrow}</p><h2>{landing.how.title}</h2><div className="steps">{landing.how.steps.map((step, index) => { const Icon = ICON_MAP[step.icon] || CheckCircle2; return <Fragment key={index}>{index > 0 && <span className="arrow">→</span>}<div><Icon/><i>{index + 1}</i><b>{step.title}</b><span>{step.text}</span></div></Fragment>; })}</div></section>;
    case 'testimonials':
      return <section className="section container testimonials"><p className="eyebrow center">{landing.testimonials.eyebrow}</p><h2>{landing.testimonials.title}</h2><div className="testimonial-grid">{landing.testimonials.items.map((item, index) => item.quote ? <blockquote key={index}><span className="quote">“</span><p>{item.quote}</p><div className="stars">★★★★★</div><b>{item.author}</b><small>{item.country}</small></blockquote> : null)}</div></section>;
    case 'faq':
      return <section className="section container faq" id="faq"><p className="eyebrow center">{landing.faq.eyebrow}</p><h2>{landing.faq.title}</h2><div className="faq-grid">{landing.faq.items.map((item, index) => item.question ? <details key={index}><summary>{item.question}<span>⌄</span></summary><p>{item.answer}</p></details> : null)}</div></section>;
    case 'cta': {
      const ctaWhatsappNumber = landing.contact.whatsapp || landing.contact.phone.replace(/[^\d+]/g, '');
      const ctaWhatsappUrl = ctaWhatsappNumber ? `https://wa.me/${ctaWhatsappNumber.replace(/[^\d]/g, '')}` : '#';
      const fullLocation = landing.contact.addressExtra
        ? `${landing.contact.location}, ${landing.contact.addressExtra}`
        : landing.contact.location;
      const ctaCopyParts = String(landing.cta.copy || '').split(/<br\s*\/?>(?:\s*)/i);
      return (
        <section className="cta container" id="contacto">
          <div className="cta-copy">
            <div className="cta-logo">◒</div>
            <div>
              <h2>{landing.cta.title}</h2>
              {ctaCopyParts.map((part, idx) => (
                <span key={idx} className="cta-copy-line">{part}</span>
              ))}
            </div>
          </div>
          <div className="cta-actions">
            <a className="reserve-btn" href="#tours"><CalendarDays size={17}/>Reservar ahora</a>
            {ctaWhatsappNumber ? <a className="cta-whatsapp-btn" href={ctaWhatsappUrl} target="_blank" rel="noopener noreferrer">{landing.cta.whatsappLabel || '🟢 o escríbenos por WhatsApp'}</a> : null}
            {landing.contact.schedule ? <span className="cta-schedule">{landing.contact.schedule}</span> : null}
          </div>
          <div className="cta-contact-info">
            <a href={`tel:${landing.contact.phone.replace(/[^\d+]/g, '')}`}><Phone size={14}/> {landing.contact.phone}</a>
            {landing.contact.email ? <a href={`mailto:${landing.contact.email}`}><Mail size={14}/> {landing.contact.email}</a> : null}
            <span><MapPin size={14}/> {fullLocation}</span>
            {landing.contact.instagram ? <a href={`https://instagram.com/${landing.contact.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer">@{landing.contact.instagram.replace(/^@/, '')}</a> : null}
            {landing.contact.facebook ? <a href={landing.contact.facebook.startsWith('http') ? landing.contact.facebook : `https://facebook.com/${landing.contact.facebook}`} target="_blank" rel="noopener noreferrer">Facebook</a> : null}
            {landing.contact.tiktok ? <a href={landing.contact.tiktok.startsWith('http') ? landing.contact.tiktok : `https://tiktok.com/@${landing.contact.tiktok.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer">TikTok</a> : null}
          </div>
        </section>
      );
    }
    default:
      return null;
  }
}

function PublicLanding() {
  const [landing, setLanding] = useState<Landing>(defaultLanding);
  const [components, setComponents] = useState<LandingComponentsPayload | null>(null);
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return breakpointFromWidth(window.innerWidth);
  });

  useEffect(() => {
    let active = true;
    fetch('/api/public/landing', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('landing');
        return response.json();
      })
      .then((data) => { if (active && data?.landing) setLanding(data.landing); })
      .catch(() => { /* keep defaults */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/public/landing/page', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('components');
        const data = await response.json();
        if (!active) return;
        if (data?.sections?.header && data?.sections?.hero && data?.sections?.trust_strip) {
          setComponents(data.sections as LandingComponentsPayload);
        }
      })
      .catch(() => { /* keep null → render static */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function handle() { setBp(breakpointFromWidth(window.innerWidth)); }
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    document.title = landing.seo.title || 'Capoy Costa Rica';
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = landing.seo.description || '';
  }, [landing.seo.title, landing.seo.description]);

  const visibleOrder = useMemo(
    () => landing.sections.order.filter((key) => landing.sections.visible[key] !== false),
    [landing]
  );
  const legacyVisibleOrder = useMemo(
    () => visibleOrder.filter((key) => key !== 'trust'),
    [visibleOrder]
  );

  const heroStyle = landing.hero.image ? { backgroundImage: `url(${landing.hero.image})` } : undefined;
  const phoneHref = `tel:${landing.contact.phone.replace(/[^\d+]/g, '')}`;

  const useComponentsView = components !== null;

  return <div className="site-shell">
    {landing.promo.enabled && landing.promo.text.trim() !== '' && <div className="promo-bar"><p>{landing.promo.text}</p></div>}

    {useComponentsView && components ? (
      <div className="landing-components-root">
        {renderHeaderComponents(components.header[bp])}
        {renderHeroComponents(components.hero[bp])}
        {renderTrustStripComponents(components.trust_strip[bp])}
      </div>
    ) : (
      <section className="hero" id="inicio" style={heroStyle}>
        <div className="hero-overlay" />
        <header className="topbar container">
          <a className="brand" href="#inicio" aria-label="Capoy Costa Rica"><div className="brand-mark">◒</div><div><strong>Capoy</strong><span>Costa Rica</span></div></a>
          <nav className="nav" aria-label="Navegación principal">
            {['Inicio', 'Tours', 'Destinos', 'FAQ', 'Contacto'].map((item) => <a key={item} href={`#${item.toLowerCase().replace('í', 'i')}`}>{item}</a>)}
          </nav>
          <div className="nav-actions"><a className="admin-login-link" href="/admin/login" data-admin-login aria-label="Iniciar sesión en el panel administrativo">Iniciar sesión</a><a className="phone" href={phoneHref}><Phone size={16}/>{landing.contact.phone}</a><a className="reserve-btn" href="#tours"><CalendarDays size={17}/>Reservar ahora</a></div>
        </header>

        <div className="container hero-content">
          <div className="hero-copy">
            <p className="script">{landing.hero.eyebrow}</p>
            <h1 dangerouslySetInnerHTML={{ __html: landing.hero.title }} />
            <p className="lead">{landing.hero.lead}</p>
            <div className="hero-buttons"><a className="primary-ghost" href="#tours">{landing.hero.primaryCta} <ChevronRight size={18}/></a><a className="secondary-btn" href="#como-funciona">{landing.hero.secondaryCta}</a></div>
          </div>
          
        </div>
      </section>
    )}

    <main>{(useComponentsView ? legacyVisibleOrder : visibleOrder).map((key) => <Fragment key={key}>{renderLandingSection(key, landing)}</Fragment>)}</main>

    <footer className="footer"><div className="container footer-grid"><div><a className="brand footer-brand" href="#inicio"><div className="brand-mark">◒</div><div><strong>Capoy</strong><span>Costa Rica</span></div></a><p>{landing.footer.copy}</p><div className="socials">{landing.contact.instagram&&<a href={`https://instagram.com/${landing.contact.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram">●</a>}{landing.contact.facebook&&<a href={landing.contact.facebook.startsWith('http')?landing.contact.facebook:`https://facebook.com/${landing.contact.facebook}`} target="_blank" rel="noopener noreferrer" aria-label="Facebook">●</a>}{landing.contact.tiktok&&<a href={landing.contact.tiktok.startsWith('http')?landing.contact.tiktok:`https://tiktok.com/@${landing.contact.tiktok.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" aria-label="TikTok">●</a>}{!landing.contact.instagram&&!landing.contact.facebook&&!landing.contact.tiktok&&<span>● ● ● ● ●</span>}</div></div><div><b>Enlaces rápidos</b><a href="#inicio">Inicio</a><a href="#tours">Tours</a><a href="#destinos">Destinos</a></div><div><b>Información</b><a href="#faq">Sobre nosotros</a><a href="#faq">FAQ</a><a href="#faq">Términos y condiciones</a><a href="#faq">Política de privacidad</a></div><div><b>Contacto</b><span>{landing.contact.phone}</span><span>{landing.contact.email}</span><span>{landing.contact.location}{landing.contact.addressExtra?`, ${landing.contact.addressExtra}`:''}</span>{landing.contact.schedule&&<span>🕐 {landing.contact.schedule}</span>}{landing.contact.whatsapp&&<a href={`https://wa.me/${landing.contact.whatsapp.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp {landing.contact.phone}</a>}</div><div><b>Suscríbete a nuestras aventuras</b><p>Recibe ofertas exclusivas y novedades en tu correo.</p><form onSubmit={(e) => e.preventDefault()}><input type="email" placeholder="Tu correo electrónico" aria-label="Tu correo electrónico"/><button>Suscribirme</button></form></div></div><div className="container copyright">© 2026 Capoy Costa Rica. Todos los derechos reservados.<span>Diseñado con ❤ en Costa Rica</span></div></footer>
  </div>;
}

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
            <div className="login-input"><LockKeyhole size={18}/><input type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" placeholder="Ingresa tu contraseña" minLength={8} maxLength={200} required /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
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
  const [user, setUser] = useState<{ displayName: string; email: string; role: string } | null>(null);

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
    <section className="login-panel" style={{ width: '100%', minHeight: '100vh' }}>
      <div className="login-card">
        <div className="login-mobile-brand" style={{ display: 'flex' }}><div className="login-brand-mark">C</div><div><strong>Capoy</strong><span>Costa Rica</span></div></div>
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

  return <PublicLanding/>;
}