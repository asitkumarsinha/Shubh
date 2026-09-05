const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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
    password: '••••••••',
    passwordEncrypted: true,
  };
}

router.get('/', authenticate, requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.address, u.created_at, u.status,
              COUNT(o.id) AS orderCount,
              COALESCE(SUM(o.total), 0) AS totalSpent,
              MAX(o.created_at) AS lastOrderAt
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       GROUP BY u.id
       ORDER BY datetime(u.created_at) DESC`
    )
    .all();

  const users = rows.map(mapUser);
  const topUsers = [...users]
    .filter((u) => u.role === 'user')
    .sort((a, b) => b.orderCount - a.orderCount || b.totalSpent - a.totalSpent)
    .slice(0, 5)
    .map((u, i) => ({ ...u, rank: i + 1 }));

  res.json({
    users,
    topUsers,
    summary: {
      totalUsers: users.filter((u) => u.role === 'user').length,
      totalAdmins: users.filter((u) => u.role === 'admin').length,
      usersWithOrders: users.filter((u) => u.role === 'user' && u.orderCount > 0).length,
      blockedUsers: users.filter((u) => u.status === 'blocked').length,
    },
  });
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
  const updated = db.prepare('SELECT id, name, email, role, phone, address, created_at, status FROM users WHERE id = ?').get(id);
  res.json(updated);
});

module.exports = router;
