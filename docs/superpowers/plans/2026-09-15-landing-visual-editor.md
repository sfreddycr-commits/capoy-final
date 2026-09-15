# Landing Visual Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `header + hero + trust_strip` del landing público en componentes editables visualmente por el PO desde `Dashboard → Landing`, con drag & drop, edición de texto, show/hide, fondo, 3 breakpoints, draft/publish, undo/redo e historial.

**Architecture:** DB-first (`landing_components` por breakpoint) + endpoint público nuevo `/api/public/landing/page` detrás de feature flag + editor React con iframe + overlay DnD + inspector + toolbar. Sin tocar las secciones por debajo del trust_strip en esta iteración.

**Tech Stack:** Node 20, Express, mysql2, multer, React 18, Vite, vanilla CSS modules. Tests vía Playwright MCP (no se añade framework).

**Spec:** `docs/superpowers/specs/2026-09-15-landing-visual-editor-design.md`

## Global Constraints

- Solo el rol `owner` (admin_users.role='owner') entra al editor. Otros administradores ven read-only.
- Feature flag `LANDING_USE_COMPONENTS` controla el cut-over público (default `false`; flip a `true` sólo en H7).
- Slots protegidos (logo, login_btn, reserve_btn) no se pueden ocultar, sólo mover. `protected=1` se almacena en `props_json.protected`.
- Toda imagen subida ≤ 8 MB, whitelist JPEG/PNG/WebP (magic bytes verificados).
- Idioma del editor: español.
- Stack puro del repo: nada de React DnD, Framer Motion ni libs externas para DnD — pointer events nativos.
- No se rediseña el look actual. El seed inicial reproduce 1:1 el hero/header/trust actual.
- Deploys incrementales. El landing público permanece estable (con flag `false`) durante TODO el desarrollo.

---

## Phase 1 — Data foundation

### Task 1: Migration `0017_landing_components.sql` + role column + seed

**Files:**
- Create: `migrations/0017_landing_components.sql`
- Apply via: `docker exec capoy-final-6wsges.1.qm5u3jy0bed2bzqpme3doxf0w sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" capoy_final < /tmp/0017.sql'`

**Interfaces:**
- Consumes: existing DB `admin_users`, `cms_settings` (no los toca)
- Produces: `admin_users.role`, `landing_components` con seed para `header + hero + trust_strip`

- [ ] **Step 1: Write the SQL file** with schema, role column, protected slots list, and seed INSERTs

```sql
-- migrations/0017_landing_components.sql
-- 1) Role en admin_users
ALTER TABLE admin_users
  ADD COLUMN role ENUM('owner','staff') NOT NULL DEFAULT 'staff' AFTER status;
UPDATE admin_users SET role='owner' WHERE id=1;

-- 2) Tabla de componentes
CREATE TABLE IF NOT EXISTS landing_components (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  site_section ENUM('header','hero','trust_strip') NOT NULL,
  slot VARCHAR(64) NOT NULL,
  breakpoint ENUM('desktop','tablet','mobile') NOT NULL,
  pos_x INT NOT NULL DEFAULT 0,
  pos_y INT NOT NULL DEFAULT 0,
  width INT NULL,
  height INT NULL,
  z_index INT NOT NULL DEFAULT 1,
  hidden TINYINT(1) NOT NULL DEFAULT 0,
  props_json JSON NOT NULL,
  draft_props_json JSON NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL,
  UNIQUE KEY uniq_slot_bp (site_section, slot, breakpoint),
  KEY idx_section (site_section, slot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Historial de publicaciones
CREATE TABLE IF NOT EXISTS landing_versions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  site_section ENUM('header','hero','trust_strip') NOT NULL,
  snapshot_json JSON NOT NULL,
  published_by BIGINT UNSIGNED NULL,
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_section_time (site_section, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Seed inicial header + hero + trust_strip × 3 breakpoints.
--    Posiciones taken from current landing CSS (seed reproduce el look 1:1).
--    Para mantener el plan manejable, este seed se genera en Task 2 aparte.
```

- [ ] **Step 2: Apply migration to production DB**

```bash
cd /etc/dokploy/applications/capoy-final-ilvlxb/code
docker cp migrations/0017_landing_components.sql capoy-final-6wsges.1.qm5u3jy0bed2bzqpme3doxf0w:/tmp/0017.sql
docker exec capoy-final-6wsges.1.qm5u3jy0bed2bzqpme3doxf0w sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" capoy_final < /tmp/0017.sql'
```

- [ ] **Step 3: Verify schema**

```bash
docker exec capoy-final-6wsges.1.qm5u3jy0bed2bzqpme3doxf0w sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" capoy_final -e "SHOW TABLES LIKE \"landing_%\"; DESC landing_components; SELECT role, COUNT(*) FROM admin_users GROUP BY role;"'
```

Expected: tables created, role=owner for id=1.

- [ ] **Step 4: Commit**

```bash
git add migrations/0017_landing_components.sql
git commit -m "feat(landing): migration 0017 — landing_components + role column"
```

---

### Task 2: Seed initial components (1:1 con hero/header/trust actual)

**Files:**
- Create: `migrations/0017b_landing_components_seed.sql`
- Apply: mismo flujo Task 1

**Interfaces:**
- Consumes: `landing_components` schema from Task 1
- Produces: 3 rows por slot (desktop/tablet/mobile) por cada componente editable

- [ ] **Step 1: Generate seed file** con datos del hero/header/trust actuales.

Tres macros a usar para evitar 60+ INSERTs:
```sql
-- Helper: cada slot × breakpoint
-- x, y, w, h en px; pos_y relativo al inicio de su sección.
INSERT INTO landing_components (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json) VALUES
('header','logo','desktop',40,16,180,40,10,0,'{"text":"Capoy Tours","href":"/","src":"/uploads/company/logo.png","alt":"Capoy Tours Costa Rica","protected":true}'),
('header','logo','tablet',24,12,160,36,10,0,'{"text":"Capoy Tours","href":"/","src":"/uploads/company/logo.png","alt":"Capoy Tours Costa Rica","protected":true}'),
('header','logo','mobile',16,10,140,32,10,0,'{"text":"Capoy Tours","href":"/","src":"/uploads/company/logo.png","alt":"Capoy Tours Costa Rica","protected":true}'),
-- ... idem para menu_link:inicio, tours, destinos, faq, contacto,
-- login_btn, phone, reserve_btn
('hero','bg_image','desktop',0,0,1440,720,0,0,'{"src":"https://images.unsplash.com/photo-1516690561799-46d8f74f9abf","alt":"Costa Rica"}'),
-- ... idem eyebrow, title, lead, cta_primary, cta_secondary × 3 breakpoints
('trust_strip','item:1','desktop',0,0,360,80,1,0,'{"icon":"ShieldCheck","title":"Operador 100% local","text":"y certificado"}'),
-- ... idem items 2/3/4 × 3 breakpoints
;
```

El archivo completo es largo pero estructurado. Generar a partir de screenshot + DOM actual.

- [ ] **Step 2: Apply seed**

```bash
docker cp migrations/0017b_landing_components_seed.sql capoy-final-6wsges.1.qm5u3jy0bed2bzqpme3doxf0w:/tmp/0017b.sql
docker exec capoy-final-6wsges.1.qm5u3jy0bed2bzqpme3doxf0w sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" capoy_final < /tmp/0017b.sql'
```

- [ ] **Step 3: Verify count**

```bash
docker exec capoy-final-6wsges.1.qm5u3jy0bed2bzqpme3doxf0w sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" capoy_final -e "SELECT site_section, breakpoint, COUNT(*) FROM landing_components GROUP BY site_section, breakpoint;"'
```

Expected: header/desktop=8, header/tablet=8, header/mobile=8, hero (×3)=18, trust_strip (×3×4)=36 → total ~78 rows.

- [ ] **Step 4: Commit**

```bash
git add migrations/0017b_landing_components_seed.sql
git commit -m "feat(landing): seed initial components (1:1 hero+header+trust)"
```

---

## Phase 2 — Renderer (read path)

### Task 3: Feature flag + GET `/api/public/landing/page`

**Files:**
- Create: `server/landing.js`
- Modify: `server/index.js` (register route)

**Interfaces:**
- Consumes: `landing_components`, env `LANDING_USE_COMPONENTS`
- Produces: `GET /api/public/landing/page` → `{ sections: { header:{ desktop:[…], tablet:[…], mobile:[…] }, hero:{...}, trust_strip:{...} } }`

- [ ] **Step 1: Write the endpoint module** `server/landing.js`

```js
import { pool } from './index.js'; // o crear pool local
export function registerLandingRoutes({ app }) {
  app.get('/api/public/landing/page', async (_req, res) => {
    try {
      if (process.env.LANDING_USE_COMPONENTS !== 'true') {
        return res.status(503).json({ error: 'Feature flag disabled' });
      }
      const [rows] = await pool.query(
        'SELECT id, site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json ' +
        'FROM landing_components ORDER BY site_section, breakpoint, slot'
      );
      const sections = { header: { desktop:[], tablet:[], mobile:[] }, hero: { desktop:[], tablet:[], mobile:[] }, trust_strip: { desktop:[], tablet:[], mobile:[] } };
      for (const r of rows) {
        const v = typeof r.props_json === 'string' ? JSON.parse(r.props_json) : r.props_json;
        sections[r.site_section][r.breakpoint].push({
          id: r.id, slot: r.slot,
          position: { x: r.pos_x, y: r.pos_y, w: r.width, h: r.height, z: r.z_index },
          hidden: !!r.hidden,
          props: v,
        });
      }
      res.json({ ok: true, sections, flag: true });
    } catch (e) {
      console.error('landing_page_failed', e.message);
      res.status(503).json({ error: 'No fue posible cargar los componentes.' });
    }
  });
}
```

- [ ] **Step 2: Wire to server/index.js**

```js
import { registerLandingRoutes } from './landing.js';
// ...
registerLandingRoutes({ app });
```

- [ ] **Step 3: Manual smoke test** (flag off → 503):

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://capoycostarica.com/api/public/landing/page
# Expected: 503
```

- [ ] **Step 4: Toggle flag on via env, restart, verify endpoint shape**:

```bash
# Local: LANDING_USE_COMPONENTS=true npm start
curl -sk https://capoycostarica.com/api/public/landing/page | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['sections']['hero']['desktop'][0])"
```

Expected: 1 hero component with position { x:0, y:0, w:1440, h:720, z:0 } and props.

- [ ] **Step 5: Commit**

```bash
git add server/landing.js server/index.js
git commit -m "feat(landing): public endpoint /api/public/landing/page with feature flag"
```

---

### Task 4: `PublicLanding.tsx` renderiza componentes (cuando flag activo)

**Files:**
- Modify: `src/PublicLanding.tsx`

**Interfaces:**
- Consumes: `GET /api/public/landing/page` + window.matchMedia para bp
- Produces: DOM público con componentes posicionados absolutamente

- [ ] **Step 1: Edit `src/PublicLanding.tsx`** — agregar lectura dual:

```tsx
// Dentro del componente:
const [comps, setComps] = useState(null);
useEffect(() => {
  fetch('/api/public/landing/page').then(r => r.ok ? r.json() : null).then(j => j?.sections ? setComps(j.sections) : null);
}, []);

if (comps) return <LandingComponentsView sections={comps} />;
// sino, sigue con render actual
```

- [ ] **Step 2: Implementar `LandingComponentsView`** dentro del mismo archivo (mismo export o sub-componente local):

```tsx
function pickBp(sections, w) {
  if (w < 600) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}
function LandingComponentsView({ sections }) {
  const [bp, setBp] = useState(pickBp(sections, window.innerWidth));
  useEffect(() => {
    const onR = () => setBp(pickBp(sections, window.innerWidth));
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [sections]);
  // Render tres secciones con position:relative. Cada componente absolute.
  return (
    <div className="landing-components-root">
      {Object.entries(sections).map(([secName, byBp]) => (
        <section key={secName} id={secName} className={`landing-section landing-section--${secName}`}>
          {byBp[bp].filter(c => !c.hidden).map(c => (
            <div key={c.id}
                 data-cmp={c.slot}
                 data-section={secName}
                 style={{ position:'absolute', left:c.position.x, top:c.position.y, width:c.position.w||'auto', height:c.position.h||'auto', zIndex:c.position.z }}>
              {/* Render texto/imagen/botón según c.slot */}
              {renderSlot(c)}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
```

`renderSlot(c)` switch por prefijo de slot (`header.menu_link:*` → `<a>`, `hero.title` → `<h1>`, `trust_strip.item:*` → bloque con icono+title+text, etc.). Implementar el switch.

- [ ] **Step 3: Adjust CSS** (`src/styles.css`) — dar position:relative a `.landing-section` y alto mínimo basado en seed.

- [ ] **Step 4: Visual QA con flag ON en local**:

```bash
LANDING_USE_COMPONENTS=true npm run dev
# Playwright: snapshot 1440 + 390, comparar con landing actual
```

- [ ] **Step 5: Commit**

```bash
git add src/PublicLanding.tsx src/styles.css
git commit -m "feat(landing): PublicLanding reads /api/public/landing/page when flag on"
```

---

### Task 5: Pixel-parity snapshot antes del cut-over (referencia)

**Files:** ninguno (herramienta)

- [ ] **Step 1: Capturar baseline screenshots del landing actual** (flag off):

```bash
# Resolución 1440 + 390 + 820
mkdir -p /root/workspace/capoycr-plus/landing-baseline
playwright_browser_navigate https://capoycostarica.com/
playwright_browser_take_screenshot landing-desktop-pre.png
playwright_browser_resize 820 1180
playwright_browser_take_screenshot landing-tablet-pre.png
playwright_browser_resize 390 844
playwright_browser_take_screenshot landing-mobile-pre.png
```

Guardar como referencia `landing-{bp}-pre.png` para comparar después del flag ON. Guardar también `landing-{bp}-post.png` cuando se active.

No es git-commit. Es artefacto local de control de calidad.

---

## Phase 3 — Editor core

### Task 6: `requireOwner` middleware + extender sesión

**Files:**
- Modify: `server/index.js` (función `requireSession` extender con role; nuevo `requireOwner`)
- Modify: `GET /api/auth/session` para devolver role

- [ ] **Step 1: Patch `requireSession`** para incluir `req.user.role`:

```js
req.user = { id: session.id, email: session.email, role: session.role };
```

- [ ] **Step 2: Add `requireOwner`** que verifique `req.user.role === 'owner'`:

```js
export function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autenticado.' });
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Sólo el Global Admin puede modificar el landing.' });
  next();
}
```

- [ ] **Step 3: Update `/api/auth/session`** para devolver role:

```js
res.json({ ok:true, user:{ id:session.id, email:session.email, role:session.role, mustChangePassword:false } });
```

- [ ] **Step 4: Manual test**: entrar como owner (sesión actual) y como un admin staff creado ad-hoc con curl → role=staff → debe obtener 403 en endpoints guarded.

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat(auth): requireOwner middleware + role in session response"
```

---

### Task 7: CRUD API `/api/admin/landing/*`

**Files:**
- Modify: `server/landing.js`

**Interfaces:**
- `GET /api/admin/landing/components` → lista todo (con drafts)
- `PUT /api/admin/landing/components/:id` body `{ pos_x?, pos_y?, width?, height?, z_index?, hidden?, props? }`
- `POST /api/admin/landing/components/:id/draft` body `{ draft: { props?, hidden?, position? } }` — actualiza `draft_props_json`
- `POST /api/admin/landing/publish` → copia drafts a props_json, snapshot en landing_versions, published_at NOW
- `GET /api/admin/landing/history` → últimas 50 versiones
- `POST /api/admin/landing/restore/:versionId` → publica snapshot

- [ ] **Step 1: Add endpoints** con validación de role en TODAS las rutas excepto `/api/public/landing/page`.

- [ ] **Step 2: Publish flow**:

```js
app.post('/api/admin/landing/publish', requireOwner, async (req, res) => {
  // Transacción: para cada componente con draft no-null,
  //   UPDATE props_json = draft_props_json, draft=NULL, published_at=NOW()
  //   INSERT en landing_versions (site_section, snapshot_json, published_by)
  await conn.beginTransaction();
  // ...
  await conn.commit();
});
```

- [ ] **Step 3: Manual smoke**:

```bash
# GET componentes
curl -sk -b 'capoy_admin_session=...' https://capoycostarica.com/api/admin/landing/components | python3 -m json.tool | head -40
```

- [ ] **Step 4: Commit**

```bash
git add server/landing.js
git commit -m "feat(landing): CRUD + publish + history endpoints (owner only)"
```

---

### Task 8: Upload endpoint

**Files:**
- Modify: `server/landing.js`

- [ ] **Step 1: Add multer** con filtro mime + magic bytes + cap 8 MB:

```js
const landingUpload = multer({
  storage: multer.diskStorage({ destination: 'uploads/landing', filename: (req,file,cb)=>cb(null, `${file.fieldname}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${path.extname(file.originalname)}`) }),
  limits: { fileSize: 8*1024*1024 },
  fileFilter: (req, file, cb) => {
    if (!/image\/(jpeg|png|webp)/.test(file.mimetype)) return cb(new Error('Sólo imágenes (JPEG/PNG/WebP)'));
    cb(null, true);
  }
});
```

- [ ] **Step 2: Magic byte check post-upload** antes de persistir:

```js
const buf = await fs.promises.readFile(path.join('uploads/landing', req.file.filename));
const isImg = (buf[0]===0xFF && buf[1]===0xD8) || (buf[0]===0x89 && buf[1]===0x50) || (buf[0]===0x52 && buf[1]===0x49);
if (!isImg) { await fs.promises.unlink(path); return res.status(400).json({error:'Archivo inválido'}); }
```

- [ ] **Step 3: Endpoint `/api/admin/landing/components/:id/upload`** actualiza `props_json.src`.

- [ ] **Step 4: Static serve uploads/landing**: verificar que `/uploads/*` estático en `server/index.js:661` ya cubre este path.

- [ ] **Step 5: Commit**

```bash
git add server/landing.js
git commit -m "feat(landing): image upload with magic-byte validation, 8MB cap"
```

---

### Task 9: Frontend route + page shell

**Files:**
- Create: `src/LandingEditor.tsx`
- Create: `src/api/landing.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/api/landing.ts`** con helpers (`listComponents`, `updateComponent`, `saveDraft`, `publish`, `history`, `restore`, `upload`, `revert`).

- [ ] **Step 2: Create `src/LandingEditor.tsx`** shell:

```tsx
export default function LandingEditor() {
  const [user, setUser] = useState(null);
  useEffect(() => { fetch('/api/auth/session').then(r=>r.json()).then(j=>setUser(j.user)).catch(()=>{}); }, []);
  if (!user) return <p>Cargando…</p>;
  if (user.role !== 'owner') return <p>Esta sección es sólo para el Global Admin.</p>;
  return <LandingEditorInner />;
}
```

`LandingEditorInner` arma el layout 3 columnas.

- [ ] **Step 3: Register route** en `src/main.tsx`:

```tsx
<Route path="/admin/landing-editor" element={<RequireAdmin><LandingEditor /></RequireAdmin>} />
```

- [ ] **Step 4: Add tab/button en Dashboard** `src/DashboardNav.tsx` (si existe) que apunte a `/admin/landing-editor`.

- [ ] **Step 5: Commit**

```bash
git add src/LandingEditor.tsx src/api/landing.ts src/main.tsx
git commit -m "feat(landing): /admin/landing-editor route + page shell with owner gate"
```

---

### Task 10: Canvas con iframe + overlay + click-to-select

**Files:**
- Create: `src/LandingEditorCanvas.tsx`
- Create: `src/styles/landing-editor.css`

- [ ] **Step 1: Iframe apunta a `/?editor=1`** (query param para que `PublicLanding` marque `data-cmp-*` y omita analytics etc.).

- [ ] **Step 2: Overlay recibe clicks** vía `postMessage` desde iframe:

```js
window.addEventListener('message', e => {
  if (e.data?.type === 'cmp:click') onSelect(e.data.id);
});
```

En `PublicLanding` agregar handler de click:

```js
document.addEventListener('click', (e) => {
  const node = e.target.closest('[data-cmp]');
  if (node) {
    const id = node.getAttribute('data-cmp-id');
    parent.postMessage({ type:'cmp:click', id }, '*');
    e.preventDefault();
  }
}, true);
```

- [ ] **Step 3: Outline del seleccionado** vía `data-cmp-selected="true"` en iframe (enviado vía `postMessage` + iframe.contentDocument).

- [ ] **Step 4: Commit**

```bash
git add src/LandingEditorCanvas.tsx src/PublicLanding.tsx src/styles/landing-editor.css
git commit -m "feat(landing): canvas with iframe overlay + click-to-select"
```

---

### Task 11: Inspector + auto-save

**Files:**
- Create: `src/LandingEditorInspector.tsx`

- [ ] **Step 1: Form fields based on slot type**:
  - Generic text slot (`hero.title`): input type=text (props.text)
  - Hero CTA (`hero.cta_primary`): text, href, color
  - Trust item (`trust_strip.item:*`): icon picker, title, text
  - Image slot (`hero.bg_image`): "Cambiar imagen" button
  - Hidden toggle: switch ON/OFF (deshabilitado si protected)

- [ ] **Step 2: Debounced auto-save** (800 ms):

```ts
const debouncedSave = useMemo(() =>
  debounce((payload) => api.saveDraft(selectedId, payload), 800), [selectedId]);
```

- [ ] **Step 3: Vista en vivo mientras edita**: el canvas re-renderiza al cambiar draft (sin esperar publish).

- [ ] **Step 4: Commit**

```bash
git add src/LandingEditorInspector.tsx
git commit -m "feat(landing): inspector panel with debounced auto-save"
```

---

### Task 12: Drag & drop en canvas

**Files:**
- Modify: `src/LandingEditorCanvas.tsx`

- [ ] **Step 1: pointerdown en elemento seleccionado** → drag mode. Captura posición mouse; calcula delta; actualiza `pos_x/pos_y` local.

- [ ] **Step 2: pointerup → PUT optimistica** con `pos_x, pos_y` finales; on success refrescar.

- [ ] **Step 3: Mostrar tape** mientras arrastra (líneas guía 0px, ±50px, ±100px).

- [ ] **Step 4: Commit**

```bash
git add src/LandingEditorCanvas.tsx
git commit -m "feat(landing): drag-and-drop for component positions"
```

---

### Task 13: Toolbar — Draft / Preview / Publish / Estado

**Files:**
- Create: `src/LandingEditorToolbar.tsx`

- [ ] **Step 1: Indicador de estado**: "Borrador sin publicar" / "Publicado hace 3 min".

- [ ] **Step 2: Botones**:
  - **Vista previa** → `window.open('/?preview=landing&bp=desktop&draft=1', '_blank')` (endpoint público con draft flag — fuera de scope inicial; v1 sólo publica para preview).
  - **Publicar** → POST /api/admin/landing/publish; loading + toast.

- [ ] **Step 3: Confirm modal antes de publicar** ("Vas a reemplazar el landing público. ¿Continuar?").

- [ ] **Step 4: Commit**

```bash
git add src/LandingEditorToolbar.tsx
git commit -m "feat(landing): toolbar with publish + draft indicator"
```

---

## Phase 4 — Imagen + estilos

### Task 14: Image upload UI

**Files:**
- Modify: `src/LandingEditorInspector.tsx`

- [ ] **Step 1: "Cambiar imagen"** en slots de tipo image (e.g. `hero.bg_image`, `header.logo.src`).

- [ ] **Step 2: Input file → FormData → POST upload → refresca props.src.

- [ ] **Step 3: Mostrar preview inmediata** con src retornado.

- [ ] **Step 4: Commit**

```bash
git add src/LandingEditorInspector.tsx
git commit -m "feat(landing): image upload UI in inspector"
```

---

### Task 15: Style panel (color, font, weight, size, radius)

**Files:**
- Modify: `src/LandingEditorInspector.tsx`

- [ ] **Step 1: Sección "Estilo"** con campos por slot:
  - Color (hex picker): `props.style.color`
  - Background: `props.style.background`
  - Font size: `props.style.fontSize` (px)
  - Weight: select 300/400/500/600/700
  - Border radius: `props.style.borderRadius` (px)
  - Padding: `props.style.padding` (px)
  - Margin: `props.style.margin` (px)

- [ ] **Step 2: Apply via inline style** en `renderSlot()` de `PublicLanding`.

- [ ] **Step 3: Commit**

```bash
git add src/LandingEditorInspector.tsx src/PublicLanding.tsx
git commit -m "feat(landing): style panel + inline style application in renderer"
```

---

## Phase 5 — Breakpoints

### Task 16: Breakpoint switcher (Desktop / Tablet / Mobile)

**Files:**
- Modify: `src/LandingEditorToolbar.tsx`, `src/LandingEditorCanvas.tsx`

- [ ] **Step 1: Buttons de bp en toolbar**, estado global `currentBp`.

- [ ] **Step 2: Canvas resize**: ancho iframe cambia a 1440 (D) / 820 (T) / 390 (M).

- [ ] **Step 3: Cada bp tiene sus propias posiciones**: `PUT` y drag deben ir al `id` del row con `breakpoint=currentBp`. La API ya lo distingue por id.

- [ ] **Step 4: Visual diff entre bps** vía dot indicator "Modificado en Desktop pero no en Mobile".

- [ ] **Step 5: Commit**

```bash
git add src/LandingEditorToolbar.tsx src/LandingEditorCanvas.tsx
git commit -m "feat(landing): breakpoint switcher with per-bp positions"
```

---

## Phase 6 — UX polish

### Task 17: Precision arrows (1/5/10 px) + arrow keys

**Files:**
- Modify: `src/LandingEditorInspector.tsx`, `src/LandingEditorCanvas.tsx`

- [ ] **Step 1: Inspector section "Posición"**: X/Y numéricos + botones `← 1` `← 5` `← 10`.

- [ ] **Step 2: Arrow keys** cuando hay elemento seleccionado: ←↑→↓ = 1px; Shift+arrow = 10px.

- [ ] **Step 3: Commit**

```bash
git add src/LandingEditorInspector.tsx src/LandingEditorCanvas.tsx
git commit -m "feat(landing): precision arrow keys + nudge buttons"
```

---

### Task 18: Undo/Redo (client stack)

**Files:**
- Modify: `src/LandingEditor.tsx`

- [ ] **Step 1: Stack `past[]`, `future[]`**. Cada cambio local pushea snapshot a past y limpia future.

- [ ] **Step 2: Ctrl+Z / Ctrl+Y keyboard shortcuts**.

- [ ] **Step 3: Botones en toolbar** (Undo/Redo con enable state).

- [ ] **Step 4: Persistir drafts en backend** (ya hecho en Task 7/11); undo no llama API, sólo revierte local; al volver a editar, debounced save actualiza draft en backend.

- [ ] **Step 5: Commit**

```bash
git add src/LandingEditor.tsx src/LandingEditorToolbar.tsx
git commit -m "feat(landing): client-side undo/redo with keyboard shortcuts"
```

---

### Task 19: History dropdown + restore

**Files:**
- Modify: `src/LandingEditorToolbar.tsx`

- [ ] **Step 1: GET history al abrir dropdown**.

- [ ] **Step 2: Lista de versiones** (timestamp + autor).

- [ ] **Step 3: Click "Restaurar"** → POST /restore/:id → refresh.

- [ ] **Step 4: Confirm modal**.

- [ ] **Step 5: Commit**

```bash
git add src/LandingEditorToolbar.tsx
git commit -m "feat(landing): history dropdown + restore"
```

---

## Phase 7 — Security + QA + flip flag

### Task 20: Playwright E2E suite (manual pero sistemática)

**Files:** ninguno (se ejecuta vía MCP).

- [ ] **Step 1: Login como owner** (cookie en /tmp/opencode/owner-cookie).

- [ ] **Step 2: E2E flujo crítico** (Playwright script):
  1. Navigate /admin/landing-editor.
  2. Click `hero.title` en canvas → inspector muestra "Costa Rica como nunca antes".
  3. Drag `hero.title` +50px Y → PUT 200; DB pos_y++; refresh canvas OK.
  4. Edit text a "Costa Rica mágico" → draft save → canvas preview muestra texto nuevo (no público aún).
  5. Click Publicar → modal confirm → POST publish 200 → toast OK.
  6. Recargar /admin/landing-editor → ver elementos con valores publicados.
  7. Cargar https://capoycostarica.com/ (con flag ON) → ver texto "Costa Rica mágico" en hero.
  8. Click en show/hide de `trust_strip.item:2` → OFF → canvas desaparece → Publicar → https://capoycostarica.com no muestra ese item.
  9. Click "Cambiar imagen" en `hero.bg_image` → upload JPEG sample → src actualizado.
  10. Ctrl+Z 3 veces → canvas revierte cambios locales.
  11. Switch bp Tablet → ver canvas 820; posiciones distintas guardadas.

- [ ] **Step 3: Test de permisos**:
  - Login como admin staff (crear uno en sesión DB si no existe) → /admin/landing-editor → banner "Sólo Global Admin" + read-only.
  - PUT con cookie staff → 403.

- [ ] **Step 4: Documentar resultados** en `/root/workspace/capoycr-plus/landing-editor-qa-report.md`.

No commit (artefacto QA).

---

### Task 21: Compare baselines (pre vs post)

- [ ] **Step 1: Con flag ON, capturar `landing-{bp}-post.png`** con mismas dimensiones que `landing-{bp}-pre.png`.

- [ ] **Step 2: Diff visual**:
  - Hero title sigue "Costa Rica como nunca antes" (look 1:1).
  - Trust strip 4 items en mismo orden.
  - Header completo.

Si hay drift no aceptable (>5% de elementos desplazados visiblemente), volver a seed y re-tunear Task 2 antes de promover.

---

### Task 22: Flip flag en producción + observabilidad

- [ ] **Step 1: En Dokploy UI**, agregar env `LANDING_USE_COMPONENTS=true` a la app `nbE576K2iZGSFswd20loT`. Redeploy.

- [ ] **Step 2: Verificar logs** post-deploy (sin errores 5xx).

- [ ] **Step 3: Snapshot** Playwright del landing público → confirmar render correcto.

- [ ] **Step 4: Reporte final al PO** con todo PASS/FAIL según criterios de aceptación.

---

### Task 23: Rollback plan documentado

- [ ] **Step 1: README breve** en `docs/superpowers/2026-09-15-landing-editor-rollback.md` que explique cómo volver al render anterior (set flag false; los datos en `landing_components` quedan intactos para revertir).

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/2026-09-15-landing-editor-rollback.md
git commit -m "docs(landing): rollback procedure for visual editor"
```

---

## Resumen de tareas

| # | Fase | Entregable | Riesgo |
|---|---|---|---|
| 1 | Data | Migración schema + role | Bajo |
| 2 | Data | Seed inicial 1:1 | Medio (drift visual) |
| 3 | Renderer | GET público + flag | Bajo |
| 4 | Renderer | PublicLanding usa componentes | Medio |
| 5 | QA | Baseline screenshots | Bajo |
| 6 | Auth | requireOwner | Bajo |
| 7 | API | CRUD + publish + history | Bajo |
| 8 | API | Upload imágenes | Medio (security) |
| 9 | Editor | Route + shell | Bajo |
| 10 | Editor | Canvas + click | Medio |
| 11 | Editor | Inspector + auto-save | Bajo |
| 12 | Editor | Drag & drop | Medio |
| 13 | Editor | Toolbar + publish | Bajo |
| 14 | Estilos | Upload UI | Bajo |
| 15 | Estilos | Style panel | Bajo |
| 16 | Breakpoints | Switcher + per-bp | Medio |
| 17 | UX | Precision arrows | Bajo |
| 18 | UX | Undo/Redo | Bajo |
| 19 | UX | History dropdown | Bajo |
| 20 | QA | E2E suite | Bajo |
| 21 | QA | Pixel-parity check | Medio |
| 22 | Cutover | Flip flag en prod | Medio |
| 23 | Docs | Rollback procedure | Bajo |

23 tareas totales. Estimación ejecución: 10-15 días hábiles con secuencialidad.

**Orden de ejecución:** Tasks 1-2 (data) → Tasks 3-5 (renderer) → Tasks 6-8 (admin API + auth) → Tasks 9-13 (editor core) → Tasks 14-15 (image+styles) → Task 16 (breakpoints) → Tasks 17-19 (polish) → Tasks 20-22 (QA + cutover) → Task 23 (rollback doc).

**Gating al final de cada fase:** Phase completa con build OK + flag todavía `false` → deploy incremental → smoke público OK → siguiente phase.
