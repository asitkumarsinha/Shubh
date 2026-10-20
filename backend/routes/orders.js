const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const logger = require('../logger');
const { sendOrderNotice } = require('../mail');
const { renderInvoice } = require('../invoice');
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

const tenantModulesStmt = db.prepare('SELECT modules FROM tenants WHERE id = ?');
const couponStmt = db.prepare(
  'SELECT * FROM coupons WHERE tenant_id = ? AND code = ? AND active = 1'
);
const buyerStmt = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?');
const medicineStmt = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?');
const insertOrder = db.prepare(
  `INSERT INTO orders
   (user_id, bill_number, total, status, qr_code, tenant_id, payment_method, coupon_code, discount, subtotal,
    fulfillment, delivery_address)
   VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertOrderItem = db.prepare(
  `INSERT INTO order_items
   (order_id, medicine_id, medicine_name, medicine_image, quantity, price)
   VALUES (?, ?, ?, ?, ?, ?)`
);
const reduceStockStmt = db.prepare(
  'UPDATE medicines SET stock = stock - ? WHERE id = ? AND tenant_id = ? AND stock >= ?'
);
const listCouponsStmt = db.prepare(
  'SELECT id, code, kind, value, active FROM coupons WHERE tenant_id = ? ORDER BY code'
);
const insertCouponStmt = db.prepare(
  'INSERT INTO coupons (tenant_id, code, kind, value) VALUES (?, ?, ?, ?)'
);
const couponByIdStmt = db.prepare(
  'SELECT id, code, kind, value, active FROM coupons WHERE id = ?'
);
const deleteCouponStmt = db.prepare('DELETE FROM coupons WHERE id = ? AND tenant_id = ?');

function tenantModules(tenantId) {
  const tenant = tenantModulesStmt.get(tenantId);
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
  const coupon = couponStmt.get(tenantId, code);
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
  const full = {
    ...order,
    items: itemsForOrder.all(order.id),
    user: userForOrder.get(order.user_id),
  };
  full.whatsapp = whatsappNote(full, storeForInvoice.get(order.tenant_id));
  return full;
}

const storeAdminStmt = db.prepare(
  `SELECT name, email FROM users WHERE tenant_id = ? AND role = 'admin' ORDER BY id LIMIT 1`
);
const storeForInvoice = db.prepare(
  `SELECT t.name, t.address, t.contact_phone, s.title, s.slogan
   FROM tenants t
   LEFT JOIN tenant_settings s ON s.tenant_id = t.id
   WHERE t.id = ?`
);

function whatsappNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return '';
}

function whatsappNote(order, store) {
  const storeName = store?.title || store?.name || 'My Stores Hubs';
  const items = (order.items || [])
    .map((item) => `${item.medicine_name} x ${item.quantity}`)
    .join(', ');
  const brief = items.length > 220 ? `${items.slice(0, 217)}...` : items;
  const total = `₹${Number(order.total).toFixed(2)}`;
  const paid = order.payment_status === 'paid' ? 'Payment received.' : 'Payment not received yet.';
  const arrival = order.fulfillment === 'delivery'
    ? `Deliver to ${order.delivery_address || 'the address on the order'}.`
    : 'Collect from the shop.';
  if (order.status === 'pending') {
    return {
      to: 'store',
      url: linkWhatsapp(
        store?.contact_phone,
        `New order ${order.bill_number} at ${storeName}. ${brief}. Total ${total}. ${paid} ${arrival}`
      ),
    };
  }
  if (order.status === 'approved') {
    return {
      to: 'client',
      url: linkWhatsapp(
        order.user?.phone,
        `${storeName} accepted order ${order.bill_number}. ${brief}. Total ${total}. ${arrival}`
      ),
    };
  }
  if (order.status === 'dispatched') {
    return {
      to: 'client',
      url: linkWhatsapp(
        order.user?.phone,
        `${storeName} dispatched order ${order.bill_number}. ${brief}. Total ${total}. ${arrival}`
      ),
    };
  }
  return null;
}

function linkWhatsapp(phone, text) {
  const number = whatsappNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function orderNoticeText(order) {
  const lines = [
    `Bill ${order.bill_number}`,
    `Status: ${order.status}`,
    `Payment: ${PAYMENT_METHODS[order.payment_method] || order.payment_method || ''}`,
    `Payment received: ${order.payment_status === 'paid' ? 'Yes' : 'No'}`,
    `Total: ₹${Number(order.total).toFixed(2)}`,
    order.fulfillment === 'delivery'
      ? `Deliver to: ${order.delivery_address || ''}`
      : 'Collect from the shop',
  ];
  if (order.coupon_code) {
    lines.push(`Discount ${order.coupon_code}: -₹${Number(order.discount || 0).toFixed(2)}`);
  }
  return lines.join('\n');
}

async function notifyOrder(order, event) {
  const full = mapOrder(order);
  const store = storeForInvoice.get(order.tenant_id);
  const invoice = renderInvoice(full, store);
  const filename = `${String(order.bill_number).replace(/[^\w.-]/g, '')}.html`;
  const buyer = full.user;
  const subjects = {
    placed: `Your order ${order.bill_number}`,
    approved: `Order ${order.bill_number} accepted`,
    dispatched: `Order ${order.bill_number} dispatched`,
  };
  const text = orderNoticeText(order);
  const jobs = [];
  if (buyer?.email) {
    jobs.push(sendOrderNotice({
      to: buyer.email,
      subject: subjects[event] || subjects.placed,
      text,
      html: invoice,
      filename,
    }));
  }
  if (event === 'placed') {
    const admin = storeAdminStmt.get(order.tenant_id);
    if (admin?.email && admin.email !== buyer?.email) {
      jobs.push(sendOrderNotice({
        to: admin.email,
        subject: `New order ${order.bill_number}`,
        text: `${buyer?.name || 'A client'} placed an order.\n${text}`,
        html: invoice,
        filename,
      }));
    }
  }
  await Promise.all(jobs);
}

async function notifySafely(orderId, event) {
  try {
    const order = orderById.get(orderId);
    if (order) await notifyOrder(order, event);
  } catch (err) {
    logger.error('order email failed', { message: err.message });
  }
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
  const stores = new Map();
  return orders.map((order) => {
    const full = {
      ...order,
      items: itemsByOrder.get(order.id) || [],
      user: usersById.get(order.user_id) || null,
    };
    if (!stores.has(order.tenant_id)) stores.set(order.tenant_id, storeForInvoice.get(order.tenant_id));
    full.whatsapp = whatsappNote(full, stores.get(order.tenant_id));
    return full;
  });
}

router.post('/quote', authenticate, (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    const buyer = buyerStmt.get(req.user.id, req.user.tenant_id);
    let subtotal = 0;
    for (const item of items) {
      const medicine = medicineStmt.get(item.medicineId, req.user.tenant_id);
      if (!medicine) return res.status(400).json({ message: `Medicine not found: ${item.medicineId}` });
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ message: 'Invalid quantity' });
      subtotal += unitPrice(medicine, buyer) * qty;
    }
    res.json(priceQuote(req.user.tenant_id, money(subtotal), req.body?.couponCode));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: status >= 500 ? 'Could not price this cart' : err.message });
  }
});

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

    const buyer = buyerStmt.get(req.user.id, req.user.tenant_id);
    const lineItems = [];
    let subtotal = 0;

    for (const item of items) {
      const medicine = medicineStmt.get(item.medicineId, req.user.tenant_id);
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
    const fulfillment = req.body?.fulfillment === 'delivery' ? 'delivery' : 'pickup';
    const deliveryAddress = String(req.body?.address || '').trim();
    if (fulfillment === 'delivery' && deliveryAddress.length < 5) {
      return res.status(400).json({ message: 'Enter the delivery address' });
    }
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
      const result = insertOrder.run(
        req.user.id, billNumber, quote.total, qrCode, req.user.tenant_id,
        paymentMethod, quote.couponCode, quote.discount, quote.subtotal,
        fulfillment, fulfillment === 'delivery' ? deliveryAddress : ''
      );

      const orderId = result.lastInsertRowid;

      for (const line of lineItems) {
        const changed = reduceStockStmt.run(line.qty, line.medicine.id, req.user.tenant_id, line.qty);
        if (changed.changes !== 1) {
          throw httpError(400, `Insufficient stock for ${line.medicine.name}`);
        }
        insertOrderItem.run(
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
    await notifySafely(orderId, 'placed');
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
    ? listCouponsStmt.all(req.user.tenant_id)
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
    const result = insertCouponStmt.run(req.user.tenant_id, code, kind, value);
    res.status(201).json(couponByIdStmt.get(result.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ message: 'That discount code already exists' });
    }
    logger.error('coupon create failed', { message: err.message });
    res.status(500).json({ message: 'Could not save discount code' });
  }
});

router.delete('/coupons/:id', authenticate, requireAdmin, (req, res) => {
  const result = deleteCouponStmt.run(req.params.id, req.user.tenant_id);
  if (!result.changes) return res.status(404).json({ message: 'Discount code not found' });
  res.json({ message: 'Discount code removed' });
});

router.get('/my', authenticate, (req, res) => {
  const orders = mapOrders(myOrdersStmt.all(req.user.id, req.user.tenant_id));
  res.json(orders);
});

router.get('/:id/invoice', authenticate, (req, res) => {
  const order = orderForTenant.get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
    return res.status(403).json({ message: 'Access denied' });
  }
  const full = mapOrder(order);
  const html = renderInvoice(full, storeForInvoice.get(order.tenant_id));
  const filename = `${String(order.bill_number).replace(/[^\w.-]/g, '')}.html`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(html);
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

router.patch('/:id/approve', authenticate, requireAdmin, async (req, res) => {
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
  await notifySafely(order.id, 'approved');
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

router.patch('/:id/dispatch', authenticate, requireAdmin, async (req, res) => {
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
  await notifySafely(order.id, 'dispatched');
  res.json(mapOrder(orderById.get(order.id)));
});

router.patch('/:id/payment', authenticate, requireAdmin, (req, res) => {
  const order = orderForTenant.get(req.params.id, req.user.tenant_id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  const paymentStatus = req.body?.payment_status === 'unpaid' ? 'unpaid' : 'paid';
  db.prepare(
    `UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(paymentStatus, order.id);
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

router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
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
    if (status === 'approved') await notifySafely(order.id, 'approved');
    if (status === 'dispatched') await notifySafely(order.id, 'dispatched');
    res.json(mapOrder(orderById.get(order.id)));
  } catch (err) {
    logger.error('order request failed', { message: err.message });
    res.status(400).json({ message: err.message || 'Failed to update status' });
  }
});

module.exports = router;
