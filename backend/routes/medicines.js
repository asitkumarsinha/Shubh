const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

router.get('/', (_req, res) => {
  const medicines = db
    .prepare('SELECT * FROM medicines ORDER BY created_at DESC')
    .all();
  res.json(medicines);
});

router.get('/:id', (req, res) => {
  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id);
  if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
  res.json(medicine);
});

router.post('/', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const { name, description, price, stock } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ message: 'Name and price are required' });
  }
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const result = db
    .prepare(
      `INSERT INTO medicines (name, description, price, image, stock, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      description || '',
      Number(price),
      image,
      Number(stock || 0),
      req.user.id
    );
  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(medicine);
});

router.put('/:id', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });

  const { name, description, price, stock } = req.body;
  let image = existing.image;
  if (req.file) {
    if (existing.image) {
      const oldPath = path.join(__dirname, '..', existing.image.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    image = `/uploads/${req.file.filename}`;
  }

  db.prepare(
    `UPDATE medicines SET name = ?, description = ?, price = ?, image = ?, stock = ?
     WHERE id = ?`
  ).run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    price !== undefined ? Number(price) : existing.price,
    image,
    stock !== undefined ? Number(stock) : existing.stock,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });
  if (existing.image) {
    const imgPath = path.join(__dirname, '..', existing.image.replace(/^\//, ''));
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  db.prepare('DELETE FROM medicines WHERE id = ?').run(req.params.id);
  res.json({ message: 'Medicine deleted' });
});

module.exports = router;
