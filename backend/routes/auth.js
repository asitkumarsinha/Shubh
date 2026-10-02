const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authenticate, BLOCKED_MESSAGE } = require('../middleware/auth');
const { limitLogin, limitRegister, loginLocked, noteLoginFailure, clearLoginFailures } = require('../security');

const router = express.Router();

function tenantIdForEmail(email) {
  const match = db.prepare(
    `SELECT id FROM tenants
     WHERE status = 'active' AND login_initial <> '' AND ? LIKE '%' || lower(login_initial) || '%'
     ORDER BY length(login_initial) DESC LIMIT 1`
  ).get(email);
  return match?.id || 1;
}

router.post('/register', limitRegister, (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  const normalized = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return res.status(400).json({ message: 'Enter a valid email address' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }
  const tenantId = tenantIdForEmail(normalized);
  const tenant = db.prepare('SELECT max_users AS max FROM tenants WHERE id = ? AND status = ?').get(tenantId, 'active');
  const clientCount = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE tenant_id = ? AND role = 'user'`).get(tenantId).count;
  if (tenant && clientCount >= tenant.max) {
    return res.status(403).json({ message: 'This store is not accepting new accounts' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password, role, phone, address, tenant_id)
       VALUES (?, ?, ?, 'user', ?, ?, ?)`
    )
    .run(name.trim(), normalized, hash, phone || '', address || '', tenantId);

  const user = { id: result.lastInsertRowid, name: name.trim(), email: normalized, role: 'user', tenant_id: tenantId };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user });
});

router.post('/login', limitLogin, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  const normalized = String(email).trim().toLowerCase();
  if (loginLocked(normalized)) {
    return res.status(429).json({ message: 'Too many sign-in attempts. Try again later.' });
  }
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
  if (!row || !bcrypt.compareSync(password, row.password)) {
    noteLoginFailure(normalized);
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  clearLoginFailures(normalized);
  if (row.status === 'blocked') {
    return res.status(403).json({ message: BLOCKED_MESSAGE });
  }
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    address: row.address,
    tenant_id: row.tenant_id,
    client_group: row.client_group === 'wholesale' ? 'wholesale' : 'retail',
  };
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: user.tenant_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user });
});

router.get('/me', authenticate, (req, res) => {
  const row = db
    .prepare('SELECT id, name, email, role, phone, address, client_group, tenant_id FROM users WHERE id = ?')
    .get(req.user.id);
  if (!row) return res.status(404).json({ message: 'User not found' });
  res.json(row);
});

module.exports = router;
