const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

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

const LIST_SQL = `SELECT u.id, u.name, u.email, u.role, u.phone, u.address, u.created_at, u.status,
                         u.client_group, u.notes,
                         COUNT(o.id) AS orderCount,
                         COALESCE(SUM(o.total), 0) AS totalSpent,
                         MAX(o.created_at) AS lastOrderAt
                  FROM users u
                  LEFT JOIN orders o ON o.user_id = u.id
                  GROUP BY u.id`;

router.get('/', authenticate, requireAdmin, (_req, res) => {
  const users = db.prepare(`${LIST_SQL} ORDER BY datetime(u.created_at) DESC`).all().map(mapUser);
  const clients = users.filter((u) => u.role === 'user');
  const topUsers = [...clients]
    .sort((a, b) => b.orderCount - a.orderCount || b.totalSpent - a.totalSpent)
    .slice(0, 5)
    .map((u, i) => ({ ...u, rank: i + 1 }));

  res.json({
    users,
    topUsers,
    summary: {
      totalUsers: clients.length,
      totalAdmins: users.filter((u) => u.role === 'admin').length,
      usersWithOrders: clients.filter((u) => u.orderCount > 0).length,
      blockedUsers: clients.filter((u) => u.status === 'blocked').length,
      retailClients: clients.filter((u) => u.client_group === 'retail').length,
      wholesaleClients: clients.filter((u) => u.client_group === 'wholesale').length,
    },
  });
});

router.get('/export', authenticate, requireAdmin, (_req, res) => {
  const exportSql = `SELECT u.id, u.name, u.email, u.role, u.phone, u.address, u.created_at, u.status,
                            u.client_group, u.notes,
                            COUNT(o.id) AS orderCount,
                            COALESCE(SUM(o.total), 0) AS totalSpent,
                            MAX(o.created_at) AS lastOrderAt
                     FROM users u
                     LEFT JOIN orders o ON o.user_id = u.id
                     WHERE u.role = 'user'
                     GROUP BY u.id
                     ORDER BY u.name COLLATE NOCASE`;
  const rows = db.prepare(exportSql).all().map(mapUser);

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

router.get('/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`${LIST_SQL} HAVING u.id = ?`).get(id);
  if (!row || row.role === 'admin') return res.status(404).json({ message: 'Client not found' });
  const client = mapUser(row);
  const orders = db
    .prepare(
      `SELECT id, bill_number, po_number, total, status, created_at
       FROM orders
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC`
    )
    .all(id);
  res.json({ client, orders });
});

router.patch('/:id/status', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status === 'blocked' ? 'blocked' : req.body?.status === 'allowed' ? 'allowed' : null;
  if (!id || !status) {
    return res.status(400).json({ message: 'Status must be allowed or blocked' });
  }

  const target = db.prepare('SELECT id, role, status FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (target.role === 'admin') {
    return res.status(400).json({ message: 'Admin accounts cannot be blocked' });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ message: 'You cannot change your own status' });
  }

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  const updated = db.prepare(`${LIST_SQL} HAVING u.id = ?`).get(id);
  res.json(mapUser(updated));
});

router.patch('/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
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
  const updated = db.prepare(`${LIST_SQL} HAVING u.id = ?`).get(id);
  const mapped = mapUser(updated);
  if (password) mapped.password = password;
  res.json(mapped);
});

module.exports = router;
