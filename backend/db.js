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
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')) DEFAULT 'user',
    phone TEXT,
    address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
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

const admin = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
if (!admin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    `INSERT INTO users (name, email, password, role, phone, address)
     VALUES (?, ?, ?, 'admin', ?, ?)`
  ).run('Admin', 'admin@medishop.com', hash, '9999999999', 'Shubh Surgical HQ');
}

const userCount = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role = ?').get('user').c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('user123', 10);
  db.prepare(
    `INSERT INTO users (name, email, password, role, phone, address)
     VALUES (?, ?, ?, 'user', ?, ?)`
  ).run('Demo User', 'user@medishop.com', hash, '8888888888', '123 Health Street');
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

module.exports = db;
