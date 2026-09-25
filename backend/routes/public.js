const express = require('express');
const db = require('../db');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/hits', (_req, res) => {
  db.prepare(
    `UPDATE site_hits SET count = count + 1, updated_at = datetime('now') WHERE id = 1`
  ).run();
  const row = db.prepare('SELECT count FROM site_hits WHERE id = 1').get();
  res.json({ count: row?.count || 0 });
});

router.get('/hits', authenticate, requireSuperAdmin, (_req, res) => {
  const row = db.prepare('SELECT count, updated_at FROM site_hits WHERE id = 1').get();
  res.json({ count: row?.count || 0, updated_at: row?.updated_at || null });
});

router.post('/feedback', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const message = String(req.body?.message || '').trim();
  if (message.length < 8) {
    return res.status(400).json({ message: 'Please write at least 8 characters of feedback' });
  }
  const result = db.prepare(
    'INSERT INTO site_feedback (name, email, message) VALUES (?, ?, ?)'
  ).run(name, email, message);
  res.status(201).json(db.prepare('SELECT * FROM site_feedback WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/feedback', authenticate, requireSuperAdmin, (_req, res) => {
  res.json(
    db.prepare('SELECT * FROM site_feedback ORDER BY datetime(created_at) DESC LIMIT 500').all()
  );
});

module.exports = router;
