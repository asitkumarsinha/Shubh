const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireSuperAdmin, optionalUser } = require('../middleware/auth');

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

function platformSettings() {
  const row = db.prepare('SELECT title, slogan, logo, qr_code FROM site_settings WHERE id = 1').get();
  return {
    title: row?.title || 'Surgical Solution',
    slogan: row?.slogan || 'Your Trusted Partner in Health and Wellness.',
    logo: row?.logo || '/assets/shubh-surgical-logo.svg',
    qr_code: row?.qr_code || '/assets/QR.jpeg',
    theme_color: '#1f242c',
    font_family: 'Syne',
    login_initial: '',
  };
}

function settingsForTenant(tenantId) {
  return db.prepare(
    `SELECT s.title, s.slogan, s.logo, s.qr_code, t.theme_color, t.font_family, t.login_initial
     FROM tenant_settings s JOIN tenants t ON t.id = s.tenant_id
     WHERE s.tenant_id = ?`
  ).get(tenantId);
}

function requestedTenantId(req, fallback = 1) {
  const value = Number(req.query.tenantId || req.body?.tenantId);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function sendTenantSettings(res, tenantId) {
  const settings = settingsForTenant(tenantId);
  if (!settings) return res.status(404).json({ message: 'Customer settings not found' });
  return res.json(settings);
}

router.get('/', (req, res) => {
  const user = optionalUser(req);
  const email = String(req.query.email || '').trim().toLowerCase();
  const explicitTenant = Number(req.query.tenantId || 0);

  if (user?.role === 'super_admin' && explicitTenant > 0) {
    return sendTenantSettings(res, explicitTenant);
  }
  if (user && user.role !== 'super_admin' && user.tenant_id) {
    return sendTenantSettings(res, user.tenant_id);
  }
  if (!user && email.includes('@')) {
    const tenant = db.prepare(
      `SELECT id FROM tenants
       WHERE status = 'active' AND login_initial <> '' AND ? LIKE '%' || lower(login_initial) || '%'
       ORDER BY length(login_initial) DESC LIMIT 1`
    ).get(email);
    if (tenant) return sendTenantSettings(res, tenant.id);
  }
  res.json(platformSettings());
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
    const tenantId = requestedTenantId(req);
    const current = settingsForTenant(tenantId);
    if (!current) return res.status(404).json({ message: 'Customer settings not found' });
    const logo = req.files?.logo?.[0]
      ? `/uploads/${req.files.logo[0].filename}`
      : current.logo;
    const qrCode = req.files?.qrCode?.[0]
      ? `/uploads/${req.files.qrCode[0].filename}`
      : current.qr_code;
    const title = String(req.body.title || current.title).trim();
    const slogan = String(req.body.slogan || current.slogan).trim();
    const themeColor = /^#[0-9a-f]{6}$/i.test(req.body.themeColor || '')
      ? req.body.themeColor
      : current.theme_color;
    const fontFamily = ['Syne', 'IBM Plex Sans', 'System UI'].includes(req.body.fontFamily)
      ? req.body.fontFamily
      : current.font_family;
    const loginInitial = String(req.body.loginInitial || '').trim().toLowerCase();
    if (loginInitial && !/^@[a-z0-9.-]+$/i.test(loginInitial)) {
      return res.status(400).json({ message: 'Login Initial must begin with @ (for example @shubhsurgical)' });
    }

    if (!title || !slogan) {
      return res.status(400).json({ message: 'Website title and slogan are required' });
    }

    db.prepare(
      `UPDATE tenant_settings SET title = ?, slogan = ?, logo = ?, qr_code = ? WHERE tenant_id = ?`
    ).run(title, slogan, logo, qrCode, tenantId);
    db.prepare(
      `UPDATE tenants SET theme_color = ?, font_family = ?, login_initial = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(themeColor, fontFamily, loginInitial, tenantId);

    res.json(settingsForTenant(tenantId));
  }
);

module.exports = router;
