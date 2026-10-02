const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireAdmin, requireTenantLimit, optionalUser } = require('../middleware/auth');
const { decorateMedicine } = require('../pricing');
const { pageQuery, pagePayload } = require('../paging');
const { imageFileFilter, safeImageExt } = require('../uploads');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${safeImageExt(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

router.get('/', (req, res) => {
  const user = optionalUser(req);
  const tenantId = user?.tenant_id || 1;
  const { page, limit, offset, q, like } = pageQuery(req, 12);
  const where = `tenant_id = ? AND (? = '' OR name LIKE ? COLLATE NOCASE OR IFNULL(description, '') LIKE ? COLLATE NOCASE)`;
  const total = db.prepare(`SELECT COUNT(*) AS count FROM medicines WHERE ${where}`).get(tenantId, q, like, like).count;
  const medicines = db
    .prepare(`SELECT * FROM medicines WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`)
    .all(tenantId, q, like, like, limit, offset)
    .map((m) => decorateMedicine(m, user));
  res.json(pagePayload(medicines, total, page, limit));
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
  const { name, description, price, wholesale_price, stock } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ message: 'Name and price are required' });
  }
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const wholesale =
    wholesale_price === undefined || wholesale_price === '' ? null : Number(wholesale_price);
  const result = db
    .prepare(
      `INSERT INTO medicines (name, description, price, wholesale_price, image, stock, created_by, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      description || '',
      Number(price),
      wholesale,
      image,
      Number(stock || 0),
      req.user.id,
      req.user.tenant_id
    );
  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(medicine);
});

router.put('/:id', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });

  const { name, description, price, wholesale_price, stock } = req.body;
  let image = existing.image;
  if (req.file) {
    if (existing.image) {
      const oldPath = path.join(__dirname, '..', existing.image.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    image = `/uploads/${req.file.filename}`;
  }

  let wholesale = existing.wholesale_price;
  if (wholesale_price !== undefined) {
    wholesale = wholesale_price === '' ? null : Number(wholesale_price);
  }

  db.prepare(
    `UPDATE medicines SET name = ?, description = ?, price = ?, wholesale_price = ?, image = ?, stock = ?
     WHERE id = ? AND tenant_id = ?`
  ).run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    price !== undefined ? Number(price) : existing.price,
    wholesale,
    image,
    stock !== undefined ? Number(stock) : existing.stock,
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

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });
  if (existing.image) {
    const imgPath = path.join(__dirname, '..', existing.image.replace(/^\//, ''));
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  db.prepare('DELETE FROM medicines WHERE id = ? AND tenant_id = ?').run(req.params.id, req.user.tenant_id);
  res.json({ message: 'Medicine deleted' });
});

module.exports = router;
