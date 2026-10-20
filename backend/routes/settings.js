const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireSuperAdmin, optionalUser } = require('../middleware/auth');
const { imageFileFilter, safeImageExt, ensureUploadDir, unlinkStored } = require('../uploads');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureUploadDir()),
    filename: (_req, file, cb) => {
      cb(null, `${uuidv4()}${safeImageExt(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const platformSettingsRow = db.prepare('SELECT title, slogan, logo, qr_code FROM site_settings WHERE id = 1');
const tenantSettingsRow = db.prepare(
  `SELECT s.title, s.slogan, s.logo, s.qr_code, t.theme_color, t.font_family, t.login_initial
   FROM tenant_settings s JOIN tenants t ON t.id = s.tenant_id
   WHERE s.tenant_id = ?`
);
const tenantByLoginInitial = db.prepare(
  `SELECT id FROM tenants
   WHERE status = 'active' AND login_initial <> '' AND ? LIKE '%' || lower(login_initial) || '%'
   ORDER BY length(login_initial) DESC LIMIT 1`
);

function platformSettings() {
  const row = platformSettingsRow.get();
  return {
    title: row?.title || 'My Store Hub',
    slogan: row?.slogan || 'Your name, your products, your customers.',
    logo: row?.logo || '/assets/MyStoreHub.jfif',
    qr_code: row?.qr_code || '/assets/QR.jpeg',
    theme_color: '#07131c',
    font_family: 'Syne',
    login_initial: '',
  };
}

function settingsForTenant(tenantId) {
  return tenantSettingsRow.get(tenantId);
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
    const tenant = tenantByLoginInitial.get(email);
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

const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.aac', '.webm', '.flac']);
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureUploadDir()),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `demo-music-${Date.now()}${AUDIO_EXT.has(ext) ? ext : '.mp3'}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const type = String(file.mimetype || '').toLowerCase();
    if (AUDIO_EXT.has(ext) || type.startsWith('audio/')) return cb(null, true);
    const err = new Error('Upload an mp3, wav, or m4a music file');
    err.status = 400;
    cb(err);
  },
});

const demoMusicRow = db.prepare('SELECT demo_music FROM site_settings WHERE id = 1');
const saveDemoMusic = db.prepare(
  `UPDATE site_settings SET demo_music = ?, updated_at = datetime('now') WHERE id = 1`
);

router.get('/demo-music', (_req, res) => {
  const row = demoMusicRow.get();
  res.json({ music: row?.demo_music || '' });
});

router.post('/demo-music', authenticate, requireSuperAdmin, audioUpload.single('music'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a music file' });
  const previous = demoMusicRow.get();
  const music = `/uploads/${req.file.filename}`;
  if (previous?.demo_music && previous.demo_music !== music) {
    unlinkStored(previous.demo_music);
  }
  saveDemoMusic.run(music);
  res.json({ music });
});

module.exports = router;
