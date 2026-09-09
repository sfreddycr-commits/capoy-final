// Tour gallery + watermark. Owner-only.
// - POST  /api/admin/tours/:id/gallery/upload  — multipart, multiple images, apply watermark, store.
// - PATCH /api/admin/tours/:id/gallery        — replace gallery with explicit URLs (already watermarked or external).
// - DELETE /api/admin/tours/:id/gallery/:idx — remove an image.
// - GET   /api/public/tours returns galleryImages (watermarked URLs) for the landing.

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import multer from 'multer';

const GALLERY_DIR = path.join(process.cwd(), 'uploads', 'tours', 'gallery');
fs.mkdirSync(GALLERY_DIR, { recursive: true });

// Memory storage: we read the buffer, apply the watermark, then persist.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

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
  app.post('/api/admin/tours/:id/gallery/upload', sameOriginOnly, requireSession, requireOwner, upload.array('images', 10), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Tour inválido.' });
    const files = req.files;
    if (!Array.isArray(files) || files.length === 0) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

    const [trows] = await pool.query('SELECT id FROM tours WHERE id = ? LIMIT 1', [id]);
    if (!trows.length) return res.status(404).json({ error: 'Tour no encontrado.' });

    const accepted = [];
    for (const file of files) {
      try {
        const wmBuffer = await applyWatermark(file.buffer);
        const ext = (file.originalname.match(/\.([a-zA-Z0-9]+)$/) || [])[1]?.toLowerCase() || 'jpg';
        const wmFilename = `${crypto.randomBytes(8).toString('hex')}-${Date.now().toString(36)}.${ext === 'png' ? 'jpg' : ext}`;
        const wmPath = path.join(GALLERY_DIR, wmFilename);
        await fs.promises.writeFile(wmPath, wmBuffer);
        accepted.push(`/uploads/tours/gallery/${wmFilename}`);
      } catch (err) {
        console.error('gallery_watermark_failed', err.message);
      }
    }
    if (!accepted.length) return res.status(400).json({ error: 'No se pudo procesar ninguna imagen.' });

    const [cur] = await pool.query('SELECT gallery_images, gallery_watermarked FROM tours WHERE id = ? LIMIT 1', [id]);
    let arr = cur[0]?.gallery_watermarked;
    try { arr = typeof arr === 'string' ? JSON.parse(arr) : arr; } catch { arr = null; }
    if (!Array.isArray(arr)) arr = [];
    arr.push(...accepted);
    if (arr.length > 12) arr = arr.slice(-12);

    const originals = cur[0]?.gallery_images;
    let originalsArr = typeof originals === 'string' ? JSON.parse(originals || '[]') : (Array.isArray(originals) ? originals : []);
    if (!Array.isArray(originalsArr)) originalsArr = [];
    originalsArr.push(...accepted);

    await pool.query(
      'UPDATE tours SET gallery_images = CAST(? AS JSON), gallery_watermarked = CAST(? AS JSON) WHERE id = ?',
      [JSON.stringify(originalsArr), JSON.stringify(arr), id],
    );

    await audit(req, 'tour_gallery_uploaded', {
      userId: req.admin.id, email: req.admin.email,
      metadata: { tourId: id, uploaded: accepted.length, totalImages: arr.length },
    });

    res.json({ ok: true, urls: accepted, total: arr.length, gallery: arr });
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

  // --- Admin: list gallery for a tour ---
  app.get('/api/admin/tours/:id/gallery', requireSession, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Tour inválido.' });
    try {
      const [trows] = await pool.query('SELECT gallery_watermarked FROM tours WHERE id = ? LIMIT 1', [id]);
      if (!trows.length) return res.status(404).json({ error: 'Tour no encontrado.' });
      let arr = trows[0]?.gallery_watermarked;
      try { arr = typeof arr === 'string' ? JSON.parse(arr) : arr; } catch { arr = []; }
      res.json({ ok: true, gallery: Array.isArray(arr) ? arr : [] });
    } catch (error) {
      console.error('tour_gallery_list_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar la galería.' });
    }
  });

  // --- Admin: replace a single gallery slot by index (upload file) ---
  // PUT /api/admin/tours/:id/gallery/:idx  — multipart field 'image'
  // If idx == current length, appends.
  app.put('/api/admin/tours/:id/gallery/:idx', sameOriginOnly, requireSession, requireOwner, upload.single('image'), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const idx = Number.parseInt(req.params.idx, 10);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(idx) || idx < 0 || idx > 11) {
      return res.status(400).json({ error: 'Tour o índice inválido.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    try {
      const [trows] = await pool.query('SELECT id FROM tours WHERE id = ? LIMIT 1', [id]);
      if (!trows.length) return res.status(404).json({ error: 'Tour no encontrado.' });

      let watermarkedBuffer;
      try {
        watermarkedBuffer = await applyWatermark(req.file.buffer);
      } catch (err) {
        return res.status(400).json({ error: `No se pudo procesar la imagen: ${err.message}` });
      }
      const ext = (req.file.originalname.match(/\.([a-zA-Z0-9]+)$/) || [])[1]?.toLowerCase() || 'jpg';
      const wmFilename = `${crypto.randomBytes(8).toString('hex')}-${Date.now().toString(36)}.${ext === 'png' ? 'jpg' : ext}`;
      const wmPath = path.join(GALLERY_DIR, wmFilename);
      await fs.promises.writeFile(wmPath, watermarkedBuffer);
      const publicUrl = `/uploads/tours/gallery/${wmFilename}`;

      const [cur] = await pool.query('SELECT gallery_images, gallery_watermarked FROM tours WHERE id = ? LIMIT 1', [id]);
      let arr = cur[0]?.gallery_watermarked;
      try { arr = typeof arr === 'string' ? JSON.parse(arr) : arr; } catch { arr = null; }
      if (!Array.isArray(arr)) arr = [];

      let previous = null;
      if (idx < arr.length) {
        previous = arr[idx];
        arr[idx] = publicUrl;
      } else {
        while (arr.length < idx) arr.push(null);
        arr.push(publicUrl);
      }

      // Keep symmetric original list
      let oarr = cur[0]?.gallery_images;
      try { oarr = typeof oarr === 'string' ? JSON.parse(oarr || '[]') : (Array.isArray(oarr) ? oarr : []); } catch { oarr = []; }
      if (!Array.isArray(oarr)) oarr = [];
      while (oarr.length < idx) oarr.push(null);
      if (idx < oarr.length) oarr[idx] = publicUrl; else oarr.push(publicUrl);

      await pool.query(
        'UPDATE tours SET gallery_images = CAST(? AS JSON), gallery_watermarked = CAST(? AS JSON) WHERE id = ?',
        [JSON.stringify(oarr), JSON.stringify(arr), id],
      );

      // Cleanup replaced file (best effort)
      if (previous && previous.startsWith('/uploads/tours/gallery/')) {
        fs.promises.unlink(path.join(GALLERY_DIR, path.basename(previous))).catch(() => {});
      }

      await audit(req, 'tour_gallery_slot_updated', {
        userId: req.admin.id, email: req.admin.email,
        metadata: { tourId: id, index: idx, filename: wmFilename },
      });

      res.json({ ok: true, url: publicUrl, gallery: arr });
    } catch (error) {
      console.error('tour_gallery_slot_failed', error.message);
      res.status(503).json({ error: 'No fue posible actualizar la foto.' });
    }
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
