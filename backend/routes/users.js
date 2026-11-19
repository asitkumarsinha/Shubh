const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pageQuery } = require('../paging');
const { parseCsv, normalizeHeader, readSheetTable } = require('../spreadsheet');

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
const CLIENT_SEARCH = `(? = '' OR u.name LIKE ? COLLATE NOCASE OR u.email LIKE ? COLLATE NOCASE OR IFNULL(u.phone, '') LIKE ? COLLATE NOCASE)`;
const countClientsStmt = db.prepare(
  `SELECT COUNT(*) AS count FROM users u WHERE u.tenant_id = ? AND u.role = 'user' AND ${CLIENT_SEARCH}`
);
const listClientsStmt = db.prepare(
  `${LIST_SELECT} AND u.role = 'user' AND ${CLIENT_SEARCH} GROUP BY u.id ORDER BY u.name COLLATE NOCASE LIMIT ? OFFSET ?`
);
const topClientsStmt = db.prepare(
  `${LIST_SELECT} AND u.role = 'user' GROUP BY u.id ORDER BY orderCount DESC, totalSpent DESC LIMIT 5`
);
const clientCountsStmt = db.prepare(
  `SELECT
     SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS totalUsers,
     SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS totalAdmins,
     SUM(CASE WHEN role = 'user' AND status = 'blocked' THEN 1 ELSE 0 END) AS blockedUsers,
     SUM(CASE WHEN role = 'user' AND client_group = 'wholesale' THEN 1 ELSE 0 END) AS wholesaleClients,
     SUM(CASE WHEN role = 'user' AND client_group != 'wholesale' THEN 1 ELSE 0 END) AS retailClients
   FROM users WHERE tenant_id = ?`
);
const clientsWithOrdersStmt = db.prepare(
  `SELECT COUNT(DISTINCT u.id) AS count
   FROM users u JOIN orders o ON o.user_id = u.id
   WHERE u.tenant_id = ? AND u.role = 'user'`
);

router.get('/', authenticate, requireAdmin, (req, res) => {
  const tenantId = req.user.tenant_id;
  const { page, limit, offset, q, like } = pageQuery(req, 20);
  const total = countClientsStmt.get(tenantId, q, like, like, like).count;
  const users = listClientsStmt.all(tenantId, q, like, like, like, limit, offset).map(mapUser);
  const topUsers = topClientsStmt
    .all(tenantId)
    .map((row, index) => ({ ...mapUser(row), rank: index + 1 }));
  const counts = clientCountsStmt.get(tenantId);
  const usersWithOrders = clientsWithOrdersStmt.get(tenantId).count;

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

const exportClientsStmt = db.prepare(
  `SELECT u.id, u.name, u.email, u.role, u.phone, u.address, u.created_at, u.status,
          u.client_group, u.notes,
          COUNT(o.id) AS orderCount,
          COALESCE(SUM(o.total), 0) AS totalSpent,
          MAX(o.created_at) AS lastOrderAt
   FROM users u
   LEFT JOIN orders o ON o.user_id = u.id
   WHERE u.role = 'user' AND u.tenant_id = ?
   GROUP BY u.id
   ORDER BY u.name COLLATE NOCASE`
);

router.get('/export', authenticate, requireAdmin, (req, res) => {
  const rows = exportClientsStmt.all(req.user.tenant_id).map(mapUser);

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

const storeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|csv)$/i.test(file.originalname || '')) return cb(null, true);
    const err = new Error('Upload an Excel (.xlsx) or CSV file');
    err.status = 400;
    return cb(err);
  },
});
const STORE_SHEET = { preferredNames: ['stores', 'store', 'clients', 'client'], required: ['name', 'email'] };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMPORT_ROWS = 200;
const countStoresStmt = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE tenant_id = ? AND role = 'user'`);
const emailTakenStmt = db.prepare('SELECT id FROM users WHERE email = ?');
const insertImportedStore = db.prepare(
  `INSERT INTO users (name, email, password, role, phone, address, client_group, tenant_id)
   VALUES (?, ?, ?, 'user', ?, ?, ?, ?)`
);

function cellValue(line, at) {
  return at >= 0 ? String(line[at] ?? '').trim() : '';
}

// Each imported store signs in with its email as the password, as the readme asks.
router.post('/import', authenticate, requireAdmin, storeUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose an Excel (.xlsx) or CSV file' });
  let table;
  try {
    table = /\.xlsx$/i.test(req.file.originalname)
      ? (await readSheetTable(req.file.buffer, STORE_SHEET)).table
      : parseCsv(req.file.buffer.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ message: 'Could not read the spreadsheet. Upload an Excel (.xlsx) or CSV file' });
  }
  if (table.length < 2) {
    return res.status(400).json({ message: 'The spreadsheet needs a header row and at least one store' });
  }

  const headers = table[0].map(normalizeHeader);
  const index = (...names) => {
    for (const name of names) {
      const at = headers.indexOf(name);
      if (at >= 0) return at;
    }
    return -1;
  };
  const nameAt = index('name', 'store name', 'store', 'client name');
  const emailAt = index('email', 'e-mail', 'email id', 'mail');
  const phoneAt = index('phone', 'mobile', 'phone number');
  const addressAt = index('address');
  const groupAt = index('group', 'client group');
  if (nameAt < 0 || emailAt < 0) {
    const found = headers.filter(Boolean).join(', ') || 'none';
    return res.status(400).json({ message: `The header row must include name and email. Columns found: ${found}` });
  }

  const tenant = db.prepare('SELECT max_users AS max FROM tenants WHERE id = ?').get(req.user.tenant_id);
  const room = tenant ? Math.max(0, Number(tenant.max) - countStoresStmt.get(req.user.tenant_id).c) : Infinity;

  const reasons = [];
  let skipped = 0;
  const skip = (label, why) => {
    skipped += 1;
    if (reasons.length < 10) reasons.push(`${label}: ${why}`);
  };
  const candidates = [];
  table.slice(1, MAX_IMPORT_ROWS + 1).forEach((line, i) => {
    const name = cellValue(line, nameAt);
    const email = cellValue(line, emailAt).toLowerCase();
    const label = name || email || `row ${i + 2}`;
    if (!name) return skip(label, 'name is missing');
    if (!EMAIL_PATTERN.test(email)) return skip(label, 'email is not valid');
    if (email.length < 6) return skip(label, 'email must be at least 6 characters, because it is also the password');
    if (emailTakenStmt.get(email)) return skip(label, 'email is already registered');
    candidates.push({
      label,
      name,
      email,
      phone: cellValue(line, phoneAt),
      address: cellValue(line, addressAt),
      group: /wholesale/i.test(cellValue(line, groupAt)) ? 'wholesale' : 'retail',
    });
  });

  const hashes = await Promise.all(candidates.map((store) => bcrypt.hash(store.email, 10)));
  let created = 0;
  db.transaction(() => {
    candidates.forEach((store, i) => {
      if (emailTakenStmt.get(store.email)) return skip(store.label, 'email is already registered');
      if (created >= room) return skip(store.label, 'this hub has reached its store plan limit');
      insertImportedStore.run(
        store.name,
        store.email,
        hashes[i],
        store.phone,
        store.address,
        store.group,
        req.user.tenant_id
      );
      created += 1;
    });
  })();

  res.status(201).json({ created, skipped, reasons });
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

// Deletes every store of this hub that nothing references. Stores with orders (or that created products) are kept.
const STORE_REFERENCED = `EXISTS (SELECT 1 FROM orders o WHERE o.user_id = users.id)
  OR EXISTS (SELECT 1 FROM medicines m WHERE m.created_by = users.id)`;
router.delete('/', authenticate, requireAdmin, (req, res) => {
  const tenantId = req.user.tenant_id;
  const before = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE tenant_id = ? AND role = 'user'`).get(tenantId).c;
  const result = db
    .prepare(`DELETE FROM users WHERE tenant_id = ? AND role = 'user' AND NOT (${STORE_REFERENCED})`)
    .run(tenantId);
  const deleted = result.changes;
  res.json({
    deleted,
    kept: before - deleted,
    message: `${deleted} ${deleted === 1 ? 'store' : 'stores'} deleted${before - deleted ? `, ${before - deleted} kept because they are in use (orders)` : ''}`,
  });
});

// Stores with orders cannot be deleted, because orders reference the store. Block them instead.
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const target = db
    .prepare(`SELECT id, name, role FROM users WHERE id = ? AND tenant_id = ?`)
    .get(id, req.user.tenant_id);
  if (!target || target.role !== 'user') return res.status(404).json({ message: 'Store not found' });

  const orders = db
    .prepare('SELECT COUNT(*) AS c FROM orders WHERE user_id = ? AND tenant_id = ?')
    .get(id, req.user.tenant_id).c;
  if (orders) {
    return res.status(409).json({
      message: `${target.name} has ${orders} ${orders === 1 ? 'order' : 'orders'}, so it cannot be deleted. Block the store instead to keep the order history.`,
    });
  }

  db.prepare(`DELETE FROM users WHERE id = ? AND tenant_id = ? AND role = 'user'`).run(id, req.user.tenant_id);
  res.json({ message: `${target.name} deleted`, id });
});

function storeEmail(name) {
  const base =
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 40) || 'store';
  const exists = db.prepare('SELECT id FROM users WHERE email = ?');
  let email = `${base}@mystoreshubs.com`;
  let n = 2;
  while (exists.get(email)) {
    email = `${base}.${n}@mystoreshubs.com`;
    n += 1;
  }
  return email;
}

router.post('/:id/clone', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ message: 'A unique store name is required' });

  const source = db
    .prepare(`SELECT * FROM users WHERE id = ? AND tenant_id = ? AND role = 'user'`)
    .get(id, req.user.tenant_id);
  if (!source) return res.status(404).json({ message: 'Store not found' });

  const taken = db
    .prepare(
      `SELECT id FROM users WHERE tenant_id = ? AND role = 'user' AND lower(trim(name)) = lower(?)`
    )
    .get(req.user.tenant_id, name);
  if (taken) {
    return res.status(409).json({ message: 'A store with this name already exists. Choose a unique name.' });
  }

  const tenant = db.prepare('SELECT max_users AS max FROM tenants WHERE id = ?').get(req.user.tenant_id);
  const clientCount = db
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE tenant_id = ? AND role = 'user'`)
    .get(req.user.tenant_id).c;
  if (tenant && clientCount >= tenant.max) {
    return res.status(403).json({ message: 'This store has reached its client plan limit' });
  }

  const email = storeEmail(name);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password, role, phone, address, client_group, notes, status, tenant_id)
       VALUES (?, ?, ?, 'user', ?, ?, ?, ?, 'allowed', ?)`
    )
    .run(
      name,
      email,
      source.password,
      source.phone || '',
      source.address || '',
      source.client_group === 'wholesale' ? 'wholesale' : 'retail',
      source.notes || '',
      req.user.tenant_id
    );

  const created = db.prepare(`${LIST_SQL} HAVING u.id = ?`).get(req.user.tenant_id, result.lastInsertRowid);
  res.status(201).json(mapUser(created));
});

module.exports = router;
