const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pageQuery } = require('../paging');

const router = express.Router();

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone || '',
    address: row.address || '',
    created_at: row.created_at,
    orderCount: Number(row.orderCount) || 0,
    totalSpent: Number(row.totalSpent) || 0,
    lastOrderAt: row.lastOrderAt || null,
    status: row.status === 'blocked' ? 'blocked' : 'allowed',
    client_group: row.client_group === 'wholesale' ? 'wholesale' : 'retail',
    notes: row.notes || '',
    password: '••••••••',
    passwordEncrypted: true,
  };
}

const LIST_SELECT = `SELECT u.id, u.name, u.email, u.role, u.phone, u.address, u.created_at, u.status,
                         u.client_group, u.notes,
                         COUNT(o.id) AS orderCount,
                         COALESCE(SUM(o.total), 0) AS totalSpent,
                         MAX(o.created_at) AS lastOrderAt
                  FROM users u
                  LEFT JOIN orders o ON o.user_id = u.id
                  WHERE u.tenant_id = ?`;
const LIST_SQL = `${LIST_SELECT} GROUP BY u.id`;

router.get('/', authenticate, requireAdmin, (req, res) => {
  const tenantId = req.user.tenant_id;
  const { page, limit, offset, q, like } = pageQuery(req, 20);
  const search = `(? = '' OR u.name LIKE ? COLLATE NOCASE OR u.email LIKE ? COLLATE NOCASE OR IFNULL(u.phone, '') LIKE ? COLLATE NOCASE)`;
  const clientWhere = `u.tenant_id = ? AND u.role = 'user' AND ${search}`;
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM users u WHERE ${clientWhere}`)
    .get(tenantId, q, like, like, like).count;
  const users = db
    .prepare(`${LIST_SELECT} AND u.role = 'user' AND ${search} GROUP BY u.id ORDER BY u.name COLLATE NOCASE LIMIT ? OFFSET ?`)
    .all(tenantId, q, like, like, like, limit, offset)
    .map(mapUser);
  const topUsers = db
    .prepare(`${LIST_SELECT} AND u.role = 'user' GROUP BY u.id ORDER BY orderCount DESC, totalSpent DESC LIMIT 5`)
    .all(tenantId)
    .map((row, index) => ({ ...mapUser(row), rank: index + 1 }));
  const counts = db
    .prepare(
      `SELECT
         SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS totalUsers,
         SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS totalAdmins,
         SUM(CASE WHEN role = 'user' AND status = 'blocked' THEN 1 ELSE 0 END) AS blockedUsers,
         SUM(CASE WHEN role = 'user' AND client_group = 'wholesale' THEN 1 ELSE 0 END) AS wholesaleClients,
         SUM(CASE WHEN role = 'user' AND client_group != 'wholesale' THEN 1 ELSE 0 END) AS retailClients
       FROM users WHERE tenant_id = ?`
    )
    .get(tenantId);
  const usersWithOrders = db
    .prepare(
      `SELECT COUNT(DISTINCT u.id) AS count
       FROM users u JOIN orders o ON o.user_id = u.id
       WHERE u.tenant_id = ? AND u.role = 'user'`
    )
    .get(tenantId).count;

  res.json({
    users,
    topUsers,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary: {
      totalUsers: Number(counts.totalUsers) || 0,
      totalAdmins: Number(counts.totalAdmins) || 0,
      usersWithOrders,
      blockedUsers: Number(counts.blockedUsers) || 0,
      retailClients: Number(counts.retailClients) || 0,
      wholesaleClients: Number(counts.wholesaleClients) || 0,
    },
  });
});

router.get('/export', authenticate, requireAdmin, (req, res) => {
  const exportSql = `SELECT u.id, u.name, u.email, u.role, u.phone, u.address, u.created_at, u.status,
                            u.client_group, u.notes,
                            COUNT(o.id) AS orderCount,
                            COALESCE(SUM(o.total), 0) AS totalSpent,
                            MAX(o.created_at) AS lastOrderAt
                     FROM users u
                     LEFT JOIN orders o ON o.user_id = u.id
                     WHERE u.role = 'user' AND u.tenant_id = ?
                     GROUP BY u.id
                     ORDER BY u.name COLLATE NOCASE`;
  const rows = db.prepare(exportSql).all(req.user.tenant_id).map(mapUser);

  const header = [
    'Name',
    'Email',
    'Phone',
    'Address',
    'Group',
    'Access',
    'Orders',
    'Total spent',
    'Last order',
    'Joined',
    'Notes',
  ];
  const lines = [header.join(',')];
  for (const u of rows) {
    lines.push(
      [
        csvCell(u.name),
        csvCell(u.email),
        csvCell(u.phone),
        csvCell(u.address),
        csvCell(u.client_group),
        csvCell(u.status),
        csvCell(u.orderCount),
        csvCell(Number(u.totalSpent).toFixed(2)),
        csvCell(u.lastOrderAt || ''),
        csvCell(u.created_at || ''),
        csvCell(u.notes),
      ].join(',')
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="clients-${stamp}.csv"`);
  res.send(`\uFEFF${lines.join('\n')}`);
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');
  const phone = String(req.body?.phone || '').trim();
  const address = String(req.body?.address || '').trim();
  const group = req.body?.client_group === 'wholesale' ? 'wholesale' : 'retail';

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const tenant = db.prepare('SELECT max_users AS max FROM tenants WHERE id = ?').get(req.user.tenant_id);
  const clientCount = db
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE tenant_id = ? AND role = 'user'`)
    .get(req.user.tenant_id).c;
  if (tenant && clientCount >= tenant.max) {
    return res.status(403).json({ message: 'This store has reached its client plan limit' });
  }

  const result = db
    .prepare(
      `INSERT INTO users (name, email, password, role, phone, address, client_group, tenant_id)
       VALUES (?, ?, ?, 'user', ?, ?, ?, ?)`
    )
    .run(name, email, bcrypt.hashSync(password, 10), phone, address, group, req.user.tenant_id);

  const created = db.prepare(`${LIST_SQL} HAVING u.id = ?`).get(req.user.tenant_id, result.lastInsertRowid);
  res.status(201).json(mapUser(created));
});

router.get('/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`${LIST_SQL} HAVING u.id = ?`).get(req.user.tenant_id, id);
  if (!row || row.role === 'admin') return res.status(404).json({ message: 'Client not found' });
  const client = mapUser(row);
  const orders = db
    .prepare(
      `SELECT id, bill_number, po_number, total, status, created_at
       FROM orders
       WHERE user_id = ? AND tenant_id = ?
       ORDER BY datetime(created_at) DESC`
    )
    .all(id, req.user.tenant_id);
  res.json({ client, orders });
});

router.patch('/:id/status', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status === 'blocked' ? 'blocked' : req.body?.status === 'allowed' ? 'allowed' : null;
  if (!id || !status) {
    return res.status(400).json({ message: 'Status must be allowed or blocked' });
  }

  const target = db.prepare('SELECT id, role, status FROM users WHERE id = ? AND tenant_id = ?').get(id, req.user.tenant_id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (target.role === 'admin') {
    return res.status(400).json({ message: 'Admin accounts cannot be blocked' });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ message: 'You cannot change your own status' });
  }

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  const updated = db.prepare(`${LIST_SQL} HAVING u.id = ?`).get(req.user.tenant_id, id);
  res.json(mapUser(updated));
});

router.patch('/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(id, req.user.tenant_id);
  if (!target) return res.status(404).json({ message: 'Client not found' });
  if (target.role === 'admin') {
    return res.status(400).json({ message: 'Admin profiles cannot be edited here' });
  }

  let group = target.client_group === 'wholesale' ? 'wholesale' : 'retail';
  if (req.body?.client_group != null) {
    if (req.body.client_group !== 'retail' && req.body.client_group !== 'wholesale') {
      return res.status(400).json({ message: 'Group must be retail or wholesale' });
    }
    group = req.body.client_group;
  }
  const notes = req.body?.notes !== undefined ? String(req.body.notes) : target.notes || '';
  const password = req.body?.password != null ? String(req.body.password) : '';

  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET client_group = ?, notes = ?, password = ? WHERE id = ?').run(
      group,
      notes,
      hash,
      id
    );
  } else {
    db.prepare('UPDATE users SET client_group = ?, notes = ? WHERE id = ?').run(group, notes, id);
  }
  const updated = db.prepare(`${LIST_SQL} HAVING u.id = ?`).get(req.user.tenant_id, id);
  res.json(mapUser(updated));
});

module.exports = router;
