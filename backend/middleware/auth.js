const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'medishop-secret-key-2026';
const BLOCKED_MESSAGE = 'User is blocked now, please contact to admin';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    const row = db.prepare('SELECT status FROM users WHERE id = ?').get(req.user.id);
    if (!row) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    if (row.status === 'blocked') {
      return res.status(403).json({ message: BLOCKED_MESSAGE });
    }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, JWT_SECRET, BLOCKED_MESSAGE };
