const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authenticate, BLOCKED_MESSAGE } = require('../middleware/auth');
const { recordActivity } = require('../activity');
const { limitLogin, limitRegister, loginLocked, noteLoginFailure, clearLoginFailures } = require('../security');

const router = express.Router();
const tenantForLoginEmail = db.prepare(
  `SELECT id FROM tenants
   WHERE status = 'active' AND login_initial <> '' AND ? LIKE '%' || lower(login_initial) || '%'
   ORDER BY length(login_initial) DESC LIMIT 1`
);
const userByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const userIdByEmail = db.prepare('SELECT id FROM users WHERE email = ?');
const tenantLimit = db.prepare('SELECT max_users AS max FROM tenants WHERE id = ? AND status = ?');
const clientCountStmt = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE tenant_id = ? AND role = 'user'`);
const insertUser = db.prepare(
  `INSERT INTO users (name, email, password, role, phone, address, tenant_id)
   VALUES (?, ?, ?, 'user', ?, ?, ?)`
);
const userByEmailLower = db.prepare('SELECT * FROM users WHERE lower(email) = ?');
const updatePassword = db.prepare('UPDATE users SET password = ? WHERE id = ?');
const meStmt = db.prepare(
  'SELECT id, name, email, role, phone, address, client_group, tenant_id FROM users WHERE id = ?'
);

function tenantIdForEmail(email) {
  return tenantForLoginEmail.get(email)?.id || 1;
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
  const existing = userIdByEmail.get(normalized);
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }
  const tenantId = tenantIdForEmail(normalized);
  const tenant = tenantLimit.get(tenantId, 'active');
  const clientCount = clientCountStmt.get(tenantId).count;
  if (tenant && clientCount >= tenant.max) {
    return res.status(403).json({ message: 'This store is not accepting new accounts' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = insertUser.run(name.trim(), normalized, hash, phone || '', address || '', tenantId);

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
  const row = userByEmail.get(normalized);
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
  recordActivity(req, {
    kind: 'login',
    name: user.name,
    email: user.email,
    role: user.role,
    path: '/login',
  });
  res.json({ token, user });
});

router.post('/reset-password', limitLogin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  const password = String(req.body?.password || '');
  if (!name || !email || !phone || !password.trim()) {
    return res.status(400).json({ message: 'User Name, Email ID, Mobile Number and New Password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const row = userByEmailLower.get(email);
  const sameName = row && String(row.name || '').trim().toLowerCase() === name.toLowerCase();
  const samePhone = row && String(row.phone || '').replace(/\D/g, '') === phone;
  if (!sameName || !samePhone) {
    return res.status(400).json({ message: 'User Name, Email ID and Mobile Number do not match.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  updatePassword.run(hash, row.id);
  clearLoginFailures(email);
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => {
  const row = meStmt.get(req.user.id);
  if (!row) return res.status(404).json({ message: 'User not found' });
  res.json(row);
});

module.exports = router;
