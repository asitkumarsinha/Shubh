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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Shubh Surgical API' }));
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);

// Serve Angular production build (same origin as API) when deployed
const distCandidates = [
  path.join(__dirname, '..', 'frontend', 'dist', 'frontend', 'browser'),
  path.join(__dirname, 'public'),
];
const distPath = distCandidates.find((p) => fs.existsSync(path.join(p, 'index.html')));

if (distPath) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api(?:\/|$)|\/uploads(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.status(503).json({
      message:
        'Frontend build not found. Run: npm run build --prefix frontend  (or use ng serve on port 4200)',
    });
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Shubh Surgical running on port ${PORT}`);
  if (distPath) console.log(`Serving frontend from ${distPath}`);
  console.log('Default admin: admin@medishop.com / admin123');
  console.log('Default user:  user@medishop.com / user123');
});
