require('dotenv').config();
const logger = require('./logger');
const { scheduleBackups } = require('./backup');
const { securityHeaders } = require('./security');
const { JWT_SECRET } = require('./middleware/auth');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const medicineRoutes = require('./routes/medicines');
const orderRoutes = require('./routes/orders');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const employeeRoutes = require('./routes/employees');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const tenantRoutes = require('./routes/tenants');
const publicRoutes = require('./routes/public');
const db = require('./db');
const { productSlug } = require('./product-slug');
const { ensureUploadDir } = require('./uploads');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200,http://127.0.0.1:4200')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(securityHeaders);
// The architecture page is self-contained and is only ever framed by our own
// login page, so allow same-origin framing for it specifically.
app.use((req, res, next) => {
  if (req.path === '/assets/demo/mystoreshubs-architecture.html') {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(ensureUploadDir(), {
  maxAge: '7d',
  immutable: false,
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  },
}));

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'Shubh Surgical API', hasFrontend: Boolean(resolveDistPath()) })
);
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api', publicRoutes);

const PUBLIC_SITE = (process.env.PUBLIC_SITE_URL || 'https://www.mystoreshubs.com').replace(/\/$/, '');

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.get('/sitemap.xml', (_req, res) => {
  const stores = db
    .prepare(
      `SELECT slug FROM tenants
       WHERE status != 'archived' AND trim(slug) != ''
       ORDER BY name COLLATE NOCASE`
    )
    .all();
  const products = db
    .prepare(
      `SELECT m.id, m.name, t.slug AS storeSlug
       FROM medicines m
       JOIN tenants t ON t.id = m.tenant_id
       WHERE t.status != 'archived' AND trim(t.slug) != ''
       ORDER BY t.name COLLATE NOCASE, m.name COLLATE NOCASE`
    )
    .all();
  const urls = [
    `${PUBLIC_SITE}/`,
    `${PUBLIC_SITE}/demo`,
    ...stores.map((row) => `${PUBLIC_SITE}/store/${encodeURIComponent(row.slug)}`),
    ...products.map(
      (row) => `${PUBLIC_SITE}/store/${encodeURIComponent(row.storeSlug)}/${productSlug(row.name, row.id)}`
    ),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((loc) => `  <url><loc>${xmlEscape(loc)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
  res.type('application/xml').send(body);
});

function resolveDistPath() {
  const candidates = [
    // Preferred: copied next to the API for hosting portals
    path.join(__dirname, 'public'),
    // Angular 17+ application builder output
    path.join(__dirname, '..', 'frontend', 'dist', 'frontend', 'browser'),
    path.join(__dirname, '..', 'frontend', 'dist', 'frontend'),
    path.join(__dirname, '..', 'frontend', 'dist', 'browser'),
  ];
  return candidates.find((p) => fs.existsSync(path.join(p, 'index.html'))) || null;
}

const distPath = resolveDistPath();

if (distPath) {
  app.use(express.static(distPath, { index: false }));

  // SPA fallback — keep API and uploads untouched
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
} else {
  app.get('/', (_req, res) => {
    res.status(404).type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Shubh Surgical</title></head>
<body style="font-family:system-ui;padding:2rem;max-width:40rem">
  <h1>Frontend build not found (404)</h1>
  <p>The API is running, but the Angular build was not deployed.</p>
  <p>On the host, use this <strong>Build Command</strong>:</p>
  <pre style="background:#f4f4f5;padding:1rem;overflow:auto">npm install --prefix backend &amp;&amp; npm install --prefix frontend &amp;&amp; npm run build --prefix frontend &amp;&amp; node scripts/copy-frontend.js</pre>
  <p>And this <strong>Start Command</strong>:</p>
  <pre style="background:#f4f4f5;padding:1rem">node backend/server.js</pre>
  <p>Root directory must be the <strong>repository root</strong> (not <code>backend/</code>).</p>
</body></html>`);
  });
}

app.use((err, _req, res, _next) => {
  const status = Number(err.status) || 500;
  logger.error('request failed', { message: err.message, status });
  res.status(status >= 400 && status < 600 ? status : 500).json({
    message: status >= 500 ? 'Server error' : err.message || 'Request failed',
  });
});

if (require.main === module) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'medishop-secret-key-2026') {
    if (process.env.NODE_ENV === 'production') {
      logger.error('JWT_SECRET must be set to a private value');
      process.exit(1);
    }
    logger.warn('JWT_SECRET is still the default. Set a private value before hosting.');
  } else if (JWT_SECRET.length < 16) {
    logger.warn('JWT_SECRET is very short');
  }
  scheduleBackups(db);
  app.listen(PORT, HOST, () => {
    logger.info('API listening', { host: HOST, port: PORT, frontend: Boolean(distPath) });
    if (!distPath) logger.warn('frontend build missing');
  });
}

module.exports = app;
