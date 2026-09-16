export function registerLandingRoutes({ app, pool }) {
  app.get('/api/public/landing/page', async (_req, res) => {
    try {
      if (process.env.LANDING_USE_COMPONENTS !== 'true') {
        return res.status(503).json({ error: 'Feature flag disabled' });
      }
      const [rows] = await pool.query(
        `SELECT id, site_section, slot, breakpoint, pos_x, pos_y, width, height, z_index, hidden, props_json
         FROM landing_components
         ORDER BY site_section, breakpoint, slot`
      );
      const sections = {
        header: { desktop: [], tablet: [], mobile: [] },
        hero: { desktop: [], tablet: [], mobile: [] },
        trust_strip: { desktop: [], tablet: [], mobile: [] }
      };
      for (const r of rows) {
        if (!sections[r.site_section] || !sections[r.site_section][r.breakpoint]) continue;
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
