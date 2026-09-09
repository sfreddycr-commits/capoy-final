// Public endpoint exposing the company profile (logo, phones, address, social).
// Safe values only — no secrets, no admin IDs, no internal config.
// Consumed by PublicCompanyBridge on the public landing for instant updates
// whenever the owner saves changes in /admin/empresa.

const ALLOWED_PUBLIC_KEYS = new Set([
  'business_name',
  'company_legal_name',
  'company_tax_id',
  'company_logo_url',
  'company_favicon_url',
  'company_phone',
  'company_whatsapp',
  'company_email',
  'company_address',
  'company_website',
  'company_hours',
  'company_tagline',
  'company_country',
  'social_facebook',
  'social_instagram',
  'social_tiktok',
  'social_whatsapp_link',
  'social_youtube',
  'currency_symbol',
  'default_currency',
  'timezone',
]);

export function registerCompanyPublicRoutes({ app, pool }) {
  app.get('/api/public/company', async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (${Array.from(ALLOWED_PUBLIC_KEYS).map(() => '?').join(',')})`,
        Array.from(ALLOWED_PUBLIC_KEYS),
      );
      const out = {};
      for (const r of rows) out[r.setting_key] = r.setting_value;
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('X-Robots-Tag', 'noindex');
      res.json({ ok: true, company: out });
    } catch (error) {
      console.error('company_public_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar los datos de la empresa.' });
    }
  });
}
