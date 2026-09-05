require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('./db');

const authRoutes = require('./routes/auth');
const medicineRoutes = require('./routes/medicines');
const orderRoutes = require('./routes/orders');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'Shubh Surgical API', hasFrontend: Boolean(resolveDistPath()) })
);
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

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
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Shubh Surgical listening on http://${HOST}:${PORT}`);
  if (distPath) console.log(`Serving frontend from ${distPath}`);
  else console.warn('WARNING: frontend build missing — site will show 404 until you run the full build + copy-frontend step');
  console.log('Default admin: admin@medishop.com / admin123');
  console.log('Default user:  user@medishop.com / user123');
});
