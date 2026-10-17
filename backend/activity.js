const db = require('./db');

const insertActivity = db.prepare(
  `INSERT INTO site_activity (kind, name, email, role, ip, user_agent, path)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const recentActivity = db.prepare(
  `SELECT id, kind, name, email, role, ip, user_agent, path, created_at
   FROM site_activity
   ORDER BY created_at DESC, id DESC
   LIMIT 300`
);

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '');
  const first = raw.split(',')[0].trim();
  const ip = first || req.socket?.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');
}

const recentPages = new Map();

function recordActivity(req, details) {
  const path = String(details.path || '').slice(0, 180);
  const ip = clientIp(req).slice(0, 80);
  if (details.kind === 'page') {
    const key = `${ip}|${path}`;
    const now = Date.now();
    if (now - (recentPages.get(key) || 0) < 2000) return;
    recentPages.set(key, now);
    if (recentPages.size > 400) recentPages.clear();
  }
  insertActivity.run(
    details.kind,
    String(details.name || '').slice(0, 120),
    String(details.email || '').slice(0, 180),
    String(details.role || '').slice(0, 40),
    ip,
    String(req.headers['user-agent'] || '').slice(0, 240),
    path
  );
}

function listActivity() {
  return recentActivity.all();
}

module.exports = { recordActivity, listActivity };
