const fs = require('fs');
const path = require('path');

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.jfif', '.webp', '.gif', '.svg']);

function uploadDir() {
  if (process.env.UPLOAD_DIR) return path.resolve(process.env.UPLOAD_DIR);
  if (process.env.SQLITE_PATH) {
    return path.join(path.dirname(process.env.SQLITE_PATH), 'uploads');
  }
  return path.join(__dirname, 'uploads');
}

function ensureUploadDir() {
  const dir = uploadDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function storedFilePath(publicPath) {
  const name = path.basename(String(publicPath || ''));
  if (!name || name === '.' || name === '..') return '';
  return path.join(uploadDir(), name);
}

function unlinkStored(publicPath) {
  if (!publicPath || !String(publicPath).startsWith('/uploads/')) return;
  const filePath = storedFilePath(publicPath);
  if (filePath && fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
}

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

module.exports = {
  imageFileFilter,
  safeImageExt,
  uploadDir,
  ensureUploadDir,
  storedFilePath,
  unlinkStored,
};
