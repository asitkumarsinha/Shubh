const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'medishop-secret-key-2026';
const BLOCKED_MESSAGE = 'User is blocked now, please contact to admin';

function optionalUser(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id) || null;
  } catch {
    return null;
  }
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    const row = db.prepare('SELECT status, tenant_id FROM users WHERE id = ?').get(req.user.id);
    if (!row) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    if (row.status === 'blocked') {
      return res.status(403).json({ message: BLOCKED_MESSAGE });
    }
    if (req.user.role !== 'super_admin') {
      const tenant = db.prepare('SELECT status FROM tenants WHERE id = ?').get(row.tenant_id);
      if (!tenant || tenant.status !== 'active') {
        return res.status(403).json({ message: 'This customer account is not active. Please contact support.' });
      }
      req.user.tenant_id = row.tenant_id;
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

function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }
  next();
}

function requireModule(name) {
  return (req, res, next) => {
    const tenant = db.prepare('SELECT modules FROM tenants WHERE id = ?').get(req.user?.tenant_id);
    let modules = {};
    try {
      modules = JSON.parse(tenant?.modules || '{}');
    } catch {
      modules = {};
    }
    if (!modules[name]) {
      return res.status(403).json({ message: `The ${name} module is not enabled for this customer` });
    }
    next();
  };
}

function requireTenantLimit(resource, table) {
  return (req, res, next) => {
    const tenant = db.prepare(`SELECT max_${resource} AS max FROM tenants WHERE id = ?`).get(req.user?.tenant_id);
    const count = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE tenant_id = ?`).get(req.user?.tenant_id).count;
    if (tenant && count >= tenant.max) {
      return res.status(403).json({ message: `This customer has reached its ${resource} plan limit` });
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  requireModule,
  requireTenantLimit,
  JWT_SECRET,
  BLOCKED_MESSAGE,
  optionalUser,
};
