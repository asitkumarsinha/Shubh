const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const db = require('./db');
const { WorkbookError } = require('./hub-workbook');

const STORE_HEADERS = ['Store', 'Slug', 'Mobile', 'Address', 'Status'];
const HUB_HEADERS = [
  'Business name',
  'Slug',
  'Status',
  'Plan',
  'Billing cycle',
  'Price',
  'Payment',
  'Admin name',
  'Admin email',
  'Admin password',
  'Mobile',
  'Address',
  'Login initial',
  'Theme color',
  'Domain',
  'Slogan',
];
const EMPLOYEE_HEADERS = ['Hub', 'Name', 'Email', 'Phone', 'Designation', 'Department', 'Address', 'Joining date'];
const STATUSES = new Set(['active', 'suspended', 'archived']);
const BILLING = new Set(['monthly', 'yearly']);
const PAYMENTS = new Set(['trial', 'paid', 'overdue', 'cancelled']);

function text(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (value.text != null) return text(value.text);
    if (value.result != null) return text(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
  }
  return String(value).trim();
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function sheetRows(workbook, name, headers) {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) throw new WorkbookError(400, `The workbook needs a ${name} sheet`);
  const found = sheet.getRow(1).values.slice(1).map((cell) => text(cell));
  const missing = headers.filter((header) => !found.includes(header));
  if (missing.length) throw new WorkbookError(400, `${name} sheet is missing ${missing.join(', ')}`);
  const rows = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const item = {};
    found.forEach((header, index) => {
      item[header] = text(row.getCell(index + 1).value);
    });
    if (Object.values(item).some(Boolean)) rows.push(item);
  });
  return rows;
}

function styleSheet(sheet) {
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 28;
  });
}

function oneOf(value, allowed, fallback) {
  const next = String(value || '').trim().toLowerCase();
  return allowed.has(next) ? next : fallback;
}

const listHubs = db.prepare(
  `SELECT t.id, t.name, t.slug, t.status, t.plan, t.billing_cycle, t.price, t.payment_status,
          t.contact_name, t.contact_email, t.contact_phone, t.address, t.login_initial, t.theme_color, t.domain,
          IFNULL(s.slogan, '') AS slogan,
          IFNULL(a.name, t.contact_name) AS admin_name,
          IFNULL(a.email, t.contact_email) AS admin_email
   FROM tenants t
   LEFT JOIN tenant_settings s ON s.tenant_id = t.id
   LEFT JOIN (
     SELECT u.tenant_id, u.name, u.email
     FROM users u
     JOIN (
       SELECT tenant_id, MIN(id) AS id FROM users WHERE role = 'admin' GROUP BY tenant_id
     ) first ON first.id = u.id
   ) a ON a.tenant_id = t.id
   ORDER BY t.name COLLATE NOCASE`
);
const listEmployees = db.prepare(
  `SELECT t.name AS hub, e.name, e.email, e.phone, e.designation, e.department, e.address, e.joining_date
   FROM employees e
   JOIN tenants t ON t.id = e.tenant_id
   ORDER BY t.name COLLATE NOCASE, e.name COLLATE NOCASE`
);
const updateHub = db.prepare(
  `UPDATE tenants
   SET name = ?, status = ?, plan = ?, billing_cycle = ?, price = ?, payment_status = ?,
       contact_name = ?, contact_email = ?, contact_phone = ?, address = ?, login_initial = ?,
       theme_color = ?, domain = ?, updated_at = datetime('now')
   WHERE id = ?`
);
const updateSlogan = db.prepare('UPDATE tenant_settings SET title = ?, slogan = ? WHERE tenant_id = ?');
const updateAdmin = db.prepare('UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?');
const updateAdminPassword = db.prepare(
  'UPDATE users SET name = ?, email = ?, phone = ?, address = ?, password = ? WHERE id = ?'
);
const insertHub = db.prepare(
  `INSERT INTO tenants
   (name, slug, status, plan, billing_cycle, price, payment_status, contact_name, contact_email,
    contact_phone, address, theme_color, domain, login_initial, font_family, homepage_text, modules)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Syne', ?, ?)`
);
const insertSettings = db.prepare(
  `INSERT INTO tenant_settings (tenant_id, title, slogan, logo, qr_code)
   VALUES (?, ?, ?, '/assets/shubh-surgical-logo.svg', '/assets/QR.jpeg')`
);
const insertAdmin = db.prepare(
  `INSERT INTO users (name, email, password, role, phone, address, tenant_id)
   VALUES (?, ?, ?, 'admin', ?, ?, ?)`
);
const updateStore = db.prepare(
  `UPDATE tenants
   SET name = ?, contact_phone = ?, address = ?, status = ?, updated_at = datetime('now')
   WHERE id = ?`
);
const updateStoreTitle = db.prepare('UPDATE tenant_settings SET title = ? WHERE tenant_id = ?');
const updateEmployee = db.prepare(
  `UPDATE employees
   SET name = ?, phone = ?, designation = ?, department = ?, address = ?, joining_date = ?, tenant_id = ?
   WHERE id = ?`
);
const insertEmployee = db.prepare(
  `INSERT INTO employees (name, email, phone, designation, department, address, joining_date, tenant_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertAudit = db.prepare(
  'INSERT INTO tenant_audit_logs (tenant_id, actor_id, action, details) VALUES (?, ?, ?, ?)'
);
const firstTenant = db.prepare('SELECT id FROM tenants ORDER BY id LIMIT 1');
const DEFAULT_MODULES = JSON.stringify({
  wholesale: true,
  employees: true,
  reports: true,
  qrCheckout: true,
  coupons: true,
  prescriptions: false,
});

async function exportPlatformWorkbook() {
  const hubs = listHubs.all();
  const employees = listEmployees.all();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'My Stores Hubs';

  const stores = workbook.addWorksheet('Stores');
  stores.addRow(STORE_HEADERS);
  for (const hub of hubs) {
    stores.addRow([hub.name, hub.slug, hub.contact_phone || '', hub.address || '', hub.status]);
  }
  styleSheet(stores);

  const hubSheet = workbook.addWorksheet('Hubs');
  hubSheet.addRow(HUB_HEADERS);
  for (const hub of hubs) {
    hubSheet.addRow([
      hub.name,
      hub.slug,
      hub.status,
      hub.plan,
      hub.billing_cycle,
      hub.price,
      hub.payment_status,
      hub.admin_name || '',
      hub.admin_email || '',
      '',
      hub.contact_phone || '',
      hub.address || '',
      hub.login_initial || '',
      hub.theme_color || '',
      hub.domain || '',
      hub.slogan || '',
    ]);
  }
  styleSheet(hubSheet);

  const staff = workbook.addWorksheet('Employees');
  staff.addRow(EMPLOYEE_HEADERS);
  for (const row of employees) {
    staff.addRow([
      row.hub,
      row.name,
      row.email,
      row.phone,
      row.designation,
      row.department || '',
      row.address || '',
      row.joining_date || '',
    ]);
  }
  styleSheet(staff);

  return workbook.xlsx.writeBuffer();
}

function rememberTenant(index, row) {
  index.bySlug.set(row.slug, row);
  index.byName.set(String(row.name || '').toLowerCase(), row);
}

function renameTenant(index, row, name) {
  const previous = String(row.name || '').toLowerCase();
  const next = name.toLowerCase();
  if (previous !== next) index.byName.delete(previous);
  row.name = name;
  index.byName.set(next, row);
}

function findTenant(index, slug, name) {
  if (slug && index.bySlug.has(slug)) return index.bySlug.get(slug);
  if (name) return index.byName.get(name.toLowerCase()) || null;
  return null;
}

function loadIndex() {
  const index = { bySlug: new Map(), byName: new Map(), admins: new Map(), emails: new Map(), employees: new Map() };
  for (const row of listHubs.all()) rememberTenant(index, row);
  for (const admin of db.prepare(`SELECT id, tenant_id, name, email FROM users WHERE role = 'admin' ORDER BY id`).all()) {
    if (!index.admins.has(admin.tenant_id)) index.admins.set(admin.tenant_id, admin);
  }
  for (const user of db.prepare('SELECT id, email FROM users').all()) {
    index.emails.set(String(user.email || '').toLowerCase(), user.id);
  }
  for (const employee of db.prepare('SELECT id, email FROM employees').all()) {
    index.employees.set(String(employee.email || '').toLowerCase(), employee.id);
  }
  return index;
}

async function importPlatformWorkbook(buffer, actorId) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const stores = sheetRows(workbook, 'Stores', STORE_HEADERS);
  const hubs = sheetRows(workbook, 'Hubs', HUB_HEADERS);
  const employees = sheetRows(workbook, 'Employees', EMPLOYEE_HEADERS);

  const result = db.transaction(() => {
    const index = loadIndex();
    let createdHubs = 0;
    let createdEmployees = 0;

    for (const row of hubs) {
      const name = row['Business name'];
      const slug = slugify(row.Slug || name);
      if (!name || !slug) throw new WorkbookError(400, 'Each hub needs a business name');
      const status = oneOf(row.Status, STATUSES, '');
      if (row.Status && !status) throw new WorkbookError(400, `${name} has a status that is not active, suspended, or archived`);
      const existing = findTenant(index, slug, name);
      const adminEmail = row['Admin email'].toLowerCase();
      const adminName = row['Admin name'];
      const password = row['Admin password'];
      if (existing) {
        updateHub.run(
          name,
          status || existing.status,
          row.Plan || existing.plan,
          oneOf(row['Billing cycle'], BILLING, existing.billing_cycle),
          row.Price === '' ? existing.price : Number(row.Price) || 0,
          oneOf(row.Payment, PAYMENTS, existing.payment_status),
          adminName || existing.contact_name,
          adminEmail || existing.contact_email,
          row.Mobile || '',
          row.Address || '',
          String(row['Login initial'] || existing.login_initial || '').trim().toLowerCase(),
          row['Theme color'] || existing.theme_color,
          row.Domain || '',
          existing.id
        );
        updateSlogan.run(name, row.Slogan || name, existing.id);
        renameTenant(index, existing, name);
        const admin = index.admins.get(existing.id);
        if (admin && (adminName || adminEmail || password)) {
          if (adminEmail && adminEmail !== String(admin.email || '').toLowerCase()) {
            const taken = index.emails.get(adminEmail);
            if (taken && taken !== admin.id) throw new WorkbookError(409, `${adminEmail} is already in use`);
          }
          if (password && password.length < 6) throw new WorkbookError(400, `${name} needs an admin password of at least 6 characters`);
          const nextName = adminName || admin.name;
          const nextEmail = adminEmail || admin.email;
          if (password) {
            updateAdminPassword.run(nextName, nextEmail, row.Mobile || '', row.Address || '', bcrypt.hashSync(password, 10), admin.id);
          } else {
            updateAdmin.run(nextName, nextEmail, row.Mobile || '', row.Address || '', admin.id);
          }
          if (admin.email) index.emails.delete(String(admin.email).toLowerCase());
          admin.name = nextName;
          admin.email = nextEmail;
          index.emails.set(String(nextEmail).toLowerCase(), admin.id);
        }
      } else {
        if (!adminName || !adminEmail.includes('@') || password.length < 6) {
          throw new WorkbookError(400, `${name} is a new hub and needs an admin name, email, and a password of at least 6 characters`);
        }
        if (index.emails.has(adminEmail)) throw new WorkbookError(409, `${adminEmail} is already in use`);
        const inserted = insertHub.run(
          name,
          slug,
          status || 'active',
          row.Plan || 'Basic',
          oneOf(row['Billing cycle'], BILLING, 'monthly'),
          Number(row.Price) || 0,
          oneOf(row.Payment, PAYMENTS, 'trial'),
          adminName,
          adminEmail,
          row.Mobile || '',
          row.Address || '',
          row['Theme color'] || '#0f766e',
          row.Domain || '',
          String(row['Login initial'] || '').trim().toLowerCase(),
          row.Slogan || '',
          DEFAULT_MODULES
        );
        const tenantId = Number(inserted.lastInsertRowid);
        insertSettings.run(tenantId, name, row.Slogan || name);
        const admin = insertAdmin.run(adminName, adminEmail, bcrypt.hashSync(password, 10), row.Mobile || '', row.Address || '', tenantId);
        const created = {
          id: tenantId,
          name,
          slug,
          status: status || 'active',
          plan: row.Plan || 'Basic',
          billing_cycle: oneOf(row['Billing cycle'], BILLING, 'monthly'),
          price: Number(row.Price) || 0,
          payment_status: oneOf(row.Payment, PAYMENTS, 'trial'),
          contact_name: adminName,
          contact_email: adminEmail,
          login_initial: String(row['Login initial'] || '').trim().toLowerCase(),
          theme_color: row['Theme color'] || '#0f766e',
        };
        rememberTenant(index, created);
        index.admins.set(tenantId, { id: Number(admin.lastInsertRowid), tenant_id: tenantId, name: adminName, email: adminEmail });
        index.emails.set(adminEmail, Number(admin.lastInsertRowid));
        createdHubs += 1;
      }
    }

    for (const row of stores) {
      const slug = slugify(row.Slug || row.Store);
      const existing = findTenant(index, slug, row.Store);
      if (!existing) throw new WorkbookError(400, `Store ${row.Store || slug} is not in the Hubs sheet`);
      const status = oneOf(row.Status, STATUSES, '');
      if (row.Status && !status) throw new WorkbookError(400, `${row.Store} has a status that is not active, suspended, or archived`);
      const storeName = row.Store || existing.name;
      updateStore.run(storeName, row.Mobile || '', row.Address || '', status || existing.status, existing.id);
      updateStoreTitle.run(storeName, existing.id);
      existing.status = status || existing.status;
      renameTenant(index, existing, storeName);
    }

    for (const row of employees) {
      if (!row.Name || !row.Email.includes('@') || !row.Phone || !row.Designation) {
        throw new WorkbookError(400, `Employee ${row.Name || row.Email || ''} needs a name, email, phone, and designation`);
      }
      const hub = findTenant(index, slugify(row.Hub), row.Hub);
      if (!hub) throw new WorkbookError(400, `Employee ${row.Name} names a hub that is not in this workbook`);
      const email = row.Email.toLowerCase();
      const current = index.employees.get(email);
      if (current) {
        updateEmployee.run(row.Name, row.Phone, row.Designation, row.Department || '', row.Address || '', row['Joining date'] || '', hub.id, current);
      } else {
        const inserted = insertEmployee.run(
          row.Name,
          email,
          row.Phone,
          row.Designation,
          row.Department || '',
          row.Address || '',
          row['Joining date'] || '',
          hub.id
        );
        index.employees.set(email, Number(inserted.lastInsertRowid));
        createdEmployees += 1;
      }
    }

    const home = firstTenant.get();
    if (home) {
      insertAudit.run(home.id, actorId || null, 'platform_import', `Imported ${hubs.length} hubs, ${stores.length} stores, ${employees.length} employees`);
    }
    return { hubs: hubs.length, stores: stores.length, employees: employees.length, createdHubs, createdEmployees };
  });

  return result();
}

module.exports = { exportPlatformWorkbook, importPlatformWorkbook };
