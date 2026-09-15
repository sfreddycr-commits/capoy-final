// Public endpoint serving the per-slot, per-breakpoint `landing_components` table.
// Phase 2 of the visual editor: behind feature flag `LANDING_USE_COMPONENTS`.
//
// Behavior:
//  * Flag off (or anything other than the literal string 'true'): respond 503
//    with a small JSON body — callers can poll and wait for the flag flip.
//  * Flag on: respond 200 with `{ ok, sections, flag }` where `sections`
//    is grouped by site_section × breakpoint. Read-only and idempotent.
//
// Pattern follows `registerCmsRoutes` / `registerCompanyPublicRoutes`: receive
// `pool` as a parameter rather than importing from index.js (no circular
// import, easier to test, matches every other registrar in server/).

export function registerLandingRoutes({ app, pool }) {
  app.get('/api/public/landing/page', async (_req, res) => {
    try {
      if (process.env.LANDING_USE_COMPONENTS !== 'true') {
        return res.status(503).json({ error: 'Feature flag disabled' });
      }
      if (!pool) return res.status(503).json({ error: 'Servicio temporalmente no disponible.' });

      const [rows] = await pool.query(
        'SELECT id, site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json ' +
        'FROM landing_components ORDER BY site_section, breakpoint, slot',
      );

      const sections = {
        header: { desktop: [], tablet: [], mobile: [] },
        hero: { desktop: [], tablet: [], mobile: [] },
        trust_strip: { desktop: [], tablet: [], mobile: [] },
      };

      for (const r of rows) {
        const bucket = sections[r.site_section];
        if (!bucket) continue;
        const bp = bucket[r.breakpoint];
        if (!bp) continue;
        const props = typeof r.props_json === 'string' ? JSON.parse(r.props_json) : r.props_json;
        bp.push({
          id: r.id,
          slot: r.slot,
          position: { x: r.pos_x, y: r.pos_y, w: r.width, h: r.height, z: r.z_index },
          hidden: !!r.hidden,
          props,
        });
      }

      res.json({ ok: true, sections, flag: true });
    } catch (error) {
      console.error('landing_page_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar los componentes.' });
    }
  });
}