const PROVIDER_STATUSES = new Set(['active', 'inactive']);
const SERVICE_TYPES = new Set(['tour_operator', 'transport', 'lodging', 'guide', 'activity', 'restaurant', 'other']);

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(email) {
  return email.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function nullableText(value, maxLength) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function providerPayload(body) {
  const name = cleanText(body?.name, 160);
  const legalName = nullableText(body?.legalName, 190);
  const contactName = nullableText(body?.contactName, 120);
  const email = normalizeEmail(body?.email);
  const phone = cleanText(body?.phone, 40);
  const country = nullableText(body?.country, 100);
  const serviceType = cleanText(body?.serviceType || 'other', 32);
  const status = cleanText(body?.status || 'active', 32);
  const notes = nullableText(body?.notes, 4000);

  if (name.length < 2) return { error: 'Nombre de proveedor inválido.' };
  if (!email && phone.length < 5) return { error: 'Debe indicar correo o teléfono.' };
  if (email && !validEmail(email)) return { error: 'Correo inválido.' };
  if (!SERVICE_TYPES.has(serviceType)) return { error: 'Tipo de servicio inválido.' };
  if (!PROVIDER_STATUSES.has(status)) return { error: 'Estado de proveedor inválido.' };

  return { name, legalName, contactName, email: email || null, phone: phone || null, country, serviceType, status, notes };
}

function mapProvider(row) {
  return {
    id: Number(row.id),
    name: row.name,
    legalName: row.legal_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    country: row.country,
    serviceType: row.service_type,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function registerProviderRoutes({ app, pool, requireSession, sameOriginOnly, audit }) {
  app.get('/api/admin/providers', requireSession, async (req, res) => {
    try {
      const status = cleanText(req.query.status, 32);
      const serviceType = cleanText(req.query.serviceType, 32);
      const q = cleanText(req.query.q, 120);
      const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(10, Number.parseInt(String(req.query.limit || '25'), 10) || 25));
      const offset = (page - 1) * limit;
      const where = [];
      const params = [];

      if (status && status !== 'all') {
        if (!PROVIDER_STATUSES.has(status)) return res.status(400).json({ error: 'Filtro de estado inválido.' });
        where.push('status = ?'); params.push(status);
      }
      if (serviceType && serviceType !== 'all') {
        if (!SERVICE_TYPES.has(serviceType)) return res.status(400).json({ error: 'Filtro de servicio inválido.' });
        where.push('service_type = ?'); params.push(serviceType);
      }
      if (q) {
        const like = `%${q}%`;
        where.push('(name LIKE ? OR legal_name LIKE ? OR contact_name LIKE ? OR email LIKE ? OR phone LIKE ? OR country LIKE ?)');
        params.push(like, like, like, like, like, like);
      }

      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [[summaryRows], [countRows], [rows]] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS total, SUM(status='active') AS activeCount, SUM(status='inactive') AS inactiveCount, COUNT(DISTINCT service_type) AS serviceTypes FROM providers`),
        pool.execute(`SELECT COUNT(*) AS total FROM providers ${clause}`, params),
        pool.execute(`SELECT id,name,legal_name,contact_name,email,phone,country,service_type,status,notes,created_at,updated_at FROM providers ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      ]);

      const summary = summaryRows[0] || {};
      const total = Number(countRows[0]?.total || 0);
      res.json({
        ok: true,
        summary: {
          total: Number(summary.total || 0),
          active: Number(summary.activeCount || 0),
          inactive: Number(summary.inactiveCount || 0),
          serviceTypes: Number(summary.serviceTypes || 0),
        },
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        providers: rows.map(mapProvider),
      });
    } catch (error) {
      console.error('providers_list_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar los proveedores.' });
    }
  });

  app.post('/api/admin/providers', sameOriginOnly, requireSession, async (req, res) => {
    const payload = providerPayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
      const [result] = await pool.execute(
        `INSERT INTO providers (name,legal_name,contact_name,email,phone,country,service_type,status,notes,created_by_admin_id,updated_by_admin_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [payload.name,payload.legalName,payload.contactName,payload.email,payload.phone,payload.country,payload.serviceType,payload.status,payload.notes,req.admin.id,req.admin.id],
      );
      await audit(req, 'provider_created', { userId: req.admin.id, email: req.admin.email, metadata: { providerId: result.insertId, serviceType: payload.serviceType } });
      res.status(201).json({ ok: true, provider: { id: Number(result.insertId) } });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un proveedor con ese nombre.' });
      console.error('provider_create_failed', error.message);
      res.status(503).json({ error: 'No fue posible crear el proveedor.' });
    }
  });

  app.patch('/api/admin/providers/:id', sameOriginOnly, requireSession, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Proveedor inválido.' });
    const payload = providerPayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
      const [result] = await pool.execute(
        `UPDATE providers SET name=?,legal_name=?,contact_name=?,email=?,phone=?,country=?,service_type=?,status=?,notes=?,updated_by_admin_id=? WHERE id=?`,
        [payload.name,payload.legalName,payload.contactName,payload.email,payload.phone,payload.country,payload.serviceType,payload.status,payload.notes,req.admin.id,id],
      );
      if (!result.affectedRows) return res.status(404).json({ error: 'Proveedor no encontrado.' });
      await audit(req, 'provider_updated', { userId: req.admin.id, email: req.admin.email, metadata: { providerId: id, serviceType: payload.serviceType, status: payload.status } });
      res.json({ ok: true });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un proveedor con ese nombre.' });
      console.error('provider_update_failed', error.message);
      res.status(503).json({ error: 'No fue posible actualizar el proveedor.' });
    }
  });
}
