const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const LOW_STOCK = 10;

router.get('/', authenticate, requireAdmin, (req, res) => {
  const todayOrders = db
    .prepare(
      `SELECT COUNT(*) AS c FROM orders WHERE tenant_id = ? AND date(created_at) = date('now')`
    )
    .get(req.user.tenant_id).c;

  const pendingApprovals = db
    .prepare(`SELECT COUNT(*) AS c FROM orders WHERE tenant_id = ? AND status = 'pending'`)
    .get(req.user.tenant_id).c;

  const revenue = db
    .prepare(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM orders
       WHERE tenant_id = ? AND status IN ('approved', 'dispatched')`
    )
    .get(req.user.tenant_id).total;

  const revenueToday = db
    .prepare(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM orders
       WHERE tenant_id = ? AND status IN ('approved', 'dispatched')
         AND date(created_at) = date('now')`
    )
    .get(req.user.tenant_id).total;

  const lowStock = db
    .prepare(`SELECT COUNT(*) AS c FROM medicines WHERE tenant_id = ? AND stock < ?`)
    .get(req.user.tenant_id, LOW_STOCK).c;

  const newClients = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM users
       WHERE tenant_id = ? AND role = 'user' AND date(created_at) = date('now')`
    )
    .get(req.user.tenant_id).c;

  const pendingOrders = db
    .prepare(
      `SELECT o.id, o.bill_number, o.total, o.created_at, o.status,
              u.name AS userName, u.email AS userEmail
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.tenant_id = ? AND o.status = 'pending'
       ORDER BY datetime(o.created_at) DESC
       LIMIT 8`
    )
    .all(req.user.tenant_id);

  const lowStockItems = db
    .prepare(
      `SELECT id, name, stock, price, image
       FROM medicines
       WHERE tenant_id = ? AND stock < ?
       ORDER BY stock ASC, name
       LIMIT 8`
    )
    .all(req.user.tenant_id, LOW_STOCK);

  res.json({
    summary: {
      todayOrders,
      pendingApprovals,
      revenue,
      revenueToday,
      lowStock,
      newClients,
      lowStockThreshold: LOW_STOCK,
    },
    pendingOrders,
    lowStockItems,
  });
});

module.exports = router;
