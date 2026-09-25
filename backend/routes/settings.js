const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT title, slogan, logo, qr_code FROM site_settings WHERE id = 1').get());
});

router.put(
  '/',
  authenticate,
  requireSuperAdmin,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'qrCode', maxCount: 1 },
  ]),
  (req, res) => {
    const current = db.prepare('SELECT * FROM site_settings WHERE id = 1').get();
    const logo = req.files?.logo?.[0]
      ? `/uploads/${req.files.logo[0].filename}`
      : current.logo;
    const qrCode = req.files?.qrCode?.[0]
      ? `/uploads/${req.files.qrCode[0].filename}`
      : current.qr_code;
    const title = String(req.body.title || current.title).trim();
    const slogan = String(req.body.slogan || current.slogan).trim();

    if (!title || !slogan) {
      return res.status(400).json({ message: 'Website title and slogan are required' });
    }

    db.prepare(
      `UPDATE site_settings
       SET title = ?, slogan = ?, logo = ?, qr_code = ?, updated_at = datetime('now')
       WHERE id = 1`
    ).run(title, slogan, logo, qrCode);

    res.json(db.prepare('SELECT title, slogan, logo, qr_code FROM site_settings WHERE id = 1').get());
  }
);

module.exports = router;
