import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '../dist');

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  let database = 'not-configured';
  try {
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME) {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || process.env.DB_PASS,
        database: process.env.DB_NAME,
        connectTimeout: 3000,
      });
      await connection.query('SELECT 1');
      await connection.end();
      database = 'ok';
    }
  } catch {
    database = 'error';
  }

  res.status(database === 'error' ? 503 : 200).json({
    status: database === 'error' ? 'degraded' : 'ok',
    service: 'capoy-final',
    database,
  });
});

app.use(express.static(dist, { index: false, maxAge: '1h' }));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(port, '0.0.0.0', () => {
  console.log(`Capoy listening on ${port}`);
});
