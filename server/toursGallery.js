// Tour gallery + watermark. Owner-only.
// - POST  /api/admin/tours/:id/gallery/upload  — multipart, multiple images, apply watermark, store.
// - PATCH /api/admin/tours/:id/gallery        — replace gallery with explicit URLs (already watermarked or external).
// - DELETE /api/admin/tours/:id/gallery/:idx — remove an image.
// - GET   /api/public/tours returns galleryImages (watermarked URLs) for the landing.

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';

const GALLERY_DIR = path.join(process.cwd(), 'uploads', 'tours', 'gallery');
fs.mkdirSync(GALLERY_DIR, { recursive: true });

const WATERMARK_TEXT = 'Capoy Costa Rica';

// Compose a watermark layer using sharp (no ImageMagick / no extra system deps).
// - 1200px wide
// - Diagonal repeating "Capoy Costa Rica" text + bottom-right logo-style text
async function applyWatermark(srcBuffer) {
  const meta = await sharp(srcBuffer).metadata();
  const W = Math.min(meta.width || 1200, 1600);
  const ratio = W / (meta.width || 1200);
  const H = Math.round((meta.height || 800) * ratio);

  const img = await sharp(srcBuffer).resize(W, H, { fit: 'inside' }).toBuffer();

  // Diagonal repeating watermark (every ~260px horizontally + vertically)
  const textSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <pattern id="wm" patternUnits="userSpaceOnUse" width="320" height="220" patternTransform="rotate(-22)">
      <text x="0" y="120" font-family="Montserrat, system-ui, sans-serif" font-size="22" font-weight="700" fill="rgba(255,255,255,0.32)" stroke="rgba(0,0,0,0.18)" stroke-width="0.5">${WATERMARK_TEXT}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)"/>
</svg>`;
  const textOverlay = await sharp(Buffer.from(textSvg)).png().toBuffer();

  // Bottom-right solid badge
  const badgeW = Math.min(420, Math.round(W * 0.45));
  const badgeH = Math.round(badgeW * 0.18);
  const badgeSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${badgeW}" height="${badgeH}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgba(11,90,53,0.92)"/>
      <stop offset="1" stop-color="rgba(11,90,53,0.65)"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)" rx="14"/>
  <text x="20" y="${Math.round(badgeH * 0.7)}" font-family="Montserrat, system-ui, sans-serif" font-size="${Math.round(badgeH * 0.45)}" font-weight="800" fill="#fff">${WATERMARK_TEXT}</text>
</svg>`;
  const badgeOverlay = await sharp(Buffer.from(badgeSvg)).png().toBuffer();

  const composited = await sharp(img)
    .composite([
      { input: textOverlay, gravity: 'center' },
      { input: badgeOverlay, gravity: 'southeast' },
    ])
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer();

  return composited;
}

// Convert https://… URL → Buffer (no external http client lib required)
// Use fetch (built-in Node 20+).
async function urlToBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

export function registerGalleryRoutes({ app, pool, requireSession, sameOriginOnly, audit, requireOwner }) {
  // --- Public: enhance /api/public/tours response with gallery_images -- already returned, ensure array
  // Done in server/tours.js mapPublicTour

  // --- Admin: upload one or more image files for a tour (with watermark) ---
  app.post('/api/admin/tours/:id/gallery/upload', sameOriginOnly, requireSession, requireOwner, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Tour inválido.' });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

    const [trows] = await pool.query('SELECT id FROM tours WHERE id = ? LIMIT 1', [id]);
    if (!trows.length) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Tour no encontrado.' });
    }

    let watermarkedBuffer;
    try {
      const src = await fs.promises.readFile(req.file.path);
      watermarkedBuffer = await applyWatermark(src);
    } catch (err) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `No se pudo procesar la imagen: ${err.message}` });
    }

    const wmFilename = `${crypto.randomBytes(8).toString('hex')}-${req.file.filename.replace(/\.[^.]+$/, '')}.jpg`;
    const wmPath = path.join(GALLERY_DIR, wmFilename);
    await fs.promises.writeFile(wmPath, watermarkedBuffer);
    fs.unlinkSync(req.file.path);

    const publicUrl = `/uploads/tours/gallery/${wmFilename}`;

    const [cur] = await pool.query('SELECT gallery_images, gallery_watermarked FROM tours WHERE id = ? LIMIT 1', [id]);
    let arr = cur[0]?.gallery_watermarked;
    try { arr = typeof arr === 'string' ? JSON.parse(arr) : arr; } catch { arr = null; }
    if (!Array.isArray(arr)) arr = [];
    arr.push(publicUrl);
    if (arr.length > 12) arr = arr.slice(-12);

    // Track the original URL too for audit
    const originals = typeof cur[0]?.gallery_images === 'string' ? JSON.parse(cur[0].gallery_images || '[]') : (cur[0]?.gallery_images || []);
    if (Array.isArray(originals)) originals.push(`/uploads/tours/gallery-originals/${req.file.filename}`);
    await pool.query(
      'UPDATE tours SET gallery_images = CAST(? AS JSON), gallery_watermarked = CAST(? AS JSON) WHERE id = ?',
      [JSON.stringify(originals || []), JSON.stringify(arr), id],
    );

    await audit(req, 'tour_gallery_uploaded', {
      userId: req.admin.id, email: req.admin.email,
      metadata: { tourId: id, filename: wmFilename, totalImages: arr.length },
    });

    res.json({ ok: true, url: publicUrl, total: arr.length, gallery: arr });
  });

  // --- Admin: replace full gallery with explicit URLs. If the URL is external (not /uploads/),
  //     we download it, apply the watermark, store locally, and store the new local URL.
  app.patch('/api/admin/tours/:id/gallery', sameOriginOnly, requireSession, requireOwner, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Tour inválido.' });
    const incoming = req.body?.gallery;
    if (!Array.isArray(incoming)) return res.status(400).json({ error: 'gallery debe ser un array.' });
    if (incoming.length > 12) return res.status(400).json({ error: 'Máximo 12 imágenes por tour.' });
    for (const u of incoming) {
      if (typeof u !== 'string' || !/^https?:\/\//i.test(u)) return res.status(400).json({ error: 'Cada imagen debe ser una URL http(s) válida.' });
    }
    const [trows] = await pool.query('SELECT id FROM tours WHERE id = ? LIMIT 1', [id]);
    if (!trows.length) return res.status(404).json({ error: 'Tour no encontrado.' });

    // Process: download + watermark any URL that is not already a local /uploads/...
    const finalUrls = [];
    const originals = [];
    for (const u of incoming) {
      if (u.startsWith('/uploads/')) {
        finalUrls.push(u);
        originals.push(u);
        continue;
      }
      try {
        const buf = await urlToBuffer(u);
        const wmBuf = await applyWatermark(buf);
        const fname = `${crypto.randomBytes(8).toString('hex')}-wm.jpg`;
        const fpath = path.join(GALLERY_DIR, fname);
        await fs.promises.writeFile(fpath, wmBuf);
        finalUrls.push(`/uploads/tours/gallery/${fname}`);
        originals.push(u);
      } catch (err) {
        // If we can't process, skip but log
        console.error('gallery_process_failed', u, err.message);
      }
    }
    await pool.query(
      'UPDATE tours SET gallery_images = CAST(? AS JSON), gallery_watermarked = CAST(? AS JSON) WHERE id = ?',
      [JSON.stringify(originals), JSON.stringify(finalUrls), id],
    );
    await audit(req, 'tour_gallery_updated', {
      userId: req.admin.id, email: req.admin.email,
      metadata: { tourId: id, totalImages: finalUrls.length },
    });
    res.json({ ok: true, gallery: finalUrls });
  });

  // --- Admin: delete a single gallery image by index ---
  app.delete('/api/admin/tours/:id/gallery/:idx', sameOriginOnly, requireSession, requireOwner, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const idx = Number.parseInt(req.params.idx, 10);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: 'Tour o índice inválido.' });
    }
    const [trows] = await pool.query('SELECT gallery_watermarked FROM tours WHERE id = ? LIMIT 1', [id]);
    if (!trows.length) return res.status(404).json({ error: 'Tour no encontrado.' });
    let arr = trows[0]?.gallery_watermarked;
    try { arr = typeof arr === 'string' ? JSON.parse(arr) : arr; } catch { arr = []; }
    if (!Array.isArray(arr) || idx >= arr.length) return res.status(404).json({ error: 'Índice fuera de rango.' });
    const removed = arr.splice(idx, 1)[0];
    await pool.query('UPDATE tours SET gallery_watermarked = CAST(? AS JSON) WHERE id = ?', [JSON.stringify(arr), id]);
    // Best-effort filesystem cleanup if the URL points to our uploads dir
    if (removed && removed.startsWith('/uploads/tours/gallery/')) {
      const fp = path.join(GALLERY_DIR, path.basename(removed));
      fs.promises.unlink(fp).catch(() => {});
    }
    await audit(req, 'tour_gallery_image_removed', {
      userId: req.admin.id, email: req.admin.email,
      metadata: { tourId: id, index: idx },
    });
    res.json({ ok: true, gallery: arr });
  });
}
