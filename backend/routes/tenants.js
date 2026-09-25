const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();
const DEFAULT_MODULES = {
  wholesale: true,
  employees: true,
  reports: true,
  qrCheckout: true,
  coupons: false,
  prescriptions: false,
};

function log(tenantId, actorId, action, details = '') {
  db.prepare(
    'INSERT INTO tenant_audit_logs (tenant_id, actor_id, action, details) VALUES (?, ?, ?, ?)'
  ).run(tenantId, actorId, action, details);
}

function tenantSummary(row) {
  return {
    ...row,
    modules: JSON.parse(row.modules || '{}'),
    usage: {
      users: db.prepare('SELECT COUNT(*) AS count FROM users WHERE tenant_id = ?').get(row.id).count,
      employees: db.prepare('SELECT COUNT(*) AS count FROM employees WHERE tenant_id = ?').get(row.id).count,
      medicines: db.prepare('SELECT COUNT(*) AS count FROM medicines WHERE tenant_id = ?').get(row.id).count,
      orders: db.prepare('SELECT COUNT(*) AS count FROM orders WHERE tenant_id = ?').get(row.id).count,
    },
  };
}

function safeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

router.use(authenticate, requireSuperAdmin);

router.get('/', (_req, res) => {
  const tenants = db
    .prepare('SELECT * FROM tenants ORDER BY datetime(created_at) DESC')
    .all()
    .map(tenantSummary);
  res.json(tenants);
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
          max_users, max_employees, max_orders, max_medicines, storage_limit_mb)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
  const modules = body.modules ? JSON.stringify({ ...DEFAULT_MODULES, ...body.modules }) : current.modules;
  const status = ['active', 'suspended', 'archived'].includes(body.status) ? body.status : current.status;
  db.prepare(
    `UPDATE tenants SET
       name = ?, status = ?, plan = ?, billing_cycle = ?, price = ?, trial_end = ?, renewal_date = ?,
       payment_status = ?, contact_name = ?, contact_email = ?, contact_phone = ?, gst_number = ?,
       address = ?, domain = ?, theme_color = ?, font_family = ?, login_banner = ?, homepage_text = ?,
       language = ?, modules = ?, max_users = ?, max_employees = ?, max_orders = ?, max_medicines = ?,
       storage_limit_mb = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    body.name?.trim() || current.name, status, body.plan || current.plan,
    body.billing_cycle === 'yearly' ? 'yearly' : body.billing_cycle === 'monthly' ? 'monthly' : current.billing_cycle,
    body.price != null ? Number(body.price) : current.price, body.trial_end ?? current.trial_end,
    body.renewal_date ?? current.renewal_date, body.payment_status || current.payment_status,
    body.contact_name ?? current.contact_name, body.contact_email ?? current.contact_email,
    body.contact_phone ?? current.contact_phone, body.gst_number ?? current.gst_number,
    body.address ?? current.address, body.domain ?? current.domain, body.theme_color ?? current.theme_color,
    body.font_family ?? current.font_family, body.login_banner ?? current.login_banner,
    body.homepage_text ?? current.homepage_text, body.language === 'hi' ? 'hi' : body.language === 'en' ? 'en' : current.language,
    modules, Number(body.max_users ?? current.max_users), Number(body.max_employees ?? current.max_employees),
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

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
  if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
  if (id === 1) return res.status(400).json({ message: 'The primary tenant cannot be deleted' });
  if (req.body?.confirmation !== tenant.name || req.body?.backupConfirmed !== true) {
    return res.status(400).json({ message: 'Enter the exact tenant name and confirm backup before archiving' });
  }
  db.prepare(`UPDATE tenants SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).run(id);
  log(id, req.user.id, 'tenant_archived', 'Archived after backup confirmation');
  res.json({ message: 'Tenant archived. Its data remains available in the exported backup.' });
});

module.exports = router;
