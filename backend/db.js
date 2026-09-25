const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(path.join(dataDir, 'medishop.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'user')) DEFAULT 'user',
    phone TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'allowed' CHECK(status IN ('allowed', 'blocked')),
    client_group TEXT NOT NULL DEFAULT 'retail' CHECK(client_group IN ('retail', 'wholesale')),
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    wholesale_price REAL,
    image TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bill_number TEXT NOT NULL UNIQUE,
    po_number TEXT,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'approved', 'cancelled', 'rejected', 'dispatched')),
    qr_code TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    designation TEXT NOT NULL,
    department TEXT,
    address TEXT,
    joining_date TEXT,
    image TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    medicine_id INTEGER,
    medicine_name TEXT NOT NULL,
    medicine_image TEXT,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id)
  );
`);

// Migrate databases created before the super_admin role was introduced.
(() => {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
    .get();
  if (!row?.sql || row.sql.includes("'super_admin'")) return;
  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'user')) DEFAULT 'user',
      phone TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'allowed' CHECK(status IN ('allowed', 'blocked')),
      client_group TEXT NOT NULL DEFAULT 'retail' CHECK(client_group IN ('retail', 'wholesale')),
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO users_new
      (id, name, email, password, role, phone, address, status, client_group, notes, created_at)
    SELECT id, name, email, password, role, phone, address,
      COALESCE(status, 'allowed'), COALESCE(client_group, 'retail'), COALESCE(notes, ''), created_at
    FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
})();

db.exec(`
  CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL DEFAULT 'Shubh Surgical',
    slogan TEXT NOT NULL DEFAULT 'Your Trusted Partner in Health and Wellness.',
    logo TEXT NOT NULL DEFAULT '/assets/shubh-surgical-logo.svg',
    qr_code TEXT NOT NULL DEFAULT '/assets/QR.jpeg',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);
db.prepare(
  `INSERT OR IGNORE INTO site_settings (id, title, slogan, logo, qr_code)
   VALUES (1, 'Shubh Surgical', 'Your Trusted Partner in Health and Wellness.',
   '/assets/shubh-surgical-logo.svg', '/assets/QR.jpeg')`
).run();

db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'archived')),
    plan TEXT NOT NULL DEFAULT 'Basic',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly', 'yearly')),
    price REAL NOT NULL DEFAULT 0,
    trial_end TEXT,
    renewal_date TEXT,
    payment_status TEXT NOT NULL DEFAULT 'trial' CHECK(payment_status IN ('trial', 'paid', 'overdue', 'cancelled')),
    contact_name TEXT DEFAULT '',
    contact_email TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    gst_number TEXT DEFAULT '',
    address TEXT DEFAULT '',
    domain TEXT DEFAULT '',
    theme_color TEXT DEFAULT '#1f242c',
    font_family TEXT DEFAULT 'Syne',
    login_banner TEXT DEFAULT '',
    homepage_text TEXT DEFAULT '',
    language TEXT DEFAULT 'en',
    modules TEXT NOT NULL DEFAULT '{"wholesale":true,"employees":true,"reports":true,"qrCheckout":true,"coupons":false,"prescriptions":false}',
    max_users INTEGER NOT NULL DEFAULT 50,
    max_employees INTEGER NOT NULL DEFAULT 50,
    max_orders INTEGER NOT NULL DEFAULT 10000,
    max_medicines INTEGER NOT NULL DEFAULT 1000,
    storage_limit_mb INTEGER NOT NULL DEFAULT 500,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    slogan TEXT NOT NULL,
    logo TEXT NOT NULL DEFAULT '/assets/shubh-surgical-logo.svg',
    qr_code TEXT NOT NULL DEFAULT '/assets/QR.jpeg',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS tenant_support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'closed')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS tenant_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    actor_id INTEGER,
    action TEXT NOT NULL,
    details TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
db.prepare(
  `INSERT OR IGNORE INTO tenants (id, name, slug, contact_name, contact_email, plan, payment_status)
   VALUES (1, 'Shubh Surgical', 'shubh-surgical', 'Admin', 'admin@shubhsurgical.com', 'Professional', 'paid')`
).run();
db.prepare(
  `INSERT OR IGNORE INTO tenant_settings (tenant_id, title, slogan, logo, qr_code)
   SELECT 1, title, slogan, logo, qr_code FROM site_settings WHERE id = 1`
).run();

for (const table of ['users', 'medicines', 'orders', 'employees']) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === 'tenant_id')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1`);
  }
}

const superAdmin = db
  .prepare('SELECT id FROM users WHERE email = ?')
  .get('asitkumarsinha@gmail.com');
if (!superAdmin) {
  const hash = bcrypt.hashSync('Shivansh2026', 10);
  db.prepare(
    `INSERT INTO users (name, email, password, role, phone, address)
     VALUES (?, ?, ?, 'super_admin', ?, ?)`
  ).run('Asit Kumar Sinha', 'asitkumarsinha@gmail.com', hash, '', '');
}

const admin = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
if (!admin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    `INSERT INTO users (name, email, password, role, phone, address)
     VALUES (?, ?, ?, 'admin', ?, ?)`
  ).run('Admin', 'admin@shubhsurgical.com', hash, '9999999999', 'Shubh Surgical HQ');
}

const userCount = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role = ?').get('user').c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('user123', 10);
  db.prepare(
    `INSERT INTO users (name, email, password, role, phone, address)
     VALUES (?, ?, ?, 'user', ?, ?)`
  ).run('Demo User', 'user@shubhsurgical.com', hash, '8888888888', '123 Health Street');
}

const medCount = db.prepare('SELECT COUNT(*) AS c FROM medicines').get().c;
const sampleImages = {
  'Paracetamol 500mg': '/assets/medicines/paracetamol.svg',
  'Amoxicillin 250mg': '/assets/medicines/amoxicillin.svg',
  'Cetirizine 10mg': '/assets/medicines/cetirizine.svg',
  'Vitamin D3 60K': '/assets/medicines/vitamin-d3.svg',
  'Cough Syrup 100ml': '/assets/medicines/cough-syrup.svg',
  'ORS Sachet': '/assets/medicines/ors.svg',
};

if (medCount === 0) {
  const insert = db.prepare(
    `INSERT INTO medicines (name, description, price, image, stock, created_by)
     VALUES (?, ?, ?, ?, ?, 1)`
  );
  const seed = [
    ['Paracetamol 500mg', 'Pain relief and fever reducer. Strip of 10 tablets.', 45.0, sampleImages['Paracetamol 500mg'], 200],
    ['Amoxicillin 250mg', 'Antibiotic capsules for bacterial infections.', 120.0, sampleImages['Amoxicillin 250mg'], 150],
    ['Cetirizine 10mg', 'Antihistamine for allergy relief.', 35.0, sampleImages['Cetirizine 10mg'], 180],
    ['Vitamin D3 60K', 'Weekly vitamin D supplement softgels.', 95.0, sampleImages['Vitamin D3 60K'], 100],
    ['Cough Syrup 100ml', 'Relieves dry and productive cough.', 85.0, sampleImages['Cough Syrup 100ml'], 80],
    ['ORS Sachet', 'Oral rehydration salts for dehydration.', 20.0, sampleImages['ORS Sachet'], 300],
  ];
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(...r)));
  tx(seed);
}

// Attach sample catalogue images when missing or pointing at deleted uploads
(() => {
  const rows = db.prepare('SELECT id, name, image FROM medicines').all();
  const update = db.prepare('UPDATE medicines SET image = ? WHERE id = ?');
  for (const row of rows) {
    const sample = sampleImages[row.name] || '/assets/medicines/default.svg';
    if (!row.image) {
      update.run(sample, row.id);
      continue;
    }
    if (row.image.startsWith('/uploads/')) {
      const diskPath = path.join(__dirname, row.image.replace(/^\//, ''));
      if (!fs.existsSync(diskPath)) {
        update.run(sample, row.id);
      }
    }
  }
})();

(() => {
  const cols = db.prepare(`PRAGMA table_info(users)`).all();
  if (!cols.some((c) => c.name === 'status')) {
    db.exec(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'allowed'`);
  }
  if (!cols.some((c) => c.name === 'client_group')) {
    db.exec(`ALTER TABLE users ADD COLUMN client_group TEXT NOT NULL DEFAULT 'retail'`);
  }
  if (!cols.some((c) => c.name === 'notes')) {
    db.exec(`ALTER TABLE users ADD COLUMN notes TEXT DEFAULT ''`);
  }
})();

(() => {
  const cols = db.prepare(`PRAGMA table_info(medicines)`).all();
  if (!cols.some((c) => c.name === 'wholesale_price')) {
    db.exec(`ALTER TABLE medicines ADD COLUMN wholesale_price REAL`);
  }
})();

// Migrate existing DBs to allow 'rejected' status (SQLite cannot ALTER CHECK)
(() => {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'`)
    .get();
  if (row?.sql && !row.sql.includes("'rejected'")) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN;
      CREATE TABLE orders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        bill_number TEXT NOT NULL UNIQUE,
        po_number TEXT,
        total REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'approved', 'cancelled', 'rejected', 'dispatched')),
        qr_code TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      INSERT INTO orders_new
        (id, user_id, bill_number, po_number, total, status, qr_code, created_at, updated_at)
        SELECT id, user_id, bill_number, po_number, total, status, qr_code, created_at, updated_at
        FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_new RENAME TO orders;
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  }
})();

db.prepare(
  `UPDATE users SET email = replace(email, '@medishop.com', '@shubhsurgical.com')
   WHERE email LIKE '%@medishop.com'`
).run();

module.exports = db;
