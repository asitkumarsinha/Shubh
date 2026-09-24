const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authenticate, BLOCKED_MESSAGE } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password, role, phone, address)
       VALUES (?, ?, ?, 'user', ?, ?)`
    )
    .run(name, email.toLowerCase(), hash, phone || '', address || '');

  const user = { id: result.lastInsertRowid, name, email: email.toLowerCase(), role: 'user' };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
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
    client_group: row.client_group === 'wholesale' ? 'wholesale' : 'retail',
  };
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user });
});

router.get('/me', authenticate, (req, res) => {
  const row = db
    .prepare('SELECT id, name, email, role, phone, address, client_group FROM users WHERE id = ?')
    .get(req.user.id);
  if (!row) return res.status(404).json({ message: 'User not found' });
  res.json(row);
});

module.exports = router;
