// One-shot UTF-8 mojibake repair endpoint. Owner-only. Idempotent.
// Repairs historical data incorrectly stored as latin1 (which MySQL interprets
// as UTF-8 in the app's connection), leaving "Ã¡", "CÃ³", etc. instead of
// "á", "ó". Recovers from the misencoded layer without data loss.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function registerMaintenanceRoutes({ app, pool, requireSession }) {
  app.post('/api/admin/maintenance/fix-utf8', requireSession, async (req, res) => {
    // Owner-only guard.
    if (req.admin?.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario puede ejecutar esta acción.' });
    }

    const tables = [
      ['cms_settings', ['setting_value'], 'setting_key'],
      ['app_settings', ['setting_value'], 'setting_key'],
      ['tours', ['name', 'destination', 'short_description', 'description', 'duration'], 'id'],
      ['customers', ['full_name', 'phone', 'country', 'city', 'notes'], 'id'],
      ['providers', ['name', 'contact_name', 'phone', 'address', 'notes'], 'id'],
      ['fleet', ['plate', 'brand', 'model', 'capacity_label', 'driver_name', 'driver_phone', 'notes'], 'id'],
      ['reviews', ['author_name', 'author_country', 'title', 'body'], 'id'],
      ['reservations', ['customer_name', 'notes'], 'id'],
      ['admin_users', ['display_name'], 'id'],
    ];

    const fixCol = (val) => {
      if (val === null || val === undefined) return null;
      if (/[Ã]/.test(val) && /[¡-¿]/.test(val)) {
        try {
          const decoded = Buffer.from(val, 'binary').toString('utf-8');
          if (!decoded.includes('\uFFFD') && decoded !== val) return decoded;
        } catch { /* ignore */ }
      }
      return val;
    };

    const report = { fixedRows: 0, errors: [], perTable: {} };
    for (const [table, cols, pkCol] of tables) {
      report.perTable[table] = 0;
      try {
        const selectCols = [pkCol, ...cols].join(',');
        const [rows] = await pool.query(`SELECT ${selectCols} FROM ${table}`);
        for (const row of rows) {
          const updates = {};
          for (const c of cols) {
            if (row[c] !== null && row[c] !== undefined) {
              const fixed = fixCol(row[c]);
              if (fixed !== row[c]) updates[c] = fixed;
            }
          }
          if (Object.keys(updates).length) {
            const sets = Object.keys(updates).map(k => `\`${k}\` = ?`).join(', ');
            await pool.query(`UPDATE \`${table}\` SET ${sets} WHERE \`${pkCol}\` = ?`, [...Object.values(updates), row[pkCol]]);
            report.fixedRows++;
            report.perTable[table]++;
          }
        }
      } catch (error) {
        report.errors.push(`${table}: ${error.message}`);
      }
    }
    res.json({ ok: report.errors.length === 0, ...report });
  });
}
