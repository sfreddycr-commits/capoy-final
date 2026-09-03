import crypto from 'node:crypto';
import { registerTourRoutes } from './tours.js';

const STATUSES = new Set(['new', 'contacted', 'quoted', 'confirmed', 'completed', 'cancelled']);

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

function referenceCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `CAP-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function createPayload(body) {
  const customerName = cleanText(body?.customerName, 120);
  const customerEmail = normalizeEmail(body?.customerEmail);
  const customerPhone = cleanText(body?.customerPhone, 40);
  const tourName = cleanText(body?.tourName, 180);
  const travelDate = cleanText(body?.travelDate, 10);
  const adults = Number(body?.adults ?? 1);
  const children = Number(body?.children ?? 0);
  const status = cleanText(body?.status || 'new', 32);
  const currency = cleanText(body?.currency || 'USD', 3).toUpperCase();
  const rawAmount = body?.totalAmount;
  const totalAmount = rawAmount === '' || rawAmount === null || rawAmount === undefined ? null : Number(rawAmount);
  const notes = nullableText(body?.notes, 4000);

  if (customerName.length < 2 || tourName.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return { error: 'Nombre, tour y fecha son obligatorios.' };
  if (customerEmail && !validEmail(customerEmail)) return { error: 'Correo inválido.' };
  if (!customerEmail && customerPhone.length < 5) return { error: 'Debe indicar correo o teléfono.' };
  if (!Number.isInteger(adults) || adults < 1 || adults > 99 || !Number.isInteger(children) || children < 0 || children > 99) return { error: 'Cantidad de pasajeros inválida.' };
  if (!STATUSES.has(status)) return { error: 'Estado de reserva inválido.' };
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Moneda inválida.' };
  if (totalAmount !== null && (!Number.isFinite(totalAmount) || totalAmount < 0 || totalAmount > 9999999999.99)) return { error: 'Monto inválido.' };

  return {
    customerName,
    customerEmail: customerEmail || null,
    customerPhone: customerPhone || null,
    tourName,
    travelDate,
    adults,
    children,
    status,
    currency,
    totalAmount,
    notes,
  };
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
        where.push('status = ?');
        params.push(status);
      }
      if (q) {
        where.push('(reference_code LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ? OR tour_name LIKE ?)');
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
        pool.execute(`SELECT COUNT(*) AS total FROM reservations ${clause}`, params),
        pool.execute(`SELECT id, reference_code, customer_name, customer_email, customer_phone, tour_name, travel_date, adults, children, status, currency, total_amount, notes, source, created_at, updated_at
          FROM reservations ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
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
          customerName: row.customer_name,
          customerEmail: row.customer_email,
          customerPhone: row.customer_phone,
          tourName: row.tour_name,
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
      let code = referenceCode();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const [result] = await pool.execute(
            `INSERT INTO reservations (reference_code, customer_name, customer_email, customer_phone, tour_name, travel_date, adults, children, status, currency, total_amount, notes, source, created_by_admin_id, updated_by_admin_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?)`,
            [code, payload.customerName, payload.customerEmail, payload.customerPhone, payload.tourName, payload.travelDate, payload.adults, payload.children, payload.status, payload.currency, payload.totalAmount, payload.notes, req.admin.id, req.admin.id],
          );
          await audit(req, 'reservation_created', { userId: req.admin.id, email: req.admin.email, metadata: { reservationId: result.insertId, referenceCode: code } });
          return res.status(201).json({ ok: true, reservation: { id: Number(result.insertId), referenceCode: code } });
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
