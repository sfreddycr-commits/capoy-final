-- migrations/0017b_landing_components_seed.sql
-- Seed initial landing_components rows: header + hero + trust_strip
-- × {desktop, tablet, mobile}, mirroring the live /api/public/landing render.
--
-- Slot positions were captured from the live DOM at three viewports
-- (1440×900 desktop, 820×1180 tablet, 390×844 mobile) using
-- `getBoundingClientRect()` via Playwright. The captured sidecar lives
-- in /tmp/opencode/playwright-output/landing-{1440,820,390}.json and is
-- NOT committed.
--
-- Conventions used:
-- * pos_x / pos_y are px relative to the START of the new site_section
--   (header / hero / trust_strip) the renderer (Task 4) will build —
--   i.e. relative to (0,0) of the section element. Each section is
--   full-width and slots inside are position:absolute.
-- * For header slots: section origin = document top (topbar lives at the
--   top of the page today and will become the header section as-is).
-- * For hero slots: section origin = document top + topbar.height
--   (heroContent lives below topbar today and will become the hero section).
--   At 1440/820 topbar.h=72; at 390 topbar.h=64.
-- * For trust_strip slots: section origin = current section.hero.bottom
--   (520 at desktop/tablet, 690 at mobile). trust_grid inside is at the
--   same offset today, so slot.pos_y values match what was measured
--   relative to trust_grid.
-- * width / height are NULL for slots that auto-size from text content
--   (menu links, login/phone/reserve, eyebrow, title, lead, CTAs, trust
--   items). Integer values are used only for slots with a fixed size
--   (logo block, hero bg_image container).
-- * hidden=1 marks slots that are display:none at the breakpoint
--   (CSS @media<=900 hides .nav; CSS @media<=640 additionally hides
--   .phone and turns .admin-login-link into a position:fixed FAB
--   pinned bottom:14px right:14px on a 390 viewport — recorded as-is).
-- * props_json shape mirrors the brief sample and the live
--   /api/public/landing payload.
-- * draft_props_json = NULL, published_at = NULL (per the brief).
-- * updated_by = NULL (no editor user touched this seed; it is the
--   baseline).

-- =============================================================
-- HEADER (9 slots × 3 breakpoints = 27 rows)
-- =============================================================

-- logo (desktop / tablet / mobile) — measured brand block
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('header','logo','desktop',190,8,288,56,10,0,
   '{"text":"Capoy","href":"#inicio","src":"","alt":"Capoy Costa Rica","protected":true}'),
  ('header','logo','tablet',16,18,310,36,10,0,
   '{"text":"Capoy","href":"#inicio","src":"","alt":"Capoy Costa Rica","protected":true}'),
  ('header','logo','mobile',12,9,226,47,10,0,
   '{"text":"Capoy","href":"#inicio","src":"","alt":"Capoy Costa Rica","protected":true}');

-- menu_link:inicio (visible desktop only; @media<=900 hides .nav)
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('header','menu_link:inicio','desktop',502,28,NULL,NULL,2,0,
   '{"text":"Inicio","href":"#inicio"}'),
  ('header','menu_link:inicio','tablet',0,0,NULL,NULL,2,1,
   '{"text":"Inicio","href":"#inicio"}'),
  ('header','menu_link:inicio','mobile',0,0,NULL,NULL,2,1,
   '{"text":"Inicio","href":"#inicio"}');

-- menu_link:tours
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('header','menu_link:tours','desktop',565,28,NULL,NULL,2,0,
   '{"text":"Tours","href":"#tours"}'),
  ('header','menu_link:tours','tablet',0,0,NULL,NULL,2,1,
   '{"text":"Tours","href":"#tours"}'),
  ('header','menu_link:tours','mobile',0,0,NULL,NULL,2,1,
   '{"text":"Tours","href":"#tours"}');

-- menu_link:destinos
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('header','menu_link:destinos','desktop',630,28,NULL,NULL,2,0,
   '{"text":"Destinos","href":"#destinos"}'),
  ('header','menu_link:destinos','tablet',0,0,NULL,NULL,2,1,
   '{"text":"Destinos","href":"#destinos"}'),
  ('header','menu_link:destinos','mobile',0,0,NULL,NULL,2,1,
   '{"text":"Destinos","href":"#destinos"}');

-- menu_link:faq
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('header','menu_link:faq','desktop',714,28,NULL,NULL,2,0,
   '{"text":"FAQ","href":"#faq"}'),
  ('header','menu_link:faq','tablet',0,0,NULL,NULL,2,1,
   '{"text":"FAQ","href":"#faq"}'),
  ('header','menu_link:faq','mobile',0,0,NULL,NULL,2,1,
   '{"text":"FAQ","href":"#faq"}');

-- menu_link:contacto
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('header','menu_link:contacto','desktop',769,28,NULL,NULL,2,0,
   '{"text":"Contacto","href":"#contacto"}'),
  ('header','menu_link:contacto','tablet',0,0,NULL,NULL,2,1,
   '{"text":"Contacto","href":"#contacto"}'),
  ('header','menu_link:contacto','mobile',0,0,NULL,NULL,2,1,
   '{"text":"Contacto","href":"#contacto"}');

-- login_btn (.admin-login-link; on mobile becomes a bottom-right FAB)
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('header','login_btn','desktop',852,15,NULL,NULL,5,0,
   '{"text":"Iniciar sesión","href":"/admin/login","protected":true}'),
  ('header','login_btn','tablet',376,15,NULL,NULL,5,0,
   '{"text":"Iniciar sesión","href":"/admin/login","protected":true}'),
  ('header','login_btn','mobile',261,784,NULL,NULL,5,0,
   '{"text":"Iniciar sesión","href":"/admin/login","protected":true,"positionFixed":true}');

-- phone (@media<=640 hides .phone)
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('header','phone','desktop',980,19,NULL,NULL,2,0,
   '{"text":"+506 8880-1234","href":"tel:+50688801234"}'),
  ('header','phone','tablet',503,28,NULL,NULL,2,0,
   '{"text":"+506 8880-1234","href":"tel:+50688801234"}'),
  ('header','phone','mobile',0,0,NULL,NULL,2,1,
   '{"text":"+506 8880-1234","href":"tel:+50688801234"}');

-- reserve_btn
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('header','reserve_btn','desktop',1089,2,NULL,NULL,10,0,
   '{"text":"Reservar ahora","href":"#tours","protected":true}'),
  ('header','reserve_btn','tablet',626,13,NULL,NULL,10,0,
   '{"text":"Reservar ahora","href":"#tours","protected":true}'),
  ('header','reserve_btn','mobile',262,8,NULL,NULL,10,0,
   '{"text":"Reservar ahora","href":"#tours","protected":true}');

-- =============================================================
-- HERO (6 slots × 3 breakpoints = 18 rows)
-- =============================================================

-- bg_image — the hero section's own background container
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('hero','bg_image','desktop',0,0,1440,520,0,0,
   '{"src":"https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format&fit=crop&w=1800&q=90","alt":"Costa Rica"}'),
  ('hero','bg_image','tablet',0,0,820,520,0,0,
   '{"src":"https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format&fit=crop&w=1800&q=90","alt":"Costa Rica"}'),
  ('hero','bg_image','mobile',0,0,390,690,0,0,
   '{"src":"https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format&fit=crop&w=1800&q=90","alt":"Costa Rica"}');

-- eyebrow (.script — "Explora")
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('hero','eyebrow','desktop',190,3,NULL,NULL,2,0,'{"text":"Explora"}'),
  ('hero','eyebrow','tablet',16,42,NULL,NULL,2,0,'{"text":"Explora"}'),
  ('hero','eyebrow','mobile',13,53,NULL,NULL,2,0,'{"text":"Explora"}');

-- title (h1 — "Costa Rica como nunca antes")
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('hero','title','desktop',190,97,NULL,NULL,3,0,
   '{"text":"Costa Rica<br/>como nunca<br/>antes"}'),
  ('hero','title','tablet',16,136,NULL,NULL,3,0,
   '{"text":"Costa Rica<br/>como nunca<br/>antes"}'),
  ('hero','title','mobile',12,131,NULL,NULL,3,0,
   '{"text":"Costa Rica<br/>como nunca<br/>antes"}');

-- lead (paragraph)
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('hero','lead','desktop',190,299,NULL,NULL,2,0,
   '{"text":"Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país."}'),
  ('hero','lead','tablet',16,260,NULL,NULL,2,0,
   '{"text":"Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país."}'),
  ('hero','lead','mobile',12,292,NULL,NULL,2,0,
   '{"text":"Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país."}');

-- cta_primary (.primary-ghost — "Ver tours")
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('hero','cta_primary','desktop',190,365,NULL,NULL,4,0,
   '{"text":"Ver tours","href":"#tours"}'),
  ('hero','cta_primary','tablet',16,326,NULL,NULL,4,0,
   '{"text":"Ver tours","href":"#tours"}'),
  ('hero','cta_primary','mobile',12,352,NULL,NULL,4,0,
   '{"text":"Ver tours","href":"#tours"}');

-- cta_secondary (.secondary-btn — "Planear mi viaje")
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('hero','cta_secondary','desktop',322,365,NULL,NULL,4,0,
   '{"text":"Planear mi viaje","href":"#como-funciona"}'),
  ('hero','cta_secondary','tablet',148,326,NULL,NULL,4,0,
   '{"text":"Planear mi viaje","href":"#como-funciona"}'),
  ('hero','cta_secondary','mobile',144,352,NULL,NULL,4,0,
   '{"text":"Planear mi viaje","href":"#como-funciona"}');

-- =============================================================
-- TRUST_STRIP (4 items × 3 breakpoints = 12 rows)
-- =============================================================

-- item:1 (ShieldCheck — "Operador 100% local" / "y certificado")
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('trust_strip','item:1','desktop',190,0,265,54,1,0,
   '{"icon":"ShieldCheck","title":"Operador 100% local","text":"y certificado"}'),
  ('trust_strip','item:1','tablet',16,0,394,51,1,0,
   '{"icon":"ShieldCheck","title":"Operador 100% local","text":"y certificado"}'),
  ('trust_strip','item:1','mobile',12,0,183,51,1,0,
   '{"icon":"ShieldCheck","title":"Operador 100% local","text":"y certificado"}');

-- item:2 (Leaf — "Turismo sostenible" / "y responsable")
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('trust_strip','item:2','desktop',455,0,265,54,1,0,
   '{"icon":"Leaf","title":"Turismo sostenible","text":"y responsable"}'),
  ('trust_strip','item:2','tablet',410,0,394,51,1,0,
   '{"icon":"Leaf","title":"Turismo sostenible","text":"y responsable"}'),
  ('trust_strip','item:2','mobile',195,0,183,51,1,0,
   '{"icon":"Leaf","title":"Turismo sostenible","text":"y responsable"}');

-- item:3 (Headphones — "Soporte 24/7" / "antes y durante tu viaje")
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('trust_strip','item:3','desktop',720,0,265,54,1,0,
   '{"icon":"Headphones","title":"Soporte 24/7","text":"antes y durante tu viaje"}'),
  ('trust_strip','item:3','tablet',16,51,394,51,1,0,
   '{"icon":"Headphones","title":"Soporte 24/7","text":"antes y durante tu viaje"}'),
  ('trust_strip','item:3','mobile',12,51,183,51,1,0,
   '{"icon":"Headphones","title":"Soporte 24/7","text":"antes y durante tu viaje"}');

-- item:4 (LockKeyhole — "Reservas seguras" / "y confirmación inmediata")
INSERT INTO landing_components
  (site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json)
VALUES
  ('trust_strip','item:4','desktop',985,0,265,54,1,0,
   '{"icon":"LockKeyhole","title":"Reservas seguras","text":"y confirmación inmediata"}'),
  ('trust_strip','item:4','tablet',410,51,394,51,1,0,
   '{"icon":"LockKeyhole","title":"Reservas seguras","text":"y confirmación inmediata"}'),
  ('trust_strip','item:4','mobile',195,51,183,51,1,0,
   '{"icon":"LockKeyhole","title":"Reservas seguras","text":"y confirmación inmediata"}');