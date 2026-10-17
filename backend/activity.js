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

function recordActivity(req, details) {
  insertActivity.run(
    details.kind,
    String(details.name || '').slice(0, 120),
    String(details.email || '').slice(0, 180),
    String(details.role || '').slice(0, 40),
    clientIp(req).slice(0, 80),
    String(req.headers['user-agent'] || '').slice(0, 240),
    String(details.path || '').slice(0, 180)
  );
}

function listActivity() {
  return recentActivity.all();
}

module.exports = { recordActivity, listActivity };
