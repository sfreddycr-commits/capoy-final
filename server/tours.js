const TOUR_STATUSES = new Set(['draft', 'published', 'inactive']);

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function nullableText(value, maxLength) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function slugify(value) {
  return cleanText(value, 180)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 190);
}

function parseMoney(value, field, nullable = false) {
  if (nullable && (value === '' || value === null || value === undefined)) return { value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 9999999999.99) return { error: `${field} inválido.` };
  return { value: number };
}

function parseCapacity(value) {
  if (value === '' || value === null || value === undefined) return { value: null };
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) return { error: 'Capacidad inválida.' };
  return { value: number };
}

function createPayload(body) {
  const name = cleanText(body?.name, 180);
  const destination = cleanText(body?.destination, 160);
  const slug = slugify(body?.slug || name);
  const shortDescription = nullableText(body?.shortDescription, 320);
  const description = nullableText(body?.description, 12000);
  const duration = nullableText(body?.duration, 80);
  const currency = cleanText(body?.currency || 'USD', 3).toUpperCase();
  const status = cleanText(body?.status || 'draft', 32);
  const mainImageUrl = nullableText(body?.mainImageUrl, 1000);
  const adult = parseMoney(body?.adultPrice, 'Precio adulto');
  const child = parseMoney(body?.childPrice, 'Precio niño', true);
  const capacity = parseCapacity(body?.capacity);

  if (name.length < 2 || destination.length < 2 || slug.length < 2) return { error: 'Nombre, destino y slug son obligatorios.' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: 'Slug inválido.' };
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Moneda inválida.' };
  if (!TOUR_STATUSES.has(status)) return { error: 'Estado de tour inválido.' };
  if (adult.error) return adult;
  if (child.error) return child;
  if (capacity.error) return capacity;
  if (mainImageUrl) {
    try { new URL(mainImageUrl); } catch { return { error: 'URL de imagen inválida.' }; }
  }

  return {
    name, destination, slug, shortDescription, description, duration,
    adultPrice: adult.value, childPrice: child.value, currency,
    capacity: capacity.value, mainImageUrl, status,
  };
}

export function registerTourRoutes({ app, pool, requireSession, sameOriginOnly, audit }) {
  app.get('/api/admin/tours', requireSession, async (req, res) => {
    try {
      const status = cleanText(req.query.status, 32);
      const q = cleanText(req.query.q, 120);
      const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(10, Number.parseInt(String(req.query.limit || '25'), 10) || 25));
      const offset = (page - 1) * limit;
      const where = [];
      const params = [];

      if (status && status !== 'all') {
        if (!TOUR_STATUSES.has(status)) return res.status(400).json({ error: 'Filtro de estado inválido.' });
        where.push('status = ?'); params.push(status);
      }
      if (q) {
        const like = `%${q}%`;
        where.push('(name LIKE ? OR destination LIKE ? OR slug LIKE ?)');
        params.push(like, like, like);
      }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [[summaryRows], [countRows], [rows]] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS total,
          SUM(status = 'draft') AS draftCount,
          SUM(status = 'published') AS publishedCount,
          SUM(status = 'inactive') AS inactiveCount
          FROM tours`),
        pool.execute(`SELECT COUNT(*) AS total FROM tours ${clause}`, params),
        pool.execute(`SELECT id, slug, name, destination, short_description, description, duration, adult_price, child_price, currency, capacity, main_image_url, status, published_at, created_at, updated_at
          FROM tours ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      ]);
      const summary = summaryRows[0] || {};
      const total = Number(countRows[0]?.total || 0);
      res.json({
        ok: true,
        summary: { total: Number(summary.total || 0), draft: Number(summary.draftCount || 0), published: Number(summary.publishedCount || 0), inactive: Number(summary.inactiveCount || 0) },
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        tours: rows.map((row) => ({
          id: Number(row.id), slug: row.slug, name: row.name, destination: row.destination,
          shortDescription: row.short_description, description: row.description, duration: row.duration,
          adultPrice: Number(row.adult_price), childPrice: row.child_price === null ? null : Number(row.child_price),
          currency: row.currency, capacity: row.capacity === null ? null : Number(row.capacity), mainImageUrl: row.main_image_url,
          status: row.status, publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at,
        })),
      });
    } catch (error) {
      console.error('tours_list_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar los tours.' });
    }
  });

  app.get('/api/admin/tours/options', requireSession, async (_req, res) => {
    try {
      const [rows] = await pool.query(`SELECT id, name, destination, adult_price, child_price, currency, status
        FROM tours WHERE status = 'published' ORDER BY name ASC`);
      res.json({ ok: true, tours: rows.map((row) => ({ id: Number(row.id), name: row.name, destination: row.destination, adultPrice: Number(row.adult_price), childPrice: row.child_price === null ? null : Number(row.child_price), currency: row.currency, status: row.status })) });
    } catch (error) {
      console.error('tour_options_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar las opciones de tours.' });
    }
  });

  app.post('/api/admin/tours', sameOriginOnly, requireSession, async (req, res) => {
    const payload = createPayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
      const publishedAt = payload.status === 'published' ? new Date() : null;
      const [result] = await pool.execute(`INSERT INTO tours
        (slug, name, destination, short_description, description, duration, adult_price, child_price, currency, capacity, main_image_url, status, published_at, created_by_admin_id, updated_by_admin_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.slug, payload.name, payload.destination, payload.shortDescription, payload.description, payload.duration, payload.adultPrice, payload.childPrice, payload.currency, payload.capacity, payload.mainImageUrl, payload.status, publishedAt, req.admin.id, req.admin.id]);
      await audit(req, 'tour_created', { userId: req.admin.id, email: req.admin.email, metadata: { tourId: result.insertId, slug: payload.slug } });
      res.status(201).json({ ok: true, tour: { id: Number(result.insertId), slug: payload.slug } });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un tour con ese slug.' });
      console.error('tour_create_failed', error.message);
      res.status(503).json({ error: 'No fue posible crear el tour.' });
    }
  });

  app.patch('/api/admin/tours/:id', sameOriginOnly, requireSession, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Tour inválido.' });
    const payload = createPayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
      const [existingRows] = await pool.execute('SELECT status, published_at FROM tours WHERE id = ? LIMIT 1', [id]);
      if (!existingRows.length) return res.status(404).json({ error: 'Tour no encontrado.' });
      const existing = existingRows[0];
      const publishedAt = payload.status === 'published' ? (existing.published_at || new Date()) : existing.published_at;
      await pool.execute(`UPDATE tours SET slug=?, name=?, destination=?, short_description=?, description=?, duration=?, adult_price=?, child_price=?, currency=?, capacity=?, main_image_url=?, status=?, published_at=?, updated_by_admin_id=? WHERE id=?`,
        [payload.slug, payload.name, payload.destination, payload.shortDescription, payload.description, payload.duration, payload.adultPrice, payload.childPrice, payload.currency, payload.capacity, payload.mainImageUrl, payload.status, publishedAt, req.admin.id, id]);
      await audit(req, 'tour_updated', { userId: req.admin.id, email: req.admin.email, metadata: { tourId: id, status: payload.status } });
      res.json({ ok: true });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un tour con ese slug.' });
      console.error('tour_update_failed', error.message);
      res.status(503).json({ error: 'No fue posible actualizar el tour.' });
    }
  });
}
