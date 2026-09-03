import crypto from 'node:crypto';
import { registerTourRoutes } from './tours.js';

const STATUSES = new Set(['new', 'contacted', 'quoted', 'confirmed', 'completed', 'cancelled']);

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function nullableText(value, maxLength) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function referenceCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `CAP-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function createPayload(body) {
  const customerId = Number.parseInt(String(body?.customerId ?? ''), 10);
  const tourId = Number.parseInt(String(body?.tourId ?? ''), 10);
  const travelDate = cleanText(body?.travelDate, 10);
  const adults = Number(body?.adults ?? 1);
  const children = Number(body?.children ?? 0);
  const status = cleanText(body?.status || 'new', 32);
  const rawAmount = body?.totalAmount;
  const totalAmount = rawAmount === '' || rawAmount === null || rawAmount === undefined ? null : Number(rawAmount);
  const notes = nullableText(body?.notes, 4000);

  if (!Number.isInteger(customerId) || customerId < 1 || !Number.isInteger(tourId) || tourId < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return { error: 'Cliente, tour y fecha son obligatorios.' };
  if (!Number.isInteger(adults) || adults < 1 || adults > 99 || !Number.isInteger(children) || children < 0 || children > 99) return { error: 'Cantidad de pasajeros inválida.' };
  if (!STATUSES.has(status)) return { error: 'Estado de reserva inválido.' };
  if (totalAmount !== null && (!Number.isFinite(totalAmount) || totalAmount < 0 || totalAmount > 9999999999.99)) return { error: 'Monto inválido.' };

  return { customerId, tourId, travelDate, adults, children, status, totalAmount, notes };
}

export function registerReservationRoutes({ app, pool, requireSession, sameOriginOnly, audit }) {
  registerTourRoutes({ app, pool, requireSession, sameOriginOnly, audit });

  app.get('/api/admin/reservations', requireSession, async (req, res) => {
    try {
      const status = cleanText(req.query.status, 32);
      const q = cleanText(req.query.q, 120);
      const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(10, Number.parseInt(String(req.query.limit || '25'), 10) || 25));
      const offset = (page - 1) * limit;
      const where = [];
      const params = [];

      if (status && status !== 'all') {
        if (!STATUSES.has(status)) return res.status(400).json({ error: 'Filtro de estado inválido.' });
        where.push('r.status = ?');
        params.push(status);
      }
      if (q) {
        where.push('(r.reference_code LIKE ? OR r.customer_name LIKE ? OR r.customer_email LIKE ? OR r.customer_phone LIKE ? OR r.tour_name LIKE ?)');
        const like = `%${q}%`;
        params.push(like, like, like, like, like);
      }

      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [[summaryRows], [countRows], [rows]] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS total,
          SUM(status = 'new') AS newCount,
          SUM(status = 'confirmed') AS confirmedCount,
          SUM(status = 'completed') AS completedCount,
          SUM(status = 'cancelled') AS cancelledCount,
          SUM(travel_date >= CURDATE() AND status NOT IN ('completed','cancelled')) AS upcomingCount
          FROM reservations`),
        pool.execute(`SELECT COUNT(*) AS total FROM reservations r ${clause}`, params),
        pool.execute(`SELECT r.id, r.reference_code, r.customer_id, r.customer_name, r.customer_email, r.customer_phone, r.tour_id, r.tour_name, r.travel_date, r.adults, r.children, r.status, r.currency, r.total_amount, r.notes, r.source, r.created_at, r.updated_at,
          t.status AS current_tour_status, c.status AS current_customer_status
          FROM reservations r
          LEFT JOIN tours t ON t.id = r.tour_id
          LEFT JOIN customers c ON c.id = r.customer_id
          ${clause} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      ]);

      const summary = summaryRows[0] || {};
      const filteredTotal = Number(countRows[0]?.total || 0);
      res.json({
        ok: true,
        summary: {
          total: Number(summary.total || 0),
          new: Number(summary.newCount || 0),
          confirmed: Number(summary.confirmedCount || 0),
          completed: Number(summary.completedCount || 0),
          cancelled: Number(summary.cancelledCount || 0),
          upcoming: Number(summary.upcomingCount || 0),
        },
        pagination: { page, limit, total: filteredTotal, pages: Math.max(1, Math.ceil(filteredTotal / limit)) },
        reservations: rows.map((row) => ({
          id: Number(row.id),
          referenceCode: row.reference_code,
          customerId: row.customer_id === null ? null : Number(row.customer_id),
          customerName: row.customer_name,
          customerEmail: row.customer_email,
          customerPhone: row.customer_phone,
          customerLinked: row.customer_id !== null,
          currentCustomerStatus: row.current_customer_status || null,
          tourId: row.tour_id === null ? null : Number(row.tour_id),
          tourName: row.tour_name,
          tourLinked: row.tour_id !== null,
          currentTourStatus: row.current_tour_status || null,
          travelDate: row.travel_date,
          adults: Number(row.adults),
          children: Number(row.children),
          status: row.status,
          currency: row.currency,
          totalAmount: row.total_amount === null ? null : Number(row.total_amount),
          notes: row.notes,
          source: row.source,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    } catch (error) {
      console.error('reservations_list_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar las reservas.' });
    }
  });

  app.post('/api/admin/reservations', sameOriginOnly, requireSession, async (req, res) => {
    const payload = createPayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });

    try {
      const [[customerRows], [tourRows]] = await Promise.all([
        pool.execute(`SELECT id, full_name, email, phone FROM customers WHERE id = ? AND status = 'active' LIMIT 1`, [payload.customerId]),
        pool.execute(`SELECT id, name, adult_price, child_price, currency FROM tours WHERE id = ? AND status = 'published' LIMIT 1`, [payload.tourId]),
      ]);
      if (!customerRows.length) return res.status(400).json({ error: 'Selecciona un cliente activo válido.' });
      if (!tourRows.length) return res.status(400).json({ error: 'Selecciona un tour publicado válido.' });

      const customer = customerRows[0];
      const tour = tourRows[0];
      const calculatedTotal = Number(tour.adult_price) * payload.adults + Number(tour.child_price ?? tour.adult_price) * payload.children;
      const totalAmount = payload.totalAmount === null ? calculatedTotal : payload.totalAmount;

      let code = referenceCode();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const [result] = await pool.execute(
            `INSERT INTO reservations (reference_code, customer_name, customer_email, customer_phone, customer_id, tour_id, tour_name, travel_date, adults, children, status, currency, total_amount, notes, source, created_by_admin_id, updated_by_admin_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?)`,
            [code, customer.full_name, customer.email, customer.phone, payload.customerId, payload.tourId, tour.name, payload.travelDate, payload.adults, payload.children, payload.status, tour.currency, totalAmount, payload.notes, req.admin.id, req.admin.id],
          );
          await audit(req, 'reservation_created', { userId: req.admin.id, email: req.admin.email, metadata: { reservationId: result.insertId, referenceCode: code, customerId: payload.customerId, tourId: payload.tourId } });
          return res.status(201).json({ ok: true, reservation: { id: Number(result.insertId), referenceCode: code, customerId: payload.customerId, customerName: customer.full_name, tourId: payload.tourId, tourName: tour.name } });
        } catch (error) {
          if (error?.code !== 'ER_DUP_ENTRY' || attempt === 2) throw error;
          code = referenceCode();
        }
      }
    } catch (error) {
      console.error('reservation_create_failed', error.message);
      res.status(503).json({ error: 'No fue posible crear la reserva.' });
    }
  });

  app.patch('/api/admin/reservations/:id', sameOriginOnly, requireSession, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Reserva inválida.' });

    const allowed = {};
    if (req.body.status !== undefined) {
      const status = cleanText(req.body.status, 32);
      if (!STATUSES.has(status)) return res.status(400).json({ error: 'Estado inválido.' });
      allowed.status = status;
    }
    if (req.body.notes !== undefined) allowed.notes = nullableText(req.body.notes, 4000);
    if (req.body.totalAmount !== undefined) {
      const amount = req.body.totalAmount === '' || req.body.totalAmount === null ? null : Number(req.body.totalAmount);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 9999999999.99)) return res.status(400).json({ error: 'Monto inválido.' });
      allowed.total_amount = amount;
    }
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'No hay cambios válidos.' });

    try {
      const columns = Object.keys(allowed);
      const values = columns.map((key) => allowed[key]);
      const assignments = columns.map((key) => `\`${key}\` = ?`);
      assignments.push('updated_by_admin_id = ?');
      values.push(req.admin.id, id);
      const [result] = await pool.execute(`UPDATE reservations SET ${assignments.join(', ')} WHERE id = ?`, values);
      if (!result.affectedRows) return res.status(404).json({ error: 'Reserva no encontrada.' });
      await audit(req, 'reservation_updated', { userId: req.admin.id, email: req.admin.email, metadata: { reservationId: id, fields: columns } });
      res.json({ ok: true });
    } catch (error) {
      console.error('reservation_update_failed', error.message);
      res.status(503).json({ error: 'No fue posible actualizar la reserva.' });
    }
  });
}
