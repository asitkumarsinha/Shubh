const path = require('path');

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.jfif', '.webp', '.gif', '.svg']);

function imageFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const type = String(file.mimetype || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext) || !type.startsWith('image/')) {
    const err = new Error('Upload a PNG, JPG, WEBP, GIF, or SVG image');
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
}

function safeImageExt(originalname) {
  const ext = path.extname(originalname || '').toLowerCase();
  return ALLOWED_EXT.has(ext) ? ext : '.jpg';
}

module.exports = { imageFileFilter, safeImageExt };
