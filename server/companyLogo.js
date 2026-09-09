// Company logo / favicon upload — owner-only.
// Stores file under uploads/company/<filename>, returns the public URL.
// Persists the URL in app_settings (company_logo_url, company_favicon_url).

import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

const COMPANY_DIR = path.join(process.cwd(), 'uploads', 'company');
if (!fs.existsSync(COMPANY_DIR)) fs.mkdirSync(COMPANY_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, COMPANY_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `company-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP, SVG).'));
  },
});

const ALLOWED_LOGO_TYPES = new Set(['logo', 'favicon']);

export function registerCompanyLogoRoutes({ app, pool, requireSession, sameOriginOnly, audit }) {
  app.post(
    '/api/admin/company/upload',
    sameOriginOnly,
    requireSession,
    (req, res, next) => {
      // Inline owner check (since requireOwner isn't exported by settings.js).
      if (req.admin?.role !== 'owner') return res.status(403).json({ error: 'Se requiere rol propietario.' });
      next();
    },
    upload.single('image'),
    async (req, res) => {
      const type = String(req.body?.type || 'logo').toLowerCase();
      if (!ALLOWED_LOGO_TYPES.has(type)) return res.status(400).json({ error: 'Tipo de imagen inválido.' });
      if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });
      try {
        const url = `/uploads/company/${req.file.filename}`;
        const settingKey = type === 'favicon' ? 'company_favicon_url' : 'company_logo_url';
        await pool.execute(
          'INSERT INTO app_settings (setting_key, setting_value, updated_by_admin_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by_admin_id = VALUES(updated_by_admin_id)',
          [settingKey, url, req.admin.id],
        );
        await audit(req, 'company_logo_updated', {
          userId: req.admin.id,
          email: req.admin.email,
          metadata: { settingKey, filename: req.file.filename, type },
        });
        res.json({ ok: true, url, settingKey });
      } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('company_logo_upload_failed', error.message);
        res.status(503).json({ error: 'No fue posible guardar el logo.' });
      }
    },
  );
}
