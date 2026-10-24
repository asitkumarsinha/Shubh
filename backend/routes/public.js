const express = require('express');
const db = require('../db');
const { authenticate, requireSuperAdmin, optionalUser } = require('../middleware/auth');
const { recordActivity, listActivity } = require('../activity');

const router = express.Router();
const bumpHits = db.prepare(
  `UPDATE site_hits SET count = count + 1, updated_at = datetime('now') WHERE id = 1`
);
const hitCount = db.prepare('SELECT count FROM site_hits WHERE id = 1');
const hitRow = db.prepare('SELECT count, updated_at FROM site_hits WHERE id = 1');

router.post('/hits', (req, res) => {
  bumpHits.run();
  const user = optionalUser(req);
  recordActivity(req, {
    kind: 'visit',
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
    path: req.body?.path || '',
  });
  const row = hitCount.get();
  res.json({ count: row?.count || 0 });
});

router.get('/hits', authenticate, requireSuperAdmin, (_req, res) => {
  const row = hitRow.get();
  res.json({ count: row?.count || 0, updated_at: row?.updated_at || null });
});

router.get('/hits/details', authenticate, requireSuperAdmin, async (_req, res) => {
  res.json(await listActivity());
});

router.post('/logs', (req, res) => {
  const page = String(req.body?.path || '');
  if (!page.startsWith('/') || page.startsWith('/api')) {
    return res.status(400).json({ message: 'Page path is required' });
  }
  const user = optionalUser(req);
  recordActivity(req, {
    kind: 'page',
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
    path: page,
  });
  res.status(204).end();
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

router.post('/contact', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const message = String(req.body?.remark || '').trim();
  if (!name || !email || !phone || message.length < 2) {
    return res.status(400).json({ message: 'Name, email, mobile number and remark are required' });
  }
  const result = db.prepare(
    `INSERT INTO site_feedback (name, email, phone, message, kind) VALUES (?, ?, ?, ?, 'contact')`
  ).run(name, email, phone, message);
  res.status(201).json(db.prepare('SELECT * FROM site_feedback WHERE id = ?').get(result.lastInsertRowid));
});

const listFeedbackStmt = db.prepare(
  'SELECT * FROM site_feedback ORDER BY created_at DESC, id DESC LIMIT 500'
);
const feedbackById = db.prepare('SELECT * FROM site_feedback WHERE id = ?');
const setFeedbackStatusStmt = db.prepare('UPDATE site_feedback SET status = ? WHERE id = ?');

router.get('/feedback', authenticate, requireSuperAdmin, (_req, res) => {
  res.json(listFeedbackStmt.all());
});

router.patch('/feedback/:id', authenticate, requireSuperAdmin, (req, res) => {
  const status = String(req.body?.status || '').toLowerCase();
  if (!['done', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'Action must be Done or Pending' });
  }
  const id = Number(req.params.id);
  const result = setFeedbackStatusStmt.run(status, id);
  if (!result.changes) return res.status(404).json({ message: 'Request not found' });
  res.json(feedbackById.get(id));
});

module.exports = router;
