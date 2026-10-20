const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireAdmin, requireTenantLimit, optionalUser } = require('../middleware/auth');
const { decorateMedicine } = require('../pricing');
const { pageQuery, pagePayload } = require('../paging');
const { imageFileFilter, safeImageExt, ensureUploadDir, unlinkStored } = require('../uploads');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ensureUploadDir()),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${safeImageExt(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const activeTenant = db.prepare(`SELECT id FROM tenants WHERE id = ? AND status != 'archived'`);
const countMedicines = db.prepare(
  `SELECT COUNT(*) AS count FROM medicines
   WHERE tenant_id = ? AND (? = '' OR name LIKE ? COLLATE NOCASE OR IFNULL(description, '') LIKE ? COLLATE NOCASE)
     AND (? = '' OR category = ? COLLATE NOCASE)`
);
const listMedicines = db.prepare(
  `SELECT * FROM medicines
   WHERE tenant_id = ? AND (? = '' OR name LIKE ? COLLATE NOCASE OR IFNULL(description, '') LIKE ? COLLATE NOCASE)
     AND (? = '' OR category = ? COLLATE NOCASE)
   ORDER BY created_at DESC
   LIMIT ? OFFSET ?`
);
const listCategories = db.prepare(
  `SELECT DISTINCT category FROM medicines
   WHERE tenant_id = ? AND trim(category) != ''
   ORDER BY category COLLATE NOCASE`
);

function tenantFromRequest(req) {
  const user = optionalUser(req);
  const requested = Number(req.query.tenantId);
  const tenantExists =
    Number.isInteger(requested) && requested > 0 && activeTenant.get(requested);
  return { user, tenantId: tenantExists ? requested : user?.tenant_id || 1 };
}

router.get('/', (req, res) => {
  const { user, tenantId } = tenantFromRequest(req);
  const { page, limit, offset, q, like } = pageQuery(req, 12);
  const category = String(req.query.category || '').trim();
  const total = countMedicines.get(tenantId, q, like, like, category, category).count;
  const medicines = listMedicines
    .all(tenantId, q, like, like, category, category, limit, offset)
    .map((m) => decorateMedicine(m, user));
  res.json(pagePayload(medicines, total, page, limit));
});

router.get('/categories', (req, res) => {
  const { tenantId } = tenantFromRequest(req);
  res.json(listCategories.all(tenantId).map((row) => row.category));
});

router.get('/:id', (req, res) => {
  const user = optionalUser(req);
  const medicine = db
    .prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?')
    .get(req.params.id, user?.tenant_id || 1);
  if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
  res.json(decorateMedicine(medicine, optionalUser(req)));
});

router.post('/', authenticate, requireAdmin, requireTenantLimit('medicines', 'medicines'), upload.single('image'), (req, res) => {
  const { name, description, price, wholesale_price, stock, category } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ message: 'Name and price are required' });
  }
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const wholesale =
    wholesale_price === undefined || wholesale_price === '' ? null : Number(wholesale_price);
  const result = db
    .prepare(
      `INSERT INTO medicines (name, description, price, wholesale_price, image, stock, category, created_by, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      description || '',
      Number(price),
      wholesale,
      image,
      Number(stock || 0),
      String(category || '').trim(),
      req.user.id,
      req.user.tenant_id
    );
  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(medicine);
});

router.put('/:id', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });

  const { name, description, price, wholesale_price, stock, category } = req.body;
  let image = existing.image;
  if (req.file) {
    unlinkStored(existing.image);
    image = `/uploads/${req.file.filename}`;
  }

  let wholesale = existing.wholesale_price;
  if (wholesale_price !== undefined) {
    wholesale = wholesale_price === '' ? null : Number(wholesale_price);
  }

  db.prepare(
    `UPDATE medicines SET name = ?, description = ?, price = ?, wholesale_price = ?, image = ?, stock = ?, category = ?
     WHERE id = ? AND tenant_id = ?`
  ).run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    price !== undefined ? Number(price) : existing.price,
    wholesale,
    image,
    stock !== undefined ? Number(stock) : existing.stock,
    category !== undefined ? String(category).trim() : existing.category || '',
    req.params.id,
    req.user.tenant_id
  );

  res.json(db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id));
});

router.patch('/:id/restock', authenticate, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });
  const quantity = Number(req.body?.quantity);
  if (!quantity || quantity < 1) {
    return res.status(400).json({ message: 'Restock quantity must be at least 1' });
  }
  db.prepare('UPDATE medicines SET stock = stock + ? WHERE id = ? AND tenant_id = ?').run(quantity, req.params.id, req.user.tenant_id);
  res.json(db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id));
});

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
});
const countForTenant = db.prepare('SELECT COUNT(*) AS count FROM medicines WHERE tenant_id = ?');
const maxForTenant = db.prepare('SELECT max_medicines AS max FROM tenants WHERE id = ?');
const insertImported = db.prepare(
  `INSERT INTO medicines (name, description, price, wholesale_price, image, stock, category, created_by, tenant_id)
   VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`
);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => String(value).trim()));
}

router.post('/import', authenticate, requireAdmin, csvUpload.single('file'), (req, res) => {
  const text = req.file ? req.file.buffer.toString('utf8') : String(req.body?.csv || '');
  const table = parseCsv(text);
  if (table.length < 2) {
    return res.status(400).json({ message: 'The spreadsheet needs a header row and at least one product' });
  }
  const headers = table[0].map((header) => String(header).trim().toLowerCase());
  const index = (name) => headers.indexOf(name);
  const nameAt = index('name');
  const priceAt = index('price');
  const stockAt = index('stock');
  const descriptionAt = index('description');
  const categoryAt = index('category');
  const wholesaleAt = index('wholesale_price');
  if (nameAt < 0 || priceAt < 0) {
    return res.status(400).json({ message: 'The header row must include name and price' });
  }
  const room = Math.max(0,
    Number(maxForTenant.get(req.user.tenant_id)?.max || 1000) - countForTenant.get(req.user.tenant_id).count
  );
  let created = 0;
  let skipped = 0;
  const insert = db.transaction((lines) => {
    for (const line of lines) {
      if (created >= room) {
        skipped += 1;
        continue;
      }
      const name = String(line[nameAt] || '').trim();
      const price = Number(line[priceAt]);
      if (!name || !Number.isFinite(price) || price < 0) {
        skipped += 1;
        continue;
      }
      const stock = stockAt >= 0 ? Number(line[stockAt] || 0) : 0;
      const wholesale = wholesaleAt >= 0 && String(line[wholesaleAt] || '').trim() !== ''
        ? Number(line[wholesaleAt])
        : null;
      if (!Number.isFinite(stock) || stock < 0 || (wholesale !== null && (!Number.isFinite(wholesale) || wholesale < 0))) {
        skipped += 1;
        continue;
      }
      insertImported.run(
        name,
        descriptionAt >= 0 ? String(line[descriptionAt] || '').trim() : '',
        price,
        wholesale,
        stock,
        categoryAt >= 0 ? String(line[categoryAt] || '').trim() : '',
        req.user.id,
        req.user.tenant_id
      );
      created += 1;
    }
  });
  insert(table.slice(1, 501));
  res.status(201).json({ created, skipped });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });
  unlinkStored(existing.image);
  db.prepare('DELETE FROM medicines WHERE id = ? AND tenant_id = ?').run(req.params.id, req.user.tenant_id);
  res.json({ message: 'Medicine deleted' });
});

module.exports = router;
