require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'MediShop API' }));
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`MediShop API running on http://localhost:${PORT}`);
  console.log('Default admin: admin@medishop.com / admin123');
  console.log('Default user:  user@medishop.com / user123');
});
