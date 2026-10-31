const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const db = require('./db');

const EXAMPLE_PASSWORD = 'MallHub2026';
const CLIENT_PASSWORD = 'MallClient2026';

const HUB_HEADERS = [
  'Business name',
  'Slug',
  'Slogan',
  'User name',
  'Admin email',
  'Admin password',
  'Mobile',
  'Address',
  'Plan',
  'Login initial',
  'Theme color',
];
const CLIENT_HEADERS = ['Hub', 'Name', 'Email', 'Phone', 'Address', 'Password'];
const EMPLOYEE_HEADERS = ['Hub', 'Name', 'Email', 'Phone', 'Designation', 'Department', 'Address'];

class WorkbookError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function text(value) {
  if (value == null) return '';
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
  if (missing.length) {
    throw new WorkbookError(400, `${name} sheet is missing ${missing.join(', ')}`);
  }
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

async function buildHubTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'My Stores Hubs';

  const hub = workbook.addWorksheet('Hub');
  hub.addRow(HUB_HEADERS);
  hub.addRow([
    'Shopping Mall',
    'shopping-mall',
    'A mall of shops under one roof',
    'Mall Desk',
    'desk@shopping-mall.mystoreshubs.com',
    EXAMPLE_PASSWORD,
    '9800004001',
    '12 Market Road Pune',
    'Basic',
    '@shoppingmall',
    '#0f766e',
  ]);
  styleSheet(hub);

  const clients = workbook.addWorksheet('Client');
  clients.addRow(CLIENT_HEADERS);
  clients.addRow([
    'Shopping Mall',
    'Neha Rao',
    'neha@shopping-mall.mystoreshubs.com',
    '9800004011',
    '4 Lake View Pune',
    CLIENT_PASSWORD,
  ]);
  clients.addRow([
    'Shopping Mall',
    'Arun Das',
    'arun@shopping-mall.mystoreshubs.com',
    '9800004012',
    '8 Station Road Pune',
    CLIENT_PASSWORD,
  ]);
  styleSheet(clients);

  const employees = workbook.addWorksheet('Employee');
  employees.addRow(EMPLOYEE_HEADERS);
  employees.addRow([
    'Shopping Mall',
    'Riya Nair',
    'riya@shopping-mall.mystoreshubs.com',
    '9800004021',
    'Floor lead',
    'Shop floor',
    '12 Market Road Pune',
  ]);
  employees.addRow([
    'Shopping Mall',
    'Aman Shah',
    'aman@shopping-mall.mystoreshubs.com',
    '9800004022',
    'Stock keeper',
    'Store room',
    '12 Market Road Pune',
  ]);
  styleSheet(employees);

  return workbook.xlsx.writeBuffer();
}

async function importHubWorkbook(buffer, actorId) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const hubs = sheetRows(workbook, 'Hub', HUB_HEADERS);
  const clients = sheetRows(workbook, 'Client', CLIENT_HEADERS);
  const employees = sheetRows(workbook, 'Employee', EMPLOYEE_HEADERS);
  if (hubs.length !== 1) {
    throw new WorkbookError(400, 'The Hub sheet needs exactly one store');
  }
  const hub = hubs[0];
  const name = hub['Business name'];
  const slug = slugify(hub.Slug || name);
  const adminName = hub['User name'];
  const adminEmail = hub['Admin email'].toLowerCase();
  const adminPassword = hub['Admin password'];
  if (!name || !slug || !adminName || !adminEmail.includes('@') || adminPassword.length < 6) {
    throw new WorkbookError(400, 'Hub needs a business name, user name, admin email, and a password of at least 6 characters');
  }
  const sameHub = (row) => row.Hub.trim().toLowerCase() === name.toLowerCase();
  if (clients.some((row) => !sameHub(row)) || employees.some((row) => !sameHub(row))) {
    throw new WorkbookError(400, 'Every Client and Employee row must name the same hub');
  }
  for (const row of clients) {
    if (!row.Name || !row.Email.includes('@') || row.Password.length < 6) {
      throw new WorkbookError(400, `Client ${row.Name || row.Email || ''} needs a name, email, and a password of at least 6 characters`);
    }
  }
  for (const row of employees) {
    if (!row.Name || !row.Email.includes('@') || !row.Phone || !row.Designation) {
      throw new WorkbookError(400, `Employee ${row.Name || row.Email || ''} needs a name, email, phone, and designation`);
    }
  }
  const emails = [adminEmail, ...clients.map((row) => row.Email.toLowerCase()), ...employees.map((row) => row.Email.toLowerCase())];
  if (new Set(emails).size !== emails.length) {
    throw new WorkbookError(400, 'Each email in the workbook must be different');
  }
  if (db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug)) {
    throw new WorkbookError(409, 'This hub slug is already in use');
  }
  const emailTaken = db.prepare('SELECT email FROM users WHERE lower(email) = ?');
  const employeeTaken = db.prepare('SELECT email FROM employees WHERE lower(email) = ?');
  for (const email of emails) {
    if (emailTaken.get(email) || employeeTaken.get(email)) {
      throw new WorkbookError(409, `${email} is already in use`);
    }
  }

  const create = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO tenants
         (name, slug, plan, billing_cycle, price, payment_status, contact_name, contact_email, contact_phone,
          address, theme_color, font_family, homepage_text, login_initial, modules)
         VALUES (?, ?, ?, 'monthly', 0, 'trial', ?, ?, ?, ?, ?, 'Syne', ?, ?, ?)`
      )
      .run(
        name,
        slug,
        hub.Plan || 'Basic',
        adminName,
        adminEmail,
        hub.Mobile || '',
        hub.Address || '',
        hub['Theme color'] || '#0f766e',
        hub.Slogan || '',
        String(hub['Login initial'] || '').trim().toLowerCase(),
        JSON.stringify({ wholesale: true, employees: true, reports: true, qrCheckout: true, coupons: true, prescriptions: false })
      );
    const tenantId = Number(result.lastInsertRowid);
    db.prepare(
      `INSERT INTO tenant_settings (tenant_id, title, slogan, logo, qr_code)
       VALUES (?, ?, ?, '/assets/shubh-surgical-logo.svg', '/assets/QR.jpeg')`
    ).run(tenantId, name, hub.Slogan || name);
    db.prepare(
      `INSERT INTO users (name, email, password, role, phone, address, tenant_id)
       VALUES (?, ?, ?, 'admin', ?, ?, ?)`
    ).run(adminName, adminEmail, bcrypt.hashSync(adminPassword, 10), hub.Mobile || '', hub.Address || '', tenantId);
    const insertClient = db.prepare(
      `INSERT INTO users (name, email, password, role, phone, address, tenant_id)
       VALUES (?, ?, ?, 'user', ?, ?, ?)`
    );
    for (const row of clients) {
      insertClient.run(
        row.Name,
        row.Email.toLowerCase(),
        bcrypt.hashSync(row.Password, 10),
        row.Phone || '',
        row.Address || '',
        tenantId
      );
    }
    const insertEmployee = db.prepare(
      `INSERT INTO employees (name, email, phone, designation, department, address, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of employees) {
      insertEmployee.run(
        row.Name,
        row.Email.toLowerCase(),
        row.Phone,
        row.Designation,
        row.Department || '',
        row.Address || '',
        tenantId
      );
    }
    db.prepare(
      'INSERT INTO tenant_audit_logs (tenant_id, actor_id, action, details) VALUES (?, ?, ?, ?)'
    ).run(tenantId, actorId || null, 'tenant_created', `Workbook created ${name}`);
    return { id: tenantId, name, slug, clients: clients.length, employees: employees.length };
  });
  return create();
}

module.exports = {
  buildHubTemplate,
  importHubWorkbook,
  WorkbookError,
};
