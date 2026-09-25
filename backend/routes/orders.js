const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const { authenticate, requireAdmin, requireTenantLimit } = require('../middleware/auth');
const { unitPrice } = require('../pricing');

const router = express.Router();

function generateBillNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 900 + 100);
  return `BILL-${stamp}-${rand}`;
}

function generatePoNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 900 + 100);
  return `PO-${stamp}-${rand}`;
}

function mapOrder(order) {
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ?')
    .all(order.id);
  const user = db
    .prepare('SELECT id, name, email, phone, address FROM users WHERE id = ?')
    .get(order.user_id);
  return { ...order, items, user };
}

router.post('/checkout', authenticate, requireTenantLimit('orders', 'orders'), async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const buyer = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.user.id, req.user.tenant_id);
    const lineItems = [];
    let total = 0;

    for (const item of items) {
      const medicine = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?').get(item.medicineId, req.user.tenant_id);
      if (!medicine) {
        return res.status(400).json({ message: `Medicine not found: ${item.medicineId}` });
      }
      const qty = Number(item.quantity);
      if (!qty || qty < 1) {
        return res.status(400).json({ message: 'Invalid quantity' });
      }
      if (medicine.stock < qty) {
        return res.status(400).json({
          message: `Insufficient stock for ${medicine.name}. Available: ${medicine.stock}`,
        });
      }
      const unit = unitPrice(medicine, buyer);
      const lineTotal = unit * qty;
      total += lineTotal;
      lineItems.push({ medicine, qty, unit, lineTotal });
    }

    const billNumber = generateBillNumber();
    const qrPayload = JSON.stringify({
      billNumber,
      total,
      userId: req.user.id,
      itemCount: lineItems.length,
    });
    const qrCode = await QRCode.toDataURL(qrPayload, { width: 280, margin: 2 });

    const createOrder = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO orders (user_id, bill_number, total, status, qr_code, tenant_id)
           VALUES (?, ?, ?, 'pending', ?, ?)`
        )
        .run(req.user.id, billNumber, total, qrCode, req.user.tenant_id);

      const orderId = result.lastInsertRowid;
      const insertItem = db.prepare(
        `INSERT INTO order_items
         (order_id, medicine_id, medicine_name, medicine_image, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      const reduceStock = db.prepare('UPDATE medicines SET stock = stock - ? WHERE id = ? AND tenant_id = ?');

      for (const line of lineItems) {
        insertItem.run(
          orderId,
          line.medicine.id,
          line.medicine.name,
          line.medicine.image,
          line.qty,
          line.unit
        );
        reduceStock.run(line.qty, line.medicine.id, req.user.tenant_id);
      }
      return orderId;
    });

    const orderId = createOrder();
    const order = mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId));
    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Checkout failed' });
  }
});

router.get('/my', authenticate, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? AND tenant_id = ? ORDER BY created_at DESC')
    .all(req.user.id, req.user.tenant_id)
    .map(mapOrder);
  res.json(orders);
});

router.get('/:id', authenticate, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
    return res.status(403).json({ message: 'Access denied' });
  }
  res.json(mapOrder(order));
});

router.get('/', authenticate, requireAdmin, (req, res) => {
  const { status } = req.query;
  let orders;
  if (status) {
    orders = db
      .prepare('SELECT * FROM orders WHERE status = ? AND tenant_id = ? ORDER BY created_at DESC')
      .all(status, req.user.tenant_id);
  } else {
    orders = db.prepare('SELECT * FROM orders WHERE tenant_id = ? ORDER BY created_at DESC').all(req.user.tenant_id);
  }
  res.json(orders.map(mapOrder));
});

router.patch('/:id/approve', authenticate, requireAdmin, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'pending') {
    return res.status(400).json({ message: `Cannot approve order with status: ${order.status}` });
  }
  const poNumber = generatePoNumber();
  db.prepare(
    `UPDATE orders SET status = 'approved', po_number = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(poNumber, order.id);
  res.json(mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)));
});

function restoreStockAndSetStatus(order, status) {
  const tx = db.transaction(() => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const restore = db.prepare('UPDATE medicines SET stock = stock + ? WHERE id = ? AND tenant_id = ?');
    for (const item of items) {
      if (item.medicine_id) restore.run(item.quantity, item.medicine_id, order.tenant_id);
    }
    db.prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(status, order.id);
  });
  tx();
}

router.patch('/:id/reject', authenticate, requireAdmin, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'pending') {
    return res.status(400).json({
      message: `Only pending orders can be rejected (current: ${order.status})`,
    });
  }
  restoreStockAndSetStatus(order, 'rejected');
  res.json(mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)));
});

router.patch('/:id/cancel', authenticate, requireAdmin, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (['dispatched', 'cancelled', 'rejected'].includes(order.status)) {
    return res.status(400).json({ message: `Cannot cancel order with status: ${order.status}` });
  }

  restoreStockAndSetStatus(order, 'cancelled');
  res.json(mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)));
});

router.patch('/:id/dispatch', authenticate, requireAdmin, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'approved') {
    return res.status(400).json({
      message: 'Only approved orders (with purchase order) can be dispatched',
    });
  }
  db.prepare(
    `UPDATE orders SET status = 'dispatched', updated_at = datetime('now') WHERE id = ?`
  ).run(order.id);
  res.json(mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)));
});

const ACTIVE_STATUSES = new Set(['pending', 'approved', 'dispatched']);
const ALLOWED_STATUSES = new Set(['pending', 'approved', 'dispatched', 'rejected', 'cancelled']);

function getOrderItems(orderId) {
  return db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
}

function restoreStock(orderId, tenantId) {
  const items = getOrderItems(orderId);
  const restore = db.prepare('UPDATE medicines SET stock = stock + ? WHERE id = ? AND tenant_id = ?');
  for (const item of items) {
    if (item.medicine_id) restore.run(item.quantity, item.medicine_id, tenantId);
  }
}

function reserveStock(orderId, tenantId) {
  const items = getOrderItems(orderId);
  for (const item of items) {
    if (!item.medicine_id) continue;
    const medicine = db.prepare('SELECT id, name, stock FROM medicines WHERE id = ? AND tenant_id = ?').get(item.medicine_id, tenantId);
    if (!medicine) {
      throw new Error(`Medicine missing for order item: ${item.medicine_name}`);
    }
    if (medicine.stock < item.quantity) {
      throw new Error(
        `Insufficient stock for ${medicine.name}. Available: ${medicine.stock}, needed: ${item.quantity}`
      );
    }
  }
  const reduce = db.prepare('UPDATE medicines SET stock = stock - ? WHERE id = ? AND tenant_id = ?');
  for (const item of items) {
    if (item.medicine_id) reduce.run(item.quantity, item.medicine_id, tenantId);
  }
}

router.patch('/:id/status', authenticate, requireAdmin, (req, res) => {
  try {
    const { status } = req.body || {};
    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({
        message: 'Status must be one of: pending, approved, dispatched, rejected',
      });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === status) {
      return res.json(mapOrder(order));
    }

    const wasActive = ACTIVE_STATUSES.has(order.status);
    const willBeActive = ACTIVE_STATUSES.has(status);

    const apply = db.transaction(() => {
      if (wasActive && !willBeActive) {
        restoreStock(order.id, order.tenant_id);
      } else if (!wasActive && willBeActive) {
        reserveStock(order.id, order.tenant_id);
      }

      let poNumber = order.po_number;
      if (status === 'approved' && !poNumber) {
        poNumber = generatePoNumber();
      }
      if (status === 'pending' || status === 'rejected') {
        // keep existing PO history unless resetting to pending before approval flow
        if (status === 'pending' && order.status === 'rejected') {
          poNumber = null;
        }
      }

      db.prepare(
        `UPDATE orders SET status = ?, po_number = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(status, poNumber, order.id);
    });

    apply();
    res.json(mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)));
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || 'Failed to update status' });
  }
});

module.exports = router;
