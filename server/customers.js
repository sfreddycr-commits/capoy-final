const CUSTOMER_STATUSES = new Set(['active', 'inactive']);

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

function customerPayload(body) {
  const fullName = cleanText(body?.fullName, 120);
  const email = normalizeEmail(body?.email);
  const phone = cleanText(body?.phone, 40);
  const country = nullableText(body?.country, 100);
  const language = String(body?.language || 'es').trim().toLowerCase();
  const status = cleanText(body?.status || 'active', 32);
  const marketingOptIn = body?.marketingOptIn === true;
  const notes = nullableText(body?.notes, 4000);

  if (fullName.length < 2) return { error: 'Nombre inválido.' };
  if (!email && phone.length < 5) return { error: 'Debe indicar correo o teléfono.' };
  if (email && !validEmail(email)) return { error: 'Correo inválido.' };
  if (!/^[a-z]{2}$/.test(language)) return { error: 'Idioma inválido.' };
  if (!CUSTOMER_STATUSES.has(status)) return { error: 'Estado de cliente inválido.' };

  return { fullName, email: email || null, phone: phone || null, country, language, status, marketingOptIn, notes };
}

function mapCustomer(row) {
  return {
    id: Number(row.id),
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    country: row.country,
    language: row.language,
    status: row.status,
    marketingOptIn: Boolean(row.marketing_opt_in),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function registerCustomerRoutes({ app, pool, requireSession, sameOriginOnly, audit }) {
  app.get('/api/admin/customers', requireSession, async (req, res) => {
    try {
      const status = cleanText(req.query.status, 32);
      const q = cleanText(req.query.q, 120);
      const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(10, Number.parseInt(String(req.query.limit || '25'), 10) || 25));
      const offset = (page - 1) * limit;
      const where = [];
      const params = [];
      if (status && status !== 'all') {
        if (!CUSTOMER_STATUSES.has(status)) return res.status(400).json({ error: 'Filtro de estado inválido.' });
        where.push('status = ?'); params.push(status);
      }
      if (q) {
        const like = `%${q}%`;
        where.push('(full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR country LIKE ?)');
        params.push(like, like, like, like);
      }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [[summaryRows], [countRows], [rows]] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS total, SUM(status='active') AS activeCount, SUM(status='inactive') AS inactiveCount, SUM(marketing_opt_in=1) AS marketingCount FROM customers`),
        pool.execute(`SELECT COUNT(*) AS total FROM customers ${clause}`, params),
        pool.execute(`SELECT id, full_name, email, phone, country, language, status, marketing_opt_in, notes, created_at, updated_at FROM customers ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      ]);
      const summary = summaryRows[0] || {};
      const total = Number(countRows[0]?.total || 0);
      res.json({
        ok: true,
        summary: { total: Number(summary.total || 0), active: Number(summary.activeCount || 0), inactive: Number(summary.inactiveCount || 0), marketing: Number(summary.marketingCount || 0) },
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        customers: rows.map(mapCustomer),
      });
    } catch (error) {
      console.error('customers_list_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar los clientes.' });
    }
  });

  app.get('/api/admin/customers/options', requireSession, async (_req, res) => {
    try {
      const [rows] = await pool.query(`SELECT id, full_name, email, phone, country, language
        FROM customers WHERE status = 'active' ORDER BY full_name ASC LIMIT 500`);
      res.json({ ok: true, customers: rows.map((row) => ({
        id: Number(row.id), fullName: row.full_name, email: row.email, phone: row.phone,
        country: row.country, language: row.language,
      })) });
    } catch (error) {
      console.error('customer_options_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar las opciones de clientes.' });
    }
  });

  app.post('/api/admin/customers', sameOriginOnly, requireSession, async (req, res) => {
    const payload = customerPayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
      const [result] = await pool.execute(
        `INSERT INTO customers (full_name,email,phone,country,language,status,marketing_opt_in,notes,created_by_admin_id,updated_by_admin_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [payload.fullName,payload.email,payload.phone,payload.country,payload.language,payload.status,payload.marketingOptIn ? 1 : 0,payload.notes,req.admin.id,req.admin.id],
      );
      await audit(req, 'customer_created', { userId: req.admin.id, email: req.admin.email, metadata: { customerId: result.insertId } });
      res.status(201).json({ ok: true, customer: { id: Number(result.insertId) } });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un cliente con ese correo.' });
      console.error('customer_create_failed', error.message);
      res.status(503).json({ error: 'No fue posible crear el cliente.' });
    }
  });

  app.patch('/api/admin/customers/:id', sameOriginOnly, requireSession, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Cliente inválido.' });
    const payload = customerPayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
      const [result] = await pool.execute(
        `UPDATE customers SET full_name=?,email=?,phone=?,country=?,language=?,status=?,marketing_opt_in=?,notes=?,updated_by_admin_id=? WHERE id=?`,
        [payload.fullName,payload.email,payload.phone,payload.country,payload.language,payload.status,payload.marketingOptIn ? 1 : 0,payload.notes,req.admin.id,id],
      );
      if (!result.affectedRows) return res.status(404).json({ error: 'Cliente no encontrado.' });
      await audit(req, 'customer_updated', { userId: req.admin.id, email: req.admin.email, metadata: { customerId: id, status: payload.status } });
      res.json({ ok: true });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un cliente con ese correo.' });
      console.error('customer_update_failed', error.message);
      res.status(503).json({ error: 'No fue posible actualizar el cliente.' });
    }
  });
}
