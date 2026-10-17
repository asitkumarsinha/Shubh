const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const LOW_STOCK = 10;

const todayOrdersStmt = db.prepare(
  `SELECT COUNT(*) AS c FROM orders
   WHERE tenant_id = ? AND created_at >= date('now') AND created_at < date('now', '+1 day')`
);
const pendingApprovalsStmt = db.prepare(
  `SELECT COUNT(*) AS c FROM orders WHERE tenant_id = ? AND status = 'pending'`
);
const revenueStmt = db.prepare(
  `SELECT COALESCE(SUM(total), 0) AS total
   FROM orders
   WHERE tenant_id = ? AND status IN ('approved', 'dispatched')`
);
const revenueTodayStmt = db.prepare(
  `SELECT COALESCE(SUM(total), 0) AS total
   FROM orders
   WHERE tenant_id = ? AND status IN ('approved', 'dispatched')
     AND created_at >= date('now') AND created_at < date('now', '+1 day')`
);
const lowStockStmt = db.prepare(`SELECT COUNT(*) AS c FROM medicines WHERE tenant_id = ? AND stock < ?`);
const newClientsStmt = db.prepare(
  `SELECT COUNT(*) AS c
   FROM users
   WHERE tenant_id = ? AND role = 'user'
     AND created_at >= date('now') AND created_at < date('now', '+1 day')`
);
const pendingOrdersStmt = db.prepare(
  `SELECT o.id, o.bill_number, o.total, o.created_at, o.status,
          u.name AS userName, u.email AS userEmail
   FROM orders o
   JOIN users u ON u.id = o.user_id
   WHERE o.tenant_id = ? AND o.status = 'pending'
   ORDER BY o.created_at DESC
   LIMIT 8`
);
const lowStockItemsStmt = db.prepare(
  `SELECT id, name, stock, price, image
   FROM medicines
   WHERE tenant_id = ? AND stock < ?
   ORDER BY stock ASC, name
   LIMIT 8`
);
const topProductsStmt = db.prepare(
  `SELECT oi.medicine_name AS name,
          SUM(oi.quantity) AS qtySold,
          SUM(oi.quantity * oi.price) AS revenue
   FROM order_items oi
   JOIN orders o ON o.id = oi.order_id
   WHERE o.tenant_id = ? AND o.status IN ('pending', 'approved', 'dispatched')
   GROUP BY oi.medicine_name
   ORDER BY qtySold DESC, revenue DESC
   LIMIT 5`
);

router.get('/', authenticate, requireAdmin, (req, res) => {
  const tenantId = req.user.tenant_id;
  const todayOrders = todayOrdersStmt.get(tenantId).c;
  const pendingApprovals = pendingApprovalsStmt.get(tenantId).c;
  const revenue = revenueStmt.get(tenantId).total;
  const revenueToday = revenueTodayStmt.get(tenantId).total;
  const lowStock = lowStockStmt.get(tenantId, LOW_STOCK).c;
  const newClients = newClientsStmt.get(tenantId).c;
  const pendingOrders = pendingOrdersStmt.all(tenantId);
  const lowStockItems = lowStockItemsStmt.all(tenantId, LOW_STOCK);
  const topProducts = topProductsStmt.all(tenantId);

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
    topProducts,
  });
});

module.exports = router;
