import { registerUserRoutes } from './users.js';
import { registerMaintenanceRoutes } from './maintenance.js';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';

// ---------------------------------------------------------------------------
// Landing content keys. Existing plain-text keys keep their previous behavior;
// the new keys extend the CMS so all public landing content is admin-editable.
// ---------------------------------------------------------------------------
const ALLOWED_KEYS = new Set([
  'hero_eyebrow','hero_title','hero_lead','hero_primary_cta','hero_secondary_cta','hero_image',
  'contact_phone','contact_email','contact_location','cta_title','cta_copy','footer_copy',
  'seo_title','seo_description','promo_text','promo_enabled',
  'tours_eyebrow','tours_title','why_eyebrow','why_title','destinations_eyebrow','destinations_title',
  'how_eyebrow','how_title','testimonials_eyebrow','testimonials_title','faq_eyebrow','faq_title',
  'hero_stats','trust_strip','why_items','destinations','how_steps','testimonials','faq_items',
  'section_visible','section_order',
]);

function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function validUrl(value) {
  if (!value) return true;
  try { const u = new URL(value); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}
function normIcon(value) { return String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32); }
function normStars(value) { return String(value ?? '').replace(/[^★☆]/g, '').slice(0, 16); }
function parseBool(value) { return value === true || value === 'true' || value === 1 || value === '1' ? 'true' : 'false'; }

// ---------------------------------------------------------------------------
// List-based content blocks
// ---------------------------------------------------------------------------
const LIST_CONFIG = {
  hero_stats:   { max: 6,  ident: 'value',    keys: ['icon', 'value', 'label', 'stars'] },
  trust_strip:  { max: 6,  ident: 'title',    keys: ['icon', 'title', 'text'] },
  why_items:    { max: 12, ident: 'title',    keys: ['icon', 'title', 'text'] },
  destinations: { max: 12, ident: 'name',     keys: ['name', 'subtitle', 'image'] },
  how_steps:    { max: 6,  ident: 'title',    keys: ['icon', 'title', 'text'] },
  testimonials: { max: 12, ident: 'quote',    keys: ['quote', 'author', 'country'] },
  faq_items:    { max: 20, ident: 'question', keys: ['question', 'answer'] },
};

function parseList(value, config) {
  if (!Array.isArray(value)) throw new Error('Debe ser una lista.');
  const rows = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = {};
    row[config.ident] = clean(item[config.ident]);
    if (!row[config.ident]) continue;
    for (const key of config.keys) {
      const raw = item[key];
      if (key === 'icon') row[key] = normIcon(raw);
      else if (key === 'stars') row[key] = normStars(raw);
      else if (key === 'image') row[key] = clean(raw, 1000);
      else row[key] = clean(raw, 500);
    }
    rows.push(row);
  }
  if (rows.length > config.max) throw new Error(`Máximo ${config.max} elementos.`);
  return rows;
}

// ---------------------------------------------------------------------------
// Section visibility + ordering
// ---------------------------------------------------------------------------
const SECTION_KEYS = ['trust', 'tours', 'why', 'destinations', 'how', 'testimonials', 'faq', 'cta'];
const SECTION_ORDER_DEFAULT = [...SECTION_KEYS];

function parseVisibleStored(value) {
  let obj = {};
  try { const v = JSON.parse(value || '{}'); if (v && typeof v === 'object' && !Array.isArray(v)) obj = v; } catch {}
  const out = {};
  for (const k of SECTION_KEYS) out[k] = obj[k] === true;
  return out;
}
function parseOrderStored(value) {
  let arr = [];
  try { const v = JSON.parse(value || '[]'); if (Array.isArray(v)) arr = v; } catch {}
  const ok = arr.filter((k) => SECTION_KEYS.includes(k));
  if (ok.length !== SECTION_KEYS.length || new Set(ok).size !== SECTION_KEYS.length) return SECTION_ORDER_DEFAULT.slice();
  return ok;
}
function parseVisible(value) {
  const obj = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = {};
  for (const k of SECTION_KEYS) out[k] = obj[k] === true;
  return out;
}
function parseOrder(value) {
  if (!Array.isArray(value)) throw new Error('El orden de secciones es inválido.');
  const onlyKnown = value.filter((k) => SECTION_KEYS.includes(k));
  if (onlyKnown.length !== SECTION_KEYS.length) throw new Error('El orden de secciones es inválido.');
  if (new Set(onlyKnown).size !== SECTION_KEYS.length) throw new Error('El orden de secciones contiene secciones repetidas.');
  return onlyKnown;
}

// ---------------------------------------------------------------------------
// Landing defaults
// ---------------------------------------------------------------------------
const DEFAULT_HERO_STATS = [
  { icon: 'Users', value: '15,000+', label: 'Viajeros felices', stars: '★★★★★' },
  { icon: 'Star', value: '4.9/5', label: 'Calificación promedio', stars: '★★★★★' },
  { icon: 'MapPin', value: '50+', label: 'Destinos increíbles', stars: '' },
];
const DEFAULT_TRUST_ITEMS = [
  { icon: 'ShieldCheck', title: 'Operador 100% local', text: 'y certificado' },
  { icon: 'Leaf', title: 'Turismo sostenible', text: 'y responsable' },
  { icon: 'Headphones', title: 'Soporte 24/7', text: 'antes y durante tu viaje' },
  { icon: 'LockKeyhole', title: 'Reservas seguras', text: 'y confirmación inmediata' },
];
const DEFAULT_WHY_ITEMS = [
  { icon: 'CalendarDays', title: 'Reservas fáciles', text: 'Reserva en minutos y recibe confirmación inmediata.' },
  { icon: 'Users', title: 'Guías locales', text: 'Expertos apasionados que conocen cada rincón.' },
  { icon: 'Headphones', title: 'Atención personalizada', text: 'Te acompañamos antes, durante y después.' },
  { icon: 'Van', title: 'Transporte confiable', text: 'Unidades cómodas y seguras con aire acondicionado.' },
  { icon: 'Leaf', title: 'Experiencias auténticas', text: 'Conexión real con la cultura, naturaleza y comunidad.' },
];
const DEFAULT_DESTINATIONS = [
  { name: 'Manuel Antonio', subtitle: 'Playas, vida silvestre y aventura', image: 'https://plus.unsplash.com/premium_photo-1661964589674-21cc0d7e345a?q=80&w=600&auto=format&fit=crop' },
  { name: 'Arenal', subtitle: 'Volcán, aguas termales y bosque tropical', image: 'https://images.unsplash.com/photo-1610932748192-06f1ee748b34?q=80&w=600&auto=format&fit=crop' },
  { name: 'Monteverde', subtitle: 'Bosque nuboso y puentes colgantes', image: 'https://images.unsplash.com/photo-1580909320993-2569d592e08a?q=80&w=600&auto=format&fit=crop' },
  { name: 'Guanacaste', subtitle: 'Sol, playas doradas y atardeceres', image: 'https://images.unsplash.com/photo-1544550285-f813152bbc2a?q=80&w=600&auto=format&fit=crop' },
  { name: 'Tortuguero', subtitle: 'Canales, naturaleza y tortugas marinas', image: 'https://images.unsplash.com/photo-1577907549794-494d8d8a6e43?q=80&w=600&auto=format&fit=crop' },
];
const DEFAULT_HOW_STEPS = [
  { icon: 'MapPin', title: 'Elige tu tour', text: 'Explora nuestras experiencias y selecciona tu favorita.' },
  { icon: 'CalendarDays', title: 'Reserva', text: 'Completa tus datos, realiza el pago y recibe confirmación.' },
  { icon: 'Camera', title: 'Disfruta', text: 'Vive una experiencia increíble y crea recuerdos inolvidables.' },
];
const DEFAULT_TESTIMONIALS = [
  { quote: 'La experiencia en La Fortuna fue increíble. Los guías súper profesionales y muy amables. 100% recomendado.', author: 'María Fernanda', country: 'México' },
  { quote: 'Todo salió perfecto, desde la reserva hasta el último detalle del tour. Capoy hizo nuestro viaje inolvidable.', author: 'Carlos Alberto', country: 'Colombia' },
  { quote: 'El catamarán al atardecer fue mágico. Paisajes hermosos, excelente servicio y mucha diversión.', author: 'Laura y Andrés', country: 'Argentina' },
];
const DEFAULT_FAQ_ITEMS = [
  { question: '¿Cómo puedo hacer una reserva?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  { question: '¿Puedo reservar un tour en otro idioma?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  { question: '¿Qué incluye el precio del tour?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  { question: '¿Cómo funcionan las reservas grupales?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  { question: '¿Qué pasa si llueve el día de mi tour?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
  { question: '¿Debo pagar por adelantado?', answer: 'Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.' },
];

const LANDING_FLAT_DEFAULTS = {
  hero_eyebrow: 'Explora',
  hero_title: 'Costa Rica<br/>como nunca<br/>antes',
  hero_lead: 'Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país.',
  hero_primary_cta: 'Ver tours',
  hero_secondary_cta: 'Planear mi viaje ✈',
  hero_image: '',
  hero_stats: JSON.stringify(DEFAULT_HERO_STATS),
  trust_strip: JSON.stringify(DEFAULT_TRUST_ITEMS),
  tours_eyebrow: '🍃 TOURS DESTACADOS',
  tours_title: 'Vive experiencias inolvidables',
  why_eyebrow: '🍃 ¿POR QUÉ ELEGIR CAPOY COSTA RICA?',
  why_title: 'Tu aventura, nuestra pasión',
  why_items: JSON.stringify(DEFAULT_WHY_ITEMS),
  destinations_eyebrow: '🍃 DESTINOS POPULARES',
  destinations_title: 'Descubre lo mejor de Costa Rica',
  destinations: JSON.stringify(DEFAULT_DESTINATIONS),
  how_eyebrow: '🍃 ¿CÓMO FUNCIONA?',
  how_title: 'Reservar tu aventura es fácil',
  how_steps: JSON.stringify(DEFAULT_HOW_STEPS),
  testimonials_eyebrow: '🍃 LO QUE DICEN NUESTROS VIAJEROS',
  testimonials_title: 'Historias reales, experiencias increíbles',
  testimonials: JSON.stringify(DEFAULT_TESTIMONIALS),
  faq_eyebrow: 'PREGUNTAS FRECUENTES',
  faq_title: 'Resolvemos tus dudas',
  faq_items: JSON.stringify(DEFAULT_FAQ_ITEMS),
  cta_title: '¿Listo para tu próxima aventura?',
  cta_copy: 'Reserva hoy y vive Costa Rica como nunca antes.<br/>Tu mejor historia comienza aquí.',
  contact_phone: '+506 8880-1234',
  contact_email: 'info@capoycostarica.com',
  contact_location: 'La Fortuna, Alajuela, Costa Rica',
  footer_copy: 'Tours locales, experiencias auténticas y recuerdos que duran para siempre.',
  promo_text: '',
  promo_enabled: 'false',
  seo_title: 'Capoy Costa Rica | Tours y experiencias auténticas',
  seo_description: 'Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país. Tours, destinos y aventuras inolvidables.',
};

function buildLandingFromFlat(flat) {
  const g = (k) => flat[k] ?? '';
  const j = (k, fallback) => {
    try { const v = JSON.parse(flat[k]); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
  };
  return {
    hero: { eyebrow: g('hero_eyebrow'), title: g('hero_title'), lead: g('hero_lead'), primaryCta: g('hero_primary_cta'), secondaryCta: g('hero_secondary_cta'), image: g('hero_image'), stats: j('hero_stats', DEFAULT_HERO_STATS) },
    trust: { items: j('trust_strip', DEFAULT_TRUST_ITEMS) },
    tours: { eyebrow: g('tours_eyebrow'), title: g('tours_title'), linkLabel: 'Ver todos los tours' },
    why: { eyebrow: g('why_eyebrow'), title: g('why_title'), items: j('why_items', DEFAULT_WHY_ITEMS) },
    destinations: { eyebrow: g('destinations_eyebrow'), title: g('destinations_title'), linkLabel: 'Ver todos los destinos', items: j('destinations', DEFAULT_DESTINATIONS) },
    how: { eyebrow: g('how_eyebrow'), title: g('how_title'), steps: j('how_steps', DEFAULT_HOW_STEPS) },
    testimonials: { eyebrow: g('testimonials_eyebrow'), title: g('testimonials_title'), items: j('testimonials', DEFAULT_TESTIMONIALS) },
    faq: { eyebrow: g('faq_eyebrow'), title: g('faq_title'), items: j('faq_items', DEFAULT_FAQ_ITEMS) },
    cta: { title: g('cta_title'), copy: g('cta_copy') },
    contact: { phone: g('contact_phone'), email: g('contact_email'), location: g('contact_location') },
    footer: { copy: g('footer_copy') },
    promo: { enabled: g('promo_enabled') === 'true', text: g('promo_text') },
    sections: { visible: parseVisibleStored(g('section_visible')), order: parseOrderStored(g('section_order')) },
    seo: { title: g('seo_title'), description: g('seo_description') },
  };
}

function validateCmsValue(key, raw) {
  if (key === 'hero_stats') return JSON.stringify(parseList(raw, LIST_CONFIG.hero_stats));
  if (key === 'trust_strip') return JSON.stringify(parseList(raw, LIST_CONFIG.trust_strip));
  if (key === 'why_items') return JSON.stringify(parseList(raw, LIST_CONFIG.why_items));
  if (key === 'destinations') return JSON.stringify(parseList(raw, LIST_CONFIG.destinations));
  if (key === 'how_steps') return JSON.stringify(parseList(raw, LIST_CONFIG.how_steps));
  if (key === 'testimonials') return JSON.stringify(parseList(raw, LIST_CONFIG.testimonials));
  if (key === 'faq_items') return JSON.stringify(parseList(raw, LIST_CONFIG.faq_items));
  if (key === 'section_visible') return JSON.stringify(parseVisible(raw));
  if (key === 'section_order') return JSON.stringify(parseOrder(raw));
  if (key === 'promo_enabled') return parseBool(raw);
  const value = clean(raw, key === 'hero_image' ? 1000 : 500);
  if (key === 'hero_title' && value.length < 3) throw new Error('Título principal inválido.');
  if (key === 'hero_lead' && value.length < 5) throw new Error('Texto principal inválido.');
  if (key === 'contact_email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Correo de contacto inválido.');
  if (key === 'hero_image' && !validUrl(value)) throw new Error('URL de imagen inválida.');
  return value;
}

const HERO_DIR = path.join(process.cwd(), 'uploads', 'cms', 'hero');
fs.mkdirSync(HERO_DIR, { recursive: true });

const heroUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, HERO_DIR),
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname).toLowerCase().match(/\.(jpe?g|png|webp|gif)$/) || ['.jpg'])[0];
      cb(null, `hero-${crypto.randomBytes(6).toString('hex')}-${Date.now().toString(36)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(new Error('Solo imágenes (JPEG, PNG, WebP, GIF).'));
    }
    cb(null, true);
  },
});

export function registerCmsRoutes({ app, pool, requireSession, sameOriginOnly, audit }) {
  registerUserRoutes({ app, pool, requireSession, sameOriginOnly, audit });
  registerMaintenanceRoutes({ app, pool, requireSession, sameOriginOnly, audit });

  app.get('/api/public/cms', async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT setting_key,setting_value FROM cms_settings');
      const settings = {};
      for (const row of rows) settings[row.setting_key] = row.setting_value;
      res.json({ ok: true, settings });
    } catch (error) {
      console.error('cms_public_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar el contenido público.' });
    }
  });

  app.get('/api/public/landing', async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT setting_key,setting_value FROM cms_settings');
      const flat = { ...LANDING_FLAT_DEFAULTS };
      for (const row of rows) {
        if (flat[row.setting_key] !== undefined) flat[row.setting_key] = row.setting_value;
      }
      res.json({ ok: true, landing: buildLandingFromFlat(flat) });
    } catch (error) {
      console.error('landing_public_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar el contenido de la landing.' });
    }
  });

  app.get('/api/admin/cms', requireSession, async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT setting_key,setting_value,updated_at FROM cms_settings ORDER BY setting_key');
      const settings = {};
      for (const row of rows) settings[row.setting_key] = { value: row.setting_value, updatedAt: row.updated_at };
      res.json({ ok: true, settings });
    } catch (error) {
      console.error('cms_admin_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar el CMS.' });
    }
  });

  // Upload hero image (multipart, owner only). Returns the public URL to paste into hero_image.
  app.post('/api/admin/cms/hero-image/upload', sameOriginOnly, requireSession, heroUpload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    const url = `/uploads/cms/hero/${req.file.filename}`;
    await audit(req, 'cms_hero_image_uploaded', { userId: req.admin.id, email: req.admin.email, metadata: { filename: req.file.filename } });
    res.json({ ok: true, url, filename: req.file.filename });
  });

  app.patch('/api/admin/cms', sameOriginOnly, requireSession, async (req, res) => {
    const incoming = req.body?.settings;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return res.status(400).json({ error: 'Configuración CMS inválida.' });
    const entries = [];
    for (const [key, raw] of Object.entries(incoming)) {
      if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: `Campo CMS no permitido: ${key}` });
      try {
        entries.push([key, validateCmsValue(key, raw)]);
      } catch (error) {
        return res.status(400).json({ error: error.message, key });
      }
    }
    if (!entries.length) return res.status(400).json({ error: 'No hay cambios para guardar.' });
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const [key, value] of entries) {
        await conn.execute(
          'INSERT INTO cms_settings (setting_key,setting_value,updated_by_admin_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by_admin_id=VALUES(updated_by_admin_id)',
          [key, value, req.admin.id]
        );
      }
      await conn.commit();
      await audit(req, 'cms_updated', { userId: req.admin.id, email: req.admin.email, metadata: { keys: entries.map(([key]) => key) } });
      res.json({ ok: true, updated: entries.length });
    } catch (error) {
      await conn.rollback();
      console.error('cms_update_failed', error.message);
      res.status(503).json({ error: 'No fue posible guardar el CMS.' });
    } finally {
      conn.release();
    }
  });
}