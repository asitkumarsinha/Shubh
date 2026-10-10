const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const logger = require('../logger');
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

const PAYMENT_METHODS = {
  upi: 'UPI QR',
  cod: 'Cash on delivery',
  counter: 'Card or cash at counter',
};

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function tenantModules(tenantId) {
  const tenant = db.prepare('SELECT modules FROM tenants WHERE id = ?').get(tenantId);
  try {
    return JSON.parse(tenant?.modules || '{}');
  } catch {
    return {};
  }
}

function priceQuote(tenantId, subtotal, couponCode) {
  const code = String(couponCode || '').trim().toUpperCase();
  if (!code) return { subtotal, discount: 0, total: subtotal, couponCode: null };
  if (!tenantModules(tenantId).coupons) {
    throw httpError(400, 'Discount codes are not enabled for this store');
  }
  const coupon = db.prepare(
    'SELECT * FROM coupons WHERE tenant_id = ? AND code = ? AND active = 1'
  ).get(tenantId, code);
  if (!coupon) throw httpError(400, 'Discount code is not valid');
  const raw = coupon.kind === 'percent' ? subtotal * (Number(coupon.value) / 100) : Number(coupon.value);
  const discount = Math.min(subtotal, money(raw));
  return { subtotal, discount, total: money(subtotal - discount), couponCode: code };
}

const itemsForOrder = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
const userForOrder = db.prepare('SELECT id, name, email, phone, address FROM users WHERE id = ?');
const orderById = db.prepare('SELECT * FROM orders WHERE id = ?');
const orderForTenant = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?');
const myOrdersStmt = db.prepare(
  'SELECT * FROM orders WHERE user_id = ? AND tenant_id = ? ORDER BY created_at DESC'
);
const ordersByStatus = db.prepare(
  'SELECT * FROM orders WHERE status = ? AND tenant_id = ? ORDER BY created_at DESC'
);
const ordersByTenant = db.prepare('SELECT * FROM orders WHERE tenant_id = ? ORDER BY created_at DESC');

function rowsById(sqlIds, loader) {
  const map = new Map();
  for (let i = 0; i < sqlIds.length; i += 200) {
    const chunk = sqlIds.slice(i, i + 200);
    const rows = db
      .prepare(loader(chunk.map(() => '?').join(',')))
      .all(...chunk);
    for (const row of rows) {
      const key = row.order_id ?? row.id;
      if (row.order_id) {
        const list = map.get(row.order_id);
        if (list) list.push(row);
        else map.set(row.order_id, [row]);
      } else {
        map.set(key, row);
      }
    }
  }
  return map;
}

function mapOrder(order) {
  if (!order) return order;
  return {
    ...order,
    items: itemsForOrder.all(order.id),
    user: userForOrder.get(order.user_id),
  };
}

function mapOrders(orders) {
  if (!orders.length) return [];
  const itemsByOrder = rowsById(
    orders.map((order) => order.id),
    (slots) => `SELECT * FROM order_items WHERE order_id IN (${slots})`
  );
  const usersById = rowsById(
    [...new Set(orders.map((order) => order.user_id))],
    (slots) => `SELECT id, name, email, phone, address FROM users WHERE id IN (${slots})`
  );
  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || [],
    user: usersById.get(order.user_id) || null,
  }));
}

router.post('/checkout', authenticate, requireTenantLimit('orders', 'orders'), async (req, res) => {
  try {
    const { items } = req.body;
    const paymentMethod = req.body?.paymentMethod || 'upi';
    if (!PAYMENT_METHODS[paymentMethod]) {
      return res.status(400).json({ message: 'Choose UPI QR, cash on delivery, or card or cash at the counter' });
    }
    if (paymentMethod === 'upi' && tenantModules(req.user.tenant_id).qrCheckout === false) {
      return res.status(400).json({ message: 'UPI QR checkout is not enabled for this store' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const buyer = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.user.id, req.user.tenant_id);
    const lineItems = [];
    let subtotal = 0;

    for (const item of items) {
      const medicine = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?').get(item.medicineId, req.user.tenant_id);
      if (!medicine) {
        return res.status(400).json({ message: `Medicine not found: ${item.medicineId}` });
      }
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ message: 'Invalid quantity' });
      }
      const unit = unitPrice(medicine, buyer);
      subtotal += unit * qty;
      lineItems.push({ medicine, qty, unit });
    }

    const quote = priceQuote(req.user.tenant_id, money(subtotal), req.body?.couponCode);
    const billNumber = generateBillNumber();
    const qrCode = paymentMethod === 'upi'
      ? await QRCode.toDataURL(JSON.stringify({
          billNumber,
          total: quote.total,
          method: paymentMethod,
          itemCount: lineItems.length,
        }), { width: 280, margin: 2 })
      : '';

    const createOrder = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO orders
           (user_id, bill_number, total, status, qr_code, tenant_id, payment_method, coupon_code, discount, subtotal)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.user.id, billNumber, quote.total, qrCode, req.user.tenant_id,
          paymentMethod, quote.couponCode, quote.discount, quote.subtotal
        );

      const orderId = result.lastInsertRowid;
      const insertItem = db.prepare(
        `INSERT INTO order_items
         (order_id, medicine_id, medicine_name, medicine_image, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      const reduceStock = db.prepare(
        'UPDATE medicines SET stock = stock - ? WHERE id = ? AND tenant_id = ? AND stock >= ?'
      );

      for (const line of lineItems) {
        const changed = reduceStock.run(line.qty, line.medicine.id, req.user.tenant_id, line.qty);
        if (changed.changes !== 1) {
          throw httpError(400, `Insufficient stock for ${line.medicine.name}`);
        }
        insertItem.run(
          orderId,
          line.medicine.id,
          line.medicine.name,
          line.medicine.image,
          line.qty,
          line.unit
        );
      }
      return orderId;
    });

    const orderId = createOrder();
    const order = mapOrder(orderById.get(orderId));
    res.status(201).json(order);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) logger.error('order request failed', { message: err.message });
    res.status(status).json({ message: status >= 500 ? 'Checkout failed' : err.message });
  }
});

router.get('/coupons', authenticate, requireAdmin, (req, res) => {
  const enabled = Boolean(tenantModules(req.user.tenant_id).coupons);
  const coupons = enabled
    ? db.prepare('SELECT id, code, kind, value, active FROM coupons WHERE tenant_id = ? ORDER BY code').all(req.user.tenant_id)
    : [];
  res.json({ enabled, coupons });
});

router.post('/coupons', authenticate, requireAdmin, (req, res) => {
  if (!tenantModules(req.user.tenant_id).coupons) {
    return res.status(403).json({ message: 'Turn on Coupons for this customer before adding a discount code' });
  }
  const code = String(req.body?.code || '').trim().toUpperCase();
  const kind = req.body?.kind === 'amount' ? 'amount' : 'percent';
  const value = Number(req.body?.value);
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
    return res.status(400).json({ message: 'Use 3–20 letters or numbers for the discount code' });
  }
  if (kind === 'percent' && (!value || value < 1 || value > 100)) {
    return res.status(400).json({ message: 'Percent discount must be between 1 and 100' });
  }
  if (kind === 'amount' && (!value || value <= 0)) {
    return res.status(400).json({ message: 'Amount discount must be greater than 0' });
  }
  try {
    const result = db.prepare(
      'INSERT INTO coupons (tenant_id, code, kind, value) VALUES (?, ?, ?, ?)'
    ).run(req.user.tenant_id, code, kind, value);
    res.status(201).json(db.prepare('SELECT id, code, kind, value, active FROM coupons WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ message: 'That discount code already exists' });
    }
    logger.error('coupon create failed', { message: err.message });
    res.status(500).json({ message: 'Could not save discount code' });
  }
});

router.delete('/coupons/:id', authenticate, requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM coupons WHERE id = ? AND tenant_id = ?').run(req.params.id, req.user.tenant_id);
  if (!result.changes) return res.status(404).json({ message: 'Discount code not found' });
  res.json({ message: 'Discount code removed' });
});

router.get('/my', authenticate, (req, res) => {
  const orders = mapOrders(myOrdersStmt.all(req.user.id, req.user.tenant_id));
  res.json(orders);
});

router.get('/:id', authenticate, (req, res) => {
  const order = orderForTenant.get(req.params.id, req.user.tenant_id);
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
    orders = ordersByStatus.all(status, req.user.tenant_id);
  } else {
    orders = ordersByTenant.all(req.user.tenant_id);
  }
  res.json(mapOrders(orders));
});

router.patch('/:id/approve', authenticate, requireAdmin, (req, res) => {
  const order = orderForTenant.get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'pending') {
    return res.status(400).json({ message: `Cannot approve order with status: ${order.status}` });
  }
  const poNumber = generatePoNumber();
  db.prepare(
    `UPDATE orders SET status = 'approved', po_number = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(poNumber, order.id);
  res.json(mapOrder(orderById.get(order.id)));
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
  const order = orderForTenant.get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'pending') {
    return res.status(400).json({
      message: `Only pending orders can be rejected (current: ${order.status})`,
    });
  }
  restoreStockAndSetStatus(order, 'rejected');
  res.json(mapOrder(orderById.get(order.id)));
});

router.patch('/:id/cancel-own', authenticate, (req, res) => {
  const order = orderForTenant.get(req.params.id, req.user.tenant_id);
  if (!order || order.user_id !== req.user.id) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'pending') {
    return res.status(400).json({ message: 'Only a pending order can be cancelled, before it is approved' });
  }
  restoreStockAndSetStatus(order, 'cancelled');
  res.json(mapOrder(orderById.get(order.id)));
});

router.patch('/:id/cancel', authenticate, requireAdmin, (req, res) => {
  const order = orderForTenant.get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (['dispatched', 'cancelled', 'rejected'].includes(order.status)) {
    return res.status(400).json({ message: `Cannot cancel order with status: ${order.status}` });
  }

  restoreStockAndSetStatus(order, 'cancelled');
  res.json(mapOrder(orderById.get(order.id)));
});

router.patch('/:id/dispatch', authenticate, requireAdmin, (req, res) => {
  const order = orderForTenant.get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'approved') {
    return res.status(400).json({
      message: 'Only approved orders (with purchase order) can be dispatched',
    });
  }
  db.prepare(
    `UPDATE orders SET status = 'dispatched', updated_at = datetime('now') WHERE id = ?`
  ).run(order.id);
  res.json(mapOrder(orderById.get(order.id)));
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

    const order = orderForTenant.get(req.params.id, req.user.tenant_id);
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
    res.json(mapOrder(orderById.get(order.id)));
  } catch (err) {
    logger.error('order request failed', { message: err.message });
    res.status(400).json({ message: err.message || 'Failed to update status' });
  }
});

module.exports = router;
