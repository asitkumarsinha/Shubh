const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const logger = require('../logger');
const { decorateMedicine } = require('../pricing');
const { productSlug } = require('../product-slug');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();
const DEFAULT_MODULES = {
  wholesale: true,
  employees: true,
  reports: true,
  qrCheckout: true,
  coupons: true,
  prescriptions: false,
};

function log(tenantId, actorId, action, details = '') {
  db.prepare(
    'INSERT INTO tenant_audit_logs (tenant_id, actor_id, action, details) VALUES (?, ?, ?, ?)'
  ).run(tenantId, actorId, action, details);
  logger.info('tenant audit', { tenantId, actorId, action });
}

const tenantAdminStmt = db.prepare(
  `SELECT id, name, email FROM users WHERE tenant_id = ? AND role = 'admin' ORDER BY id LIMIT 1`
);
const countUsersForTenant = db.prepare('SELECT COUNT(*) AS count FROM users WHERE tenant_id = ?');
const countEmployeesForTenant = db.prepare('SELECT COUNT(*) AS count FROM employees WHERE tenant_id = ?');
const countMedicinesForTenant = db.prepare('SELECT COUNT(*) AS count FROM medicines WHERE tenant_id = ?');
const countOrdersForTenant = db.prepare('SELECT COUNT(*) AS count FROM orders WHERE tenant_id = ?');
const usersByTenant = db.prepare('SELECT tenant_id, COUNT(*) AS count FROM users GROUP BY tenant_id');
const employeesByTenant = db.prepare('SELECT tenant_id, COUNT(*) AS count FROM employees GROUP BY tenant_id');
const medicinesByTenant = db.prepare('SELECT tenant_id, COUNT(*) AS count FROM medicines GROUP BY tenant_id');
const ordersByTenant = db.prepare('SELECT tenant_id, COUNT(*) AS count FROM orders GROUP BY tenant_id');
const adminsByTenant = db.prepare(
  `SELECT tenant_id, name, email FROM users WHERE role = 'admin' ORDER BY id`
);

function countMap(stmt) {
  const map = new Map();
  for (const row of stmt.all()) map.set(row.tenant_id, row.count);
  return map;
}

function tenantAdmin(tenantId) {
  return tenantAdminStmt.get(tenantId);
}

function tenantSummary(row) {
  const admin = tenantAdmin(row.id);
  return {
    ...row,
    admin_name: admin?.name || row.contact_name || '',
    admin_email: admin?.email || '',
    modules: JSON.parse(row.modules || '{}'),
    usage: {
      users: countUsersForTenant.get(row.id).count,
      employees: countEmployeesForTenant.get(row.id).count,
      medicines: countMedicinesForTenant.get(row.id).count,
      orders: countOrdersForTenant.get(row.id).count,
    },
  };
}

function summarizeTenants(rows) {
  const usage = {
    users: countMap(usersByTenant),
    employees: countMap(employeesByTenant),
    medicines: countMap(medicinesByTenant),
    orders: countMap(ordersByTenant),
  };
  const admins = new Map();
  for (const admin of adminsByTenant.all()) {
    if (!admins.has(admin.tenant_id)) admins.set(admin.tenant_id, admin);
  }
  return rows.map((row) => {
    const admin = admins.get(row.id);
    return {
      ...row,
      admin_name: admin?.name || row.contact_name || '',
      admin_email: admin?.email || '',
      modules: JSON.parse(row.modules || '{}'),
      usage: {
        users: usage.users.get(row.id) || 0,
        employees: usage.employees.get(row.id) || 0,
        medicines: usage.medicines.get(row.id) || 0,
        orders: usage.orders.get(row.id) || 0,
      },
    };
  });
}

function safeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const storeDirectory = db.prepare(
  `SELECT t.id, t.name, t.slug, t.contact_name, t.contact_email, t.contact_phone,
          COUNT(o.id) AS orderCount
   FROM tenants t
   LEFT JOIN orders o ON o.tenant_id = t.id
   WHERE t.status != 'archived'
   GROUP BY t.id
   ORDER BY t.name COLLATE NOCASE`
);
const storeBySlug = db.prepare(
  `SELECT t.id, t.name, t.slug, t.contact_email, t.contact_phone,
          s.title, s.slogan, s.logo
   FROM tenants t
   LEFT JOIN tenant_settings s ON s.tenant_id = t.id
   WHERE t.slug = ? AND t.status != 'archived'`
);

router.get('/directory', (_req, res) => {
  res.json(storeDirectory.all());
});

router.get('/store/:slug', (req, res) => {
  const store = storeBySlug.get(String(req.params.slug || '').trim().toLowerCase());
  if (!store) return res.status(404).json({ message: 'Store not found' });
  res.json(store);
});

const medicineInStore = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?');

router.get('/store/:slug/product/:product', (req, res) => {
  const store = storeBySlug.get(String(req.params.slug || '').trim().toLowerCase());
  if (!store) return res.status(404).json({ message: 'Store not found' });
  const id = Number(String(req.params.product || '').split('-').pop());
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ message: 'Product not found' });
  const medicine = medicineInStore.get(id, store.id);
  if (!medicine) return res.status(404).json({ message: 'Product not found' });
  res.json({
    slug: productSlug(medicine.name, medicine.id),
    store,
    product: decorateMedicine(medicine, null),
  });
});

router.use(authenticate, requireSuperAdmin);

router.get('/', (_req, res) => {
  const tenants = db
    .prepare('SELECT * FROM tenants ORDER BY datetime(created_at) DESC')
    .all();
  res.json(summarizeTenants(tenants));
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const slug = safeSlug(body.slug || name);
  const adminName = String(body.adminName || '').trim();
  const adminEmail = String(body.adminEmail || '').toLowerCase().trim();
  const adminPassword = String(body.adminPassword || '');
  if (!name || !slug || !adminName || !adminEmail || adminPassword.length < 6) {
    return res.status(400).json({
      message: 'Business name, slug, administrator name/email, and a 6-character password are required',
    });
  }
  if (db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug)) {
    return res.status(409).json({ message: 'This tenant slug is already in use' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)) {
    return res.status(409).json({ message: 'This administrator email is already in use' });
  }

  const modules = { ...DEFAULT_MODULES, ...(body.modules || {}) };
  const create = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO tenants
         (name, slug, plan, billing_cycle, price, trial_end, renewal_date, payment_status,
          contact_name, contact_email, contact_phone, gst_number, address, domain,
          theme_color, font_family, login_banner, homepage_text, language, modules,
          login_initial,
          max_users, max_employees, max_orders, max_medicines, storage_limit_mb)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        name,
        slug,
        body.plan || 'Basic',
        body.billing_cycle === 'yearly' ? 'yearly' : 'monthly',
        Number(body.price || 0),
        body.trial_end || null,
        body.renewal_date || null,
        body.payment_status || 'trial',
        body.contact_name || adminName,
        body.contact_email || adminEmail,
        body.contact_phone || '',
        body.gst_number || '',
        body.address || '',
        body.domain || '',
        body.theme_color || '#1f242c',
        body.font_family || 'Syne',
        body.login_banner || '',
        body.homepage_text || '',
        body.language === 'hi' ? 'hi' : 'en',
        JSON.stringify(modules),
        String(body.login_initial || '').trim().toLowerCase(),
        Number(body.max_users || 50),
        Number(body.max_employees || 50),
        Number(body.max_orders || 10000),
        Number(body.max_medicines || 1000),
        Number(body.storage_limit_mb || 500)
      );
    const tenantId = Number(result.lastInsertRowid);
    db.prepare(
      `INSERT INTO tenant_settings (tenant_id, title, slogan, logo, qr_code)
       VALUES (?, ?, ?, '/assets/shubh-surgical-logo.svg', '/assets/QR.jpeg')`
    ).run(tenantId, body.website_title || name, body.website_slogan || 'Your Trusted Partner in Health and Wellness.');
    const admin = db.prepare(
      `INSERT INTO users (name, email, password, role, phone, address, tenant_id)
       VALUES (?, ?, ?, 'admin', ?, ?, ?)`
    ).run(adminName, adminEmail, bcrypt.hashSync(adminPassword, 10), body.contact_phone || '', body.address || '', tenantId);
    if (body.seedSampleData !== false) {
      const sourceMedicines = db
        .prepare(
          `SELECT name, description, price, wholesale_price, image, stock
           FROM medicines WHERE tenant_id = 1 ORDER BY id LIMIT 12`
        )
        .all();
      const insertMedicine = db.prepare(
        `INSERT INTO medicines
         (name, description, price, wholesale_price, image, stock, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const medicine of sourceMedicines) {
        insertMedicine.run(
          medicine.name, medicine.description, medicine.price, medicine.wholesale_price,
          medicine.image, medicine.stock, Number(admin.lastInsertRowid), tenantId
        );
      }
    }
    log(tenantId, req.user.id, 'tenant_created', `Created ${name} with admin ${adminEmail}`);
    return tenantId;
  });
  const tenantId = create();
  res.status(201).json(tenantSummary(db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId)));
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const current = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ message: 'Tenant not found' });
  const body = req.body || {};
  if (body.name != null || body.admin_name != null || body.contact_phone != null) {
    const business = String(body.name ?? current.name).trim();
    const userName = String(body.admin_name ?? tenantAdmin(id)?.name ?? current.contact_name ?? '').trim();
    const mobile = String(body.contact_phone ?? current.contact_phone ?? '').trim();
    if (!business || !userName || !mobile) {
      return res.status(400).json({ message: 'Business name, User Name, and Mobile Number are required' });
    }
    body.name = business;
    body.admin_name = userName;
    body.contact_name = userName;
    body.contact_phone = mobile;
    const admin = tenantAdmin(id);
    if (admin) {
      db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(userName, mobile, admin.id);
    }
  }
  const modules = body.modules ? JSON.stringify({ ...DEFAULT_MODULES, ...body.modules }) : current.modules;
  const status = ['active', 'suspended', 'archived'].includes(body.status) ? body.status : current.status;
  let contactEmail = body.contact_email ?? current.contact_email;
  if (body.admin_email != null) {
    const adminEmail = String(body.admin_email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return res.status(400).json({ message: 'Enter a valid admin login email' });
    }
    const admin = tenantAdmin(id);
    if (!admin) return res.status(404).json({ message: 'Tenant administrator not found' });
    const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(adminEmail, admin.id);
    if (taken) return res.status(409).json({ message: 'This administrator email is already in use' });
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(adminEmail, admin.id);
    contactEmail = adminEmail;
    log(id, req.user.id, 'admin_email_updated', `Admin login email set to ${adminEmail}`);
  }
  db.prepare(
    `UPDATE tenants SET
       name = ?, status = ?, plan = ?, billing_cycle = ?, price = ?, trial_end = ?, renewal_date = ?,
       payment_status = ?, contact_name = ?, contact_email = ?, contact_phone = ?, gst_number = ?,
       address = ?, domain = ?, theme_color = ?, font_family = ?, login_banner = ?, homepage_text = ?,
       language = ?, modules = ?, login_initial = ?, max_users = ?, max_employees = ?, max_orders = ?, max_medicines = ?,
       storage_limit_mb = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    body.name?.trim() || current.name, status, body.plan || current.plan,
    body.billing_cycle === 'yearly' ? 'yearly' : body.billing_cycle === 'monthly' ? 'monthly' : current.billing_cycle,
    body.price != null ? Number(body.price) : current.price, body.trial_end ?? current.trial_end,
    body.renewal_date ?? current.renewal_date, body.payment_status || current.payment_status,
    body.contact_name ?? current.contact_name, contactEmail,
    body.contact_phone ?? current.contact_phone, body.gst_number ?? current.gst_number,
    body.address ?? current.address, body.domain ?? current.domain, body.theme_color ?? current.theme_color,
    body.font_family ?? current.font_family, body.login_banner ?? current.login_banner,
    body.homepage_text ?? current.homepage_text, body.language === 'hi' ? 'hi' : body.language === 'en' ? 'en' : current.language,
    modules, body.login_initial != null ? String(body.login_initial).trim().toLowerCase() : current.login_initial,
    Number(body.max_users ?? current.max_users), Number(body.max_employees ?? current.max_employees),
    Number(body.max_orders ?? current.max_orders), Number(body.max_medicines ?? current.max_medicines),
    Number(body.storage_limit_mb ?? current.storage_limit_mb), id
  );
  log(id, req.user.id, 'tenant_updated', 'Updated tenant configuration');
  res.json(tenantSummary(db.prepare('SELECT * FROM tenants WHERE id = ?').get(id)));
});

router.patch('/:id/admin-password', (req, res) => {
  const id = Number(req.params.id);
  const password = String(req.body?.password || '');
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  const admin = db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND role = 'admin' ORDER BY id LIMIT 1`).get(id);
  if (!admin) return res.status(404).json({ message: 'Tenant administrator not found' });
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), admin.id);
  log(id, req.user.id, 'admin_password_reset', 'Tenant administrator password reset');
  res.json({ message: 'Tenant administrator password reset' });
});

router.get('/:id/export', (req, res) => {
  const id = Number(req.params.id);
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
  if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
  const backup = {
    generated_at: new Date().toISOString(),
    tenant,
    settings: db.prepare('SELECT * FROM tenant_settings WHERE tenant_id = ?').get(id),
    users: db.prepare('SELECT id, name, email, role, phone, address, status, created_at FROM users WHERE tenant_id = ?').all(id),
    medicines: db.prepare('SELECT * FROM medicines WHERE tenant_id = ?').all(id),
    employees: db.prepare('SELECT * FROM employees WHERE tenant_id = ?').all(id),
    orders: db.prepare('SELECT * FROM orders WHERE tenant_id = ?').all(id),
  };
  log(id, req.user.id, 'tenant_backup_exported', 'Downloaded tenant backup');
  res.setHeader('Content-Disposition', `attachment; filename="${tenant.slug}-backup.json"`);
  res.json(backup);
});

router.get('/:id/audit', (req, res) => {
  res.json(db.prepare(
    `SELECT a.*, u.name AS actor_name FROM tenant_audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id WHERE a.tenant_id = ?
     ORDER BY datetime(a.created_at) DESC LIMIT 100`
  ).all(Number(req.params.id)));
});

router.post('/:id/support', (req, res) => {
  const tenantId = Number(req.params.id);
  const subject = String(req.body?.subject || '').trim();
  if (!subject) return res.status(400).json({ message: 'Support subject is required' });
  const result = db.prepare(
    'INSERT INTO tenant_support_tickets (tenant_id, subject, notes) VALUES (?, ?, ?)'
  ).run(tenantId, subject, String(req.body?.notes || ''));
  log(tenantId, req.user.id, 'support_ticket_created', subject);
  res.status(201).json(db.prepare('SELECT * FROM tenant_support_tickets WHERE id = ?').get(result.lastInsertRowid));
});

function deleteTenantData(id) {
  const remove = db.transaction((tenantId) => {
    db.prepare(
      `DELETE FROM order_items
       WHERE order_id IN (SELECT id FROM orders WHERE tenant_id = ?)
          OR medicine_id IN (SELECT id FROM medicines WHERE tenant_id = ?)`
    ).run(tenantId, tenantId);
    db.prepare('DELETE FROM orders WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM medicines WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM employees WHERE tenant_id = ?').run(tenantId);
    db.prepare(`DELETE FROM users WHERE tenant_id = ? AND role != 'super_admin'`).run(tenantId);
    db.prepare('DELETE FROM tenant_settings WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM tenant_support_tickets WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM tenant_audit_logs WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);
  });
  remove(id);
}

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
  if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
  if (id === 1) return res.status(400).json({ message: 'The primary tenant cannot be deleted' });
  if (req.body?.confirmation !== tenant.name) {
    return res.status(400).json({ message: `Type "${tenant.name}" to confirm` });
  }
  if (req.body?.permanent === true) {
    deleteTenantData(id);
    return res.json({ message: `${tenant.name} and its admin login were deleted` });
  }
  if (req.body?.backupConfirmed !== true) {
    return res.status(400).json({ message: 'Enter the exact tenant name and confirm backup before archiving' });
  }
  db.prepare(`UPDATE tenants SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).run(id);
  log(id, req.user.id, 'tenant_archived', 'Archived after backup confirmation');
  res.json({ message: 'Tenant archived. Its data remains available in the exported backup.' });
});

module.exports = router;
