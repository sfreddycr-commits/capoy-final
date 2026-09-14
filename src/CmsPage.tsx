import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Image as ImageIcon, LayoutDashboard, Loader2, LogOut, Menu, Save, ShieldCheck, SlidersHorizontal, Upload, Users, X } from 'lucide-react';

type AdminUser = { id: number; displayName: string; email: string; role: string };
type CmsSettings = Record<string, { value: string; updatedAt: string }>;
type RowField = { key: string; label: string; placeholder?: string };

const FIELD_LABELS: Record<string, string> = {
  hero_eyebrow: 'Texto superior del hero',
  hero_title: 'Título principal',
  hero_lead: 'Descripción principal',
  hero_primary_cta: 'Botón principal',
  hero_secondary_cta: 'Botón secundario',
  hero_image: 'Imagen principal',
  tours_eyebrow: 'Texto superior',
  tours_title: 'Título',
  tours_link_label: 'Texto del enlace “Ver todos los tours”',
  why_eyebrow: 'Texto superior',
  why_title: 'Título',
  destinations_eyebrow: 'Texto superior',
  destinations_title: 'Título',
  destinations_link_label: 'Texto del enlace “Ver todos los destinos”',
  how_eyebrow: 'Texto superior',
  how_title: 'Título',
  testimonials_eyebrow: 'Texto superior',
  testimonials_title: 'Título',
  faq_eyebrow: 'Texto superior',
  faq_title: 'Título',
  cta_title: 'Título CTA final',
  cta_copy: 'Texto CTA final',
  contact_phone: 'Teléfono',
  contact_email: 'Correo',
  contact_location: 'Ubicación',
  footer_copy: 'Texto del footer',
  seo_title: 'Título SEO',
  seo_description: 'Descripción SEO',
  promo_text: 'Texto de la barra promocional',
  promo_enabled: 'Mostrar barra promocional',
};

const FIELD_TYPES: Record<string, 'text' | 'textarea' | 'email' | 'bool'> = {
  hero_eyebrow: 'text', hero_title: 'textarea', hero_lead: 'textarea', hero_primary_cta: 'text', hero_secondary_cta: 'text',
  tours_eyebrow: 'text', tours_title: 'text', tours_link_label: 'text',
  why_eyebrow: 'text', why_title: 'text',
  destinations_eyebrow: 'text', destinations_title: 'text', destinations_link_label: 'text',
  how_eyebrow: 'text', how_title: 'text',
  testimonials_eyebrow: 'text', testimonials_title: 'text',
  faq_eyebrow: 'text', faq_title: 'text',
  cta_title: 'text', cta_copy: 'textarea',
  contact_phone: 'text', contact_email: 'email', contact_location: 'text',
  footer_copy: 'textarea',
  seo_title: 'text', seo_description: 'textarea',
  promo_text: 'text', promo_enabled: 'bool',
};

const LIST_CONFIGS: Record<string, { maxItems: number; rows: RowField[] }> = {
  hero_stats: { maxItems: 6, rows: [{ key: 'icon', label: 'Icono' }, { key: 'value', label: 'Valor' }, { key: 'label', label: 'Etiqueta' }, { key: 'stars', label: 'Estrellas' }] },
  trust_strip: { maxItems: 6, rows: [{ key: 'icon', label: 'Icono' }, { key: 'title', label: 'Título' }, { key: 'text', label: 'Texto' }] },
  why_items: { maxItems: 12, rows: [{ key: 'icon', label: 'Icono' }, { key: 'title', label: 'Título' }, { key: 'text', label: 'Texto' }] },
  destinations: { maxItems: 12, rows: [{ key: 'name', label: 'Nombre' }, { key: 'subtitle', label: 'Subtítulo' }, { key: 'image', label: 'Imagen (URL)' }] },
  how_steps: { maxItems: 6, rows: [{ key: 'icon', label: 'Icono' }, { key: 'title', label: 'Título' }, { key: 'text', label: 'Texto' }] },
  testimonials: { maxItems: 12, rows: [{ key: 'quote', label: 'Cita' }, { key: 'author', label: 'Autor' }, { key: 'country', label: 'País' }] },
  faq_items: { maxItems: 20, rows: [{ key: 'question', label: 'Pregunta' }, { key: 'answer', label: 'Respuesta' }] },
};

const SECTION_KEYS = ['trust', 'tours', 'why', 'destinations', 'how', 'testimonials', 'faq', 'cta'];
const SECTION_LABELS: Record<string, string> = {
  trust: 'Franja de confianza',
  tours: 'Tours destacados',
  why: 'Por qué elegirnos',
  destinations: 'Destinos populares',
  how: 'Cómo funciona',
  testimonials: 'Testimonios',
  faq: 'Preguntas frecuentes',
  cta: 'CTA final',
};

const LIST_DEFAULTS: Record<string, unknown[]> = {
  hero_stats: [
    { icon: 'Users', value: '15,000+', label: 'Viajeros felices', stars: '★★★★★' },
    { icon: 'Star', value: '4.9/5', label: 'Calificación promedio', stars: '★★★★★' },
    { icon: 'MapPin', value: '50+', label: 'Destinos increíbles', stars: '' },
  ],
  trust_strip: [
    { icon: 'ShieldCheck', title: 'Operador 100% local', text: 'y certificado' },
    { icon: 'Leaf', title: 'Turismo sostenible', text: 'y responsable' },
    { icon: 'Headphones', title: 'Soporte 24/7', text: 'antes y durante tu viaje' },
    { icon: 'LockKeyhole', title: 'Reservas seguras', text: 'y confirmación inmediata' },
  ],
  why_items: [
    { icon: 'CalendarDays', title: 'Reservas fáciles', text: 'Reserva en minutos y recibe confirmación inmediata.' },
    { icon: 'Users', title: 'Guías locales', text: 'Expertos apasionados que conocen cada rincón.' },
    { icon: 'Headphones', title: 'Atención personalizada', text: 'Te acompañamos antes, durante y después.' },
    { icon: 'Van', title: 'Transporte confiable', text: 'Unidades cómodas y seguras con aire acondicionado.' },
    { icon: 'Leaf', title: 'Experiencias auténticas', text: 'Conexión real con la cultura, naturaleza y comunidad.' },
  ],
  destinations: [
    { name: 'Manuel Antonio', subtitle: 'Playas, vida silvestre y aventura', image: 'https://plus.unsplash.com/premium_photo-1661964589674-21cc0d7e345a?q=80&w=600&auto=format&fit=crop' },
    { name: 'Arenal', subtitle: 'Volcán, aguas termales y bosque tropical', image: 'https://images.unsplash.com/photo-1610932748192-06f1ee748b34?q=80&w=600&auto=format&fit=crop' },
    { name: 'Monteverde', subtitle: 'Bosque nuboso y puentes colgantes', image: 'https://images.unsplash.com/photo-1580909320993-2569d592e08a?q=80&w=600&auto=format&fit=crop' },
    { name: 'Guanacaste', subtitle: 'Sol, playas doradas y atardeceres', image: 'https://images.unsplash.com/photo-1544550285-f813152bbc2a?q=80&w=600&auto=format&fit=crop' },
    { name: 'Tortuguero', subtitle: 'Canales, naturaleza y tortugas marinas', image: 'https://images.unsplash.com/photo-1577907549794-494d8d8a6e43?q=80&w=600&auto=format&fit=crop' },
  ],
  how_steps: [
    { icon: 'MapPin', title: 'Elige tu tour', text: 'Explora nuestras experiencias y selecciona tu favorita.' },
    { icon: 'CalendarDays', title: 'Reserva', text: 'Completa tus datos, realiza el pago y recibe confirmación.' },
    { icon: 'Camera', title: 'Disfruta', text: 'Vive una experiencia increíble y crea recuerdos inolvidables.' },
  ],
  testimonials: [
    { quote: 'La experiencia en La Fortuna fue increíble. Los guías súper profesionales y muy amables. 100% recomendado.', author: 'María Fernanda', country: 'México' },
    { quote: 'Todo salió perfecto, desde la reserva hasta el último detalle del tour. Capoy hizo nuestro viaje inolvidable.', author: 'Carlos Alberto', country: 'Colombia' },
    { quote: 'El catamarán al atardecer fue mágico. Paisajes hermosos, excelente servicio y mucha diversión.', author: 'Laura y Andrés', country: 'Argentina' },
  ],
  faq_items: [
    { question: '¿Cómo puedo hacer una reserva?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
    { question: '¿Puedo reservar un tour en otro idioma?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
    { question: '¿Qué incluye el precio del tour?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
    { question: '¿Cómo funcionan las reservas grupales?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
    { question: '¿Qué pasa si llueve el día de mi tour?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
    { question: '¿Debo pagar por adelantado?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  ],
};

const GROUPS: Array<{ title: string; keys?: string[]; list?: string }> = [
  { title: 'Hero principal', keys: ['hero_eyebrow', 'hero_title', 'hero_lead', 'hero_primary_cta', 'hero_secondary_cta', 'hero_image'], list: 'hero_stats' },
  { title: 'Franja de confianza', list: 'trust_strip' },
  { title: 'Tours destacados', keys: ['tours_eyebrow', 'tours_title', 'tours_link_label'] },
  { title: 'Por qué elegirnos', keys: ['why_eyebrow', 'why_title'], list: 'why_items' },
  { title: 'Destinos populares', keys: ['destinations_eyebrow', 'destinations_title', 'destinations_link_label'], list: 'destinations' },
  { title: 'Cómo funciona', keys: ['how_eyebrow', 'how_title'], list: 'how_steps' },
  { title: 'Testimonios', keys: ['testimonials_eyebrow', 'testimonials_title'], list: 'testimonials' },
  { title: 'Preguntas frecuentes', keys: ['faq_eyebrow', 'faq_title'], list: 'faq_items' },
  { title: 'CTA final', keys: ['cta_title', 'cta_copy'] },
  { title: 'Contacto', keys: ['contact_phone', 'contact_email', 'contact_location'] },
  { title: 'Footer y barra promocional', keys: ['footer_copy', 'promo_text', 'promo_enabled'] },
  { title: 'SEO', keys: ['seo_title', 'seo_description'] },
];

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'CA'; }
function parseList(value: string | undefined): Array<Record<string, string>> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((it) => it && typeof it === 'object').map((it) => ({ ...it }));
  } catch { /* ignore */ }
  return [];
}
function parseSectionVisible(value: string | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        for (const k of SECTION_KEYS) out[k] = parsed[k] === false ? false : true;
      }
    } catch { /* ignore */ }
  }
  for (const k of SECTION_KEYS) if (!(k in out)) out[k] = true;
  return out;
}
function parseSectionOrder(value: string | undefined): string[] {
  const present: string[] = [];
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) for (const k of parsed) if (SECTION_KEYS.includes(k) && !present.includes(k)) present.push(k);
    } catch { /* ignore */ }
  }
  for (const k of SECTION_KEYS) if (!present.includes(k)) present.push(k);
  return present;
}

function JsonListEditor({ value, config, onChange }: { value: string; config: { maxItems: number; rows: RowField[] }; onChange: (json: string) => void }) {
  const [items, setItems] = useState<Array<Record<string, string>>>(() => parseList(value));
  const lastValue = useRef(value);

  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setItems(parseList(value));
    }
  }, [value]);

  function patch(index: number, key: string, val: string) {
    const next = items.map((it, i) => (i === index ? { ...it, [key]: val } : it));
    const json = JSON.stringify(next);
    lastValue.current = json;
    setItems(next);
    onChange(json);
  }
  function add() {
    if (items.length >= config.maxItems) return;
    const blank: Record<string, string> = {};
    for (const f of config.rows) blank[f.key] = '';
    const next = [...items, blank];
    const json = JSON.stringify(next);
    lastValue.current = json;
    setItems(next);
    onChange(json);
  }
  function remove(index: number) {
    const next = items.filter((_, i) => i !== index);
    const json = JSON.stringify(next);
    lastValue.current = json;
    setItems(next);
    onChange(json);
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    const json = JSON.stringify(next);
    lastValue.current = json;
    setItems(next);
    onChange(json);
  }

  return (
    <div className="cms-list-editor">
      {items.map((item, index) => (
        <div className="cms-list-row" key={index}>
          {config.rows.map((field) => (
            <input
              key={field.key}
              type={field.key === 'image' ? 'url' : 'text'}
              value={item[field.key] || ''}
              placeholder={field.placeholder || field.label}
              aria-label={`${field.label} — fila ${index + 1}`}
              onChange={(e) => patch(index, field.key, e.target.value)}
            />
          ))}
          <div className="cms-list-row-controls">
            <button type="button" className="cms-row-arrow" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Mover arriba"><ChevronUp size={15}/></button>
            <button type="button" className="cms-row-arrow" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label="Mover abajo"><ChevronDown size={15}/></button>
            <button type="button" className="cms-row-delete" onClick={() => remove(index)} aria-label="Eliminar fila"><X size={15}/></button>
          </div>
        </div>
      ))}
      <button type="button" className="cms-list-add" disabled={items.length >= config.maxItems} onClick={add}>+ Agregar fila {items.length >= config.maxItems ? `(máximo ${config.maxItems})` : ''}</button>
    </div>
  );
}

function HeroImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('La imagen no debe superar 8 MB.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch('/api/admin/cms/hero-image/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.url) throw new Error(body?.error || 'No fue posible subir la imagen.');
      onChange(body.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'No fue posible subir la imagen.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="cms-hero-image-field">
      <div className="cms-hero-image-preview">
        {value ? <img src={value} alt="Vista previa del hero" /> : <div className="cms-hero-image-placeholder"><ImageIcon size={32}/><small>Sin imagen</small></div>}
      </div>
      <div className="cms-hero-image-controls">
        <input name="hero_image" type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… o sube un archivo" />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} disabled={uploading} />
        <button type="button" className="cms-hero-image-upload" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <><Loader2 className="spin" size={16}/> Subiendo…</> : <><Upload size={16}/> Subir imagen</>}
        </button>
      </div>
      {uploadError && <div className="cms-hero-image-error">{uploadError}</div>}
    </div>
  );
}

export function CmsPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [settings, setSettings] = useState<CmsSettings>({});
  const [heroImage, setHeroImage] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sectionVisible, setSectionVisible] = useState<Record<string, boolean>>(() => parseSectionVisible(undefined));
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => parseSectionOrder(undefined));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [s, c] = await Promise.all([
        fetch('/api/auth/session', { credentials: 'same-origin' }),
        fetch('/api/admin/cms', { credentials: 'same-origin' }),
      ]);
      if (s.status === 401 || c.status === 401) { location.assign('/admin/login'); return; }
      if (!s.ok || !c.ok) throw new Error((await c.json().catch(() => ({}))).error || 'No fue posible cargar el CMS.');
      setUser((await s.json()).user);
      const data = await c.json();
      const next = data.settings || {};
      setSettings(next);
      setHeroImage(next.hero_image?.value || '');
      const nextDrafts: Record<string, string> = {};
      for (const key of Object.keys(LIST_CONFIGS)) nextDrafts[key] = next[key]?.value || JSON.stringify(LIST_DEFAULTS[key] || []);
      nextDrafts.section_visible = next.section_visible?.value || JSON.stringify(SECTION_KEYS.map(k => [k, true]));
      nextDrafts.section_order = next.section_order?.value || JSON.stringify(SECTION_KEYS);
      setDrafts(nextDrafts);
      setSectionVisible(parseSectionVisible(next.section_visible?.value));
      setSectionOrder(parseSectionOrder(next.section_order?.value));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible cargar el CMS.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    location.assign('/admin/login');
  }

  function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sectionOrder.length) return;
    const next = sectionOrder.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setSectionOrder(next);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved('');
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {};
    for (const key of Object.keys(FIELD_LABELS)) {
      if (key === 'hero_image') { payload[key] = heroImage; continue; }
      if (key === 'promo_enabled') { payload[key] = form.get('promo_enabled') === 'on' ? 'true' : 'false'; continue; }
      payload[key] = String(form.get(key) || '');
    }
    for (const key of Object.keys(drafts)) payload[key] = drafts[key];
    payload.section_visible = JSON.stringify(sectionVisible);
    payload.section_order = JSON.stringify(sectionOrder);
    try {
      const r = await fetch('/api/admin/cms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ settings: payload }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'No fue posible guardar el CMS.');
      setSaved(`${body.updated || 0} campos guardados correctamente.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible guardar el CMS.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cms-app">
      <aside className={`cms-sidebar ${mobileMenu ? 'open' : ''}`}>
        <div className="cms-brand">
          <span>C</span>
          <div><strong>Capoy</strong><small>Costa Rica</small></div>
          <button onClick={() => setMobileMenu(false)}><X size={20}/></button>
        </div>
        <nav>
          <a href="/admin"><LayoutDashboard size={18}/> Dashboard</a>
          <a href="/admin/reservas"><SlidersHorizontal size={18}/> Reservas</a>
          <a href="/admin/tours"><ImageIcon size={18}/> Tours</a>
          <a href="/admin/clientes"><Users size={18}/> Clientes</a>
          <a className="active" href="/admin/cms"><SlidersHorizontal size={18}/> Landing</a>
        </nav>
        <div className="cms-sidebar-bottom">
          <div><ShieldCheck size={16}/> Sesión protegida</div>
          {user && <p><b>{initials(user.displayName)}</b><span>{user.displayName}</span></p>}
          <button onClick={logout}><LogOut size={17}/> Cerrar sesión</button>
        </div>
      </aside>
      {mobileMenu && <button className="cms-backdrop" onClick={() => setMobileMenu(false)}/>}
      <main>
        <header className="cms-topbar">
          <div>
            <button className="cms-menu" onClick={() => setMobileMenu(true)}><Menu size={20}/></button>
            <a href="/admin"><ArrowLeft size={17}/> Administración</a>
            <span>/</span>
            <strong>Landing</strong>
          </div>
          {user && <small>{user.email}</small>}
        </header>
        <section className="cms-content">
          <div className="cms-heading">
            <div>
              <span>CONTENIDO PÚBLICO</span>
              <h1>Landing del sitio</h1>
              <p>Edita el contenido, las listas y el orden de secciones que ve el visitante sin modificar código.</p>
            </div>
            <a href="/" target="_blank" rel="noreferrer">Ver sitio público</a>
          </div>
          {loading && <div className="cms-state"><Loader2 className="spin"/> Cargando contenido real…</div>}
          {!loading && (
            <form onSubmit={save}>
              {GROUPS.map(group => (
                <section className="cms-card" key={group.title}>
                  <header><h2>{group.title}</h2>{group.list === 'hero_stats' && <ImageIcon size={20}/>}</header>
                  {group.keys && (
                    <div className="cms-grid">
                      {group.keys.map(key => (
                        <label key={key}>
                          {FIELD_LABELS[key]}
                          {key === 'hero_image' ? (
                            <HeroImageField value={heroImage} onChange={setHeroImage} />
                          ) : key === 'promo_enabled' ? (
                            <span className="cms-check">
                              <input name={key} type="checkbox" defaultChecked={settings[key]?.value === 'true'} />
                              <small>Muestra una franja compacta bajo el menú superior.</small>
                            </span>
                          ) : FIELD_TYPES[key] === 'textarea' ? (
                            <textarea name={key} rows={4} defaultValue={settings[key]?.value || ''} />
                          ) : (
                            <input name={key} type={FIELD_TYPES[key] === 'email' ? 'email' : 'text'} defaultValue={settings[key]?.value || ''} />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                  {group.list && (
                    <JsonListEditor
                      value={drafts[group.list] || JSON.stringify(LIST_DEFAULTS[group.list] || [])}
                      config={LIST_CONFIGS[group.list]}
                      onChange={(json) => setDrafts((d) => ({ ...d, [group.list]: json }))}
                    />
                  )}
                </section>
              ))}

              <section className="cms-card">
                <header><h2>Orden y visibilidad de secciones</h2><SlidersHorizontal size={20}/></header>
                <p className="cms-hint">Activa o desactiva secciones y define el orden en que aparecen en la página.</p>
                <div className="cms-section-row">
                  {sectionOrder.map((key, index) => (
                    <div className="cms-section-item" key={key}>
                      <label className="cms-section-toggle">
                        <input type="checkbox" checked={!!sectionVisible[key]} onChange={(e) => setSectionVisible(v => ({ ...v, [key]: e.target.checked }))} />
                        <span>{SECTION_LABELS[key] || key}</span>
                      </label>
                      <div className="cms-section-arrows">
                        <button type="button" disabled={index === 0} onClick={() => moveSection(index, -1)} aria-label={`Mover ${SECTION_LABELS[key]} arriba`}><ChevronUp size={16}/></button>
                        <button type="button" disabled={index === sectionOrder.length - 1} onClick={() => moveSection(index, 1)} aria-label={`Mover ${SECTION_LABELS[key]} abajo`}><ChevronDown size={16}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {error && <div className="cms-message error">{error}</div>}
              {saved && <div className="cms-message success">{saved}</div>}
              <div className="cms-actions">
                <button type="submit" disabled={saving}><Save size={17}/>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}