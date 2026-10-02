const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireAdmin, requireModule, requireTenantLimit } = require('../middleware/auth');
const { imageFileFilter, safeImageExt } = require('../uploads');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    cb(null, `emp-${uuidv4()}${safeImageExt(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

function unlinkImage(image) {
  if (!image || !image.startsWith('/uploads/')) return;
  const imgPath = path.join(__dirname, '..', image.replace(/^\//, ''));
  if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
}

router.get('/', authenticate, requireAdmin, requireModule('employees'), (req, res) => {
  const employees = db.prepare('SELECT * FROM employees WHERE tenant_id = ? ORDER BY datetime(created_at) DESC').all(req.user.tenant_id);
  res.json(employees);
});

router.get('/:id', authenticate, requireAdmin, requireModule('employees'), (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  res.json(employee);
});

router.post('/', authenticate, requireAdmin, requireModule('employees'), requireTenantLimit('employees', 'employees'), upload.single('image'), (req, res) => {
  const { name, email, phone, designation, department, address, joining_date } = req.body;
  if (!name || !email || !phone || !designation) {
    return res.status(400).json({ message: 'Name, email, phone and designation are required' });
  }
  const existing = db.prepare('SELECT id FROM employees WHERE email = ? AND tenant_id = ?').get(String(email).toLowerCase(), req.user.tenant_id);
  if (existing) return res.status(409).json({ message: 'An employee with this email already exists' });

  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const result = db
    .prepare(
      `INSERT INTO employees (name, email, phone, designation, department, address, joining_date, image, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name.trim(),
      String(email).toLowerCase().trim(),
      String(phone).trim(),
      designation.trim(),
      department || '',
      address || '',
      joining_date || '',
      image,
      req.user.tenant_id
    );
  res.status(201).json(db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', authenticate, requireAdmin, requireModule('employees'), upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM employees WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!existing) return res.status(404).json({ message: 'Employee not found' });

  const { name, email, phone, designation, department, address, joining_date } = req.body;
  if (!name || !email || !phone || !designation) {
    return res.status(400).json({ message: 'Name, email, phone and designation are required' });
  }

  const emailNorm = String(email).toLowerCase().trim();
  const clash = db
    .prepare('SELECT id FROM employees WHERE email = ? AND id != ? AND tenant_id = ?')
    .get(emailNorm, req.params.id, req.user.tenant_id);
  if (clash) return res.status(409).json({ message: 'An employee with this email already exists' });

  let image = existing.image;
  if (req.file) {
    unlinkImage(existing.image);
    image = `/uploads/${req.file.filename}`;
  }

  db.prepare(
    `UPDATE employees
     SET name = ?, email = ?, phone = ?, designation = ?, department = ?, address = ?, joining_date = ?, image = ?
     WHERE id = ? AND tenant_id = ?`
  ).run(
    name.trim(),
    emailNorm,
    String(phone).trim(),
    designation.trim(),
    department !== undefined ? department : existing.department,
    address !== undefined ? address : existing.address,
    joining_date !== undefined ? joining_date : existing.joining_date,
    image,
    req.params.id,
    req.user.tenant_id
  );

  res.json(db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authenticate, requireAdmin, requireModule('employees'), (req, res) => {
  const existing = db.prepare('SELECT * FROM employees WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!existing) return res.status(404).json({ message: 'Employee not found' });
  unlinkImage(existing.image);
  db.prepare('DELETE FROM employees WHERE id = ? AND tenant_id = ?').run(req.params.id, req.user.tenant_id);
  res.json({ message: 'Employee removed' });
});

module.exports = router;
