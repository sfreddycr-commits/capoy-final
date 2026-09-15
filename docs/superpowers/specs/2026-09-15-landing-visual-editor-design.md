# Editor Visual del Landing — Design

- **Fecha:** 2026-09-15
- **Estado:** BORRADOR → sujeto a visto bueno del PO
- **Owner técnico:** SAF
- **Aprobación previa:** PO pidió explícitamente "editor visual tipo Elementor" sin programar/redploy.

## 1. Objetivo

Convertir las zonas **Header + Hero + Trust strip** del landing público en componentes editables visualmente por el **único Global Admin (PO)** desde `Dashboard → Landing`, con:

- arrastrar y soltar (X/Y) por elemento,
- editar texto en línea,
- mostrar/ocultar por elemento,
- cambiar imagen de fondo del hero,
- 3 vistas: Desktop / Tablet / Mobile (cada una con su layout),
- borrador vs publicado (sin deploy manual),
- deshacer/rehacer e historial,
- permisos sólo PO.

**Out-of-scope inmediato** (se pueden agregar en iteraciones siguientes): edición de las secciones **por debajo del trust strip** (Why, Destinations, How, Testimonials, FAQ, CTA, Footer). El alcance arranca con `header + hero + trust_strip` porque concentran el dolor del PO.

## 2. Enfoque elegido (con rationale)

**Opción B — Overlay DnD editor** (recomendada).
Canvas muestra el landing *live* en un iframe/app sandbox, los elementos se vuelven clickeables, se arrastran con mouse/touch, y un panel lateral edita propiedades. Es lo más cercano a Elementor y a lo descrito por el PO.

Descartadas:
- A) Spreadsheet: frío, sin WYSIWYG.
- C) Inline edit: técnicamente complejo (sobrescribe scroll handlers, captura de eventos) y menos descubrible para el PO.

## 3. Arquitectura

```
┌──────────────────────────────┐        ┌─────────────────────────────┐
│ Backend (Express + MySQL)    │        │ Frontend (React + Vite)     │
│ ──────                      │        │ ─────                       │
│ + landing_components table   │◄──────►│ /admin/landing-editor       │
│ + landing_published view     │  JSON  │   ├ canvas en vivo          │
│ + /api/admin/landing/*       │        │   ├ inspector (panel lado)  │
│ + /api/public/landing/page   │        │   ├ toolbar (draft/pub)     │
│ + requireOwner middleware    │        │ + PublicLanding.tsx usa el  │
└──────────────────────────────┘        │   nuevo endpoint público.   │
                                        └─────────────────────────────┘
```

- **Persistencia:** una sola tabla `landing_components` con `(slot, breakpoint, props JSON, position JSON, hidden BOOLEAN, draft_props JSON, published_at)`. Por elemento hay **una fila por breakpoint** (desktop, tablet, mobile) → 3 filas por slot editable cuando aplica. Una fila "compartida" cuando el slot no depende del breakpoint.
- **Borrador/Publicado:** campos separados `props_json` (publicado) vs `draft_props_json` (borrador, autoguardado). "Publicar" copia `draft → props` en transacción + bump `published_at`.
- **Auth:** nuevo middleware `requireOwner` chequea `admin_users.role='owner'` (rol nuevo) o email == `BOOTSTRAP_OWNER_EMAIL`. Sólo este rol entra al editor. La sesión normal sigue trabajando para no-admins en otras áreas.
- **Renderer público:** `PublicLanding.tsx` consume `/api/public/landing/page` y aplica `style={{position:'absolute', left, top, width, ...}}` por elemento. Los textos y CTAs del hero actual se vuelven *shells* que sólo albergan los componentes editables, preservando el look 1:1 en el primer render.

## 4. Modelo de datos (SQL)

```sql
-- (No DDL change required for admin_users.)
-- admin_users already has `role VARCHAR(40) NOT NULL DEFAULT 'admin'` from
-- migration 0001. Live row id=1 holds 'owner', id=2 holds 'admin'. The
-- editor's owner-gate uses `req.user.role === 'owner'` (matches the existing
-- RBAC in server/users.js:29). Forcing ENUM('owner','staff') here would
-- either crash POST /api/admin/users or silently coerce id=2 to ''. Do NOT
-- modify the role column.

CREATE TABLE landing_components (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  site_section  ENUM('header','hero','trust_strip') NOT NULL,
  slot          VARCHAR(64) NOT NULL,                  -- p.ej. 'logo','hero_title','trust_item:1'
  breakpoint    ENUM('desktop','tablet','mobile') NOT NULL,
  pos_x         INT NOT NULL DEFAULT 0,
  pos_y         INT NOT NULL DEFAULT 0,
  width         INT NULL,                              -- NULL = auto
  height        INT NULL,
  z_index       INT NOT NULL DEFAULT 1,
  hidden        TINYINT(1) NOT NULL DEFAULT 0,
  props_json    JSON NOT NULL,                         -- publicado (text, src, alt, href)
  draft_props_json JSON NULL,                          -- borrador (auto-guardado)
  updated_by    BIGINT UNSIGNED NULL,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at  TIMESTAMP NULL,
  UNIQUE KEY uniq_slot_bp (site_section, slot, breakpoint),
  KEY idx_section (site_section, slot)
);

CREATE TABLE landing_versions (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  site_section  ENUM('header','hero','trust_strip') NOT NULL,
  snapshot_json JSON NOT NULL,                         -- snapshot completo de landing_components al publicar
  published_by  BIGINT UNSIGNED NULL,
  published_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_section_time (site_section, published_at)
);
```

**Slots editables** (seed inicial):
- `header`: `logo`, `menu_link:inicio`, `menu_link:tours`, `menu_link:destinos`, `menu_link:faq`, `menu_link:contacto`, `login_btn`, `phone`, `reserve_btn`
- `hero`: `bg_image`, `eyebrow`, `title`, `lead`, `cta_primary`, `cta_secondary`
- `trust_strip`: `item:1` … `item:4` (icono + título + texto)

Cada slot tiene sus 3 filas (desktop/tablet/mobile).

## 5. API

| Método | Ruta | Permiso | Función |
|---|---|---|---|
| GET | `/api/public/landing/page` | público | Devuelve componentes **publicados** por slot/breakpoint |
| GET | `/api/admin/landing/components?drafts=1` | owner | Lista componentes + drafts |
| PUT | `/api/admin/landing/components/:id` | owner | Actualiza una fila individual (drag, texto, style) |
| POST | `/api/admin/landing/components/:id/draft` | owner | Auto-guarda `draft_props_json` |
| POST | `/api/admin/landing/publish` | owner | Copia draft→publicado, bump `published_at` |
| POST | `/api/admin/landing/revert/:id` | owner | Revierte el slot a último publicado |
| GET | `/api/admin/landing/history` | owner | Lista versiones publicadas (últimas 50) |
| POST | `/api/admin/landing/restore/:versionId` | owner | Restaura una versión |
| POST | `/api/admin/landing/components/:id/upload` | owner | Sube imagen (multer ya extendido) |
| POST | `/api/admin/landing/components/reorder` | owner | Cambia z_index (frente/detrás) |
| POST | `/api/admin/landing/undo` / `redo` | owner | Stack en memoria server-side + último draft |

Rate limit existente respeta a estos endpoints. CSRF protection se mantiene vía `sameOriginOnly`.

## 6. UX del editor

Layout (escritorio admin):

```
┌────────────────────────────────────────┬───────────────────┐
│ Toolbar: [Draft] [Preview] [Publish]  │ Inspector         │
│             [Undo][Redo] [History ▾]   │                   │
├────────────────────────────────────────┤  ▸ Posición        │
│ Canvas (iframe landing a 1440/768 etc) │    X, Y, W, H, Z  │
│   - Click elemento = select + outlines│  ▸ Texto          │
│   - Drag handle = mover                │  ▸ Estilo         │
│   - Tape medida visible (1/5/10 px)    │  ▸ Visibilidad    │
│   - Breakpoint switcher (D/T/M)        │  ▸ Avanzado       │
└────────────────────────────────────────┴───────────────────┘
```

- **Auto-save:** debounce 800 ms al cambiar texto o arrastrar.
- **Preview:** abre `/admin/landing-editor/preview?bp=desktop` en pestaña nueva con la rama *draft*.
- **Historial:** dropdown con timestamps; restore = publica esa versión.
- **Undo/Redo:** stack en cliente (estado serializable JSON del editor); ante "publish" se limpia.
- **Permisos:** si el admin logueado no es owner, ve "Landing" en modo **read-only** con banner explicativo.

## 7. Riesgos & mitigaciones

| Riesgo | Mitigación |
|---|---|
| Pixel drift al migrar de look 1:1 a componentes editables | Seed inicial captura posiciones actuales del HTML/CSS del hero; render público se valida con snapshot Playwright antes de cut-over |
| Romper reservas/login que dependen del header | Slots protegidos: `logo`, `login_btn`, `reserve_btn` se marcan `protected=1` y no se pueden ocultar (sólo mover) |
| Auto-save concurrente entre dos pestañas del PO | Last-write-wins + warning visual en la segunda pestaña |
| Subida de imágenes maliciosas | Extender `multer` con `mime` whitelist + magic-byte check + size cap (8 MB) |
| Performance del canvas con DnD | Usar `pointer-events: none` en iframe durante drag; throttle de updates |
| Regresión en la versión actual del landing | Feature flag: el `PublicLanding` consume el endpoint viejo (`/api/public/landing` con texto) y el nuevo en paralelo; toggle runtime |

## 8. Plan de despliegue

| Hito | Entregable | Tamaño |
|---|---|---|
| H1 — Datos | Migración SQL + seed inicial de slots existentes | 1 día |
| H2 — Renderer | `PublicLanding` lee nuevo endpoint; live toggle feature-flag | 2 días |
| H3 — Editor core | Canvas, drag, inspector básico, draft/auto-save/publish | 4 días |
| H4 — Imagen + estilos | Upload de fondo, panel de estilo, color/font | 2 días |
| H5 — Breakpoints | Tablet + Mobile con posiciones independientes | 2 días |
| H6 — UX polish | Flechas 1/5/10px, undo/redo cliente, history dropdown, preview tab | 2 días |
| H7 — Seguridad + QA | `requireOwner`, QA desktop+tablet+mobile, Playwright suite, rollback plan | 2 días |

**Total estimado:** ~15 días hábiles (≈ 3 semanas con buffer). Sin contar iteraciones sobre las secciones por debajo del trust_strip (queda como Fase 2).

## 9. Criterios de aceptación (los PASS/FAIL de Fredy)

| Ítem | Cómo se prueba |
|---|---|
| Editor visual abre en /admin/landing | GET 200 + DOM "canvas" visible |
| Drag & Drop mueve un elemento | PUT 200 + DB pos_x/pos_y cambia + Playwright confirma nueva posición |
| Editar texto de un título | PUT 200 + DOM público refleja el nuevo texto post-publish |
| Editar botón (texto/link/color) | PUT 200 + DOM público refleja cambios |
| Editar imagen de fondo | upload 200 + `<img src>` cambia en DOM público |
| Show/Hide por elemento | hidden=1 ⇒ DOM público no contiene el slot |
| Duplicar elemento | (Fase 2 — diferido) |
| Agregar elemento nuevo | (Fase 2 — diferido, vía Fase 2 del scope ampliado) |
| Desktop OK | snapshot Playwright 1440 |
| Tablet OK | snapshot Playwright 820 |
| Mobile OK | snapshot Playwright 390 |
| Draft OK | cambios en canvas NO impactan /api/public/landing/page hasta publish |
| Preview OK | /admin/landing-editor/preview?bp=mobile muestra draft sin publicar |
| Publicar OK | POST /publish ⇒ DB published_at NOW + DOM público refleja cambios |
| Undo/Redo OK | history stack de cliente; revierte último cambio local |
| Historial OK | dropdown de versiones; restore clona props_json |
| Permisos PO OK | admin no-owner intenta PUT ⇒ 403 |
| Landing público estable | snapshot Playwright E2E pre/post |

## 10. Decisiones a confirmar con el PO (AHORA, rápido)

1. **Out-of-scope inicial:** confirmar que las secciones `Why, Destinations, How, Testimonials, FAQ, CTA, Footer` quedan para una fase 2.
2. **Pisos protegidos:** logo + login + reserve_btn no se pueden ocultar (sólo mover) — ¿ok?
3. **Idioma del UI del editor:** español (consistente con el resto del admin).
4. **Historial:** ¿mantener últimas 50 versiones? ¿o lo que entre en un JSON por slot?
5. **Imagen de fondo:** cap 8 MB y whitelist JPEG/PNG/WebP — ¿alcanza?

Voy a esperar tu OK a este mapa antes de arrancar H1. Si querés que cambie algo, decime ahora.
