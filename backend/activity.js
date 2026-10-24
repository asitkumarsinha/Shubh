const db = require('./db');
const { lookupIp, isLocal, localPlace, blank } = require('./ip-place');

const insertActivity = db.prepare(
  `INSERT INTO site_activity (
     kind, name, email, role, ip, user_agent, path,
     hostname, asn, isp, services, country, region, city, latitude, longitude
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const updatePlace = db.prepare(
  `UPDATE site_activity
   SET hostname = ?, asn = ?, isp = ?, services = ?, country = ?, region = ?, city = ?, latitude = ?, longitude = ?
   WHERE id = ?`
);
const missingPlaces = db.prepare(
  `SELECT id, ip FROM site_activity
   WHERE ip != '' AND hostname = '' AND country = ''
   ORDER BY id DESC
   LIMIT 12`
);
const recentActivity = db.prepare(
  `SELECT id, kind, name, email, role, ip, user_agent, path, created_at,
          hostname, asn, isp, services, country, region, city, latitude, longitude
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

function writePlace(id, place) {
  updatePlace.run(
    place.hostname,
    place.asn,
    place.isp,
    place.services,
    place.country,
    place.region,
    place.city,
    place.latitude,
    place.longitude,
    id
  );
}

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
  const known = isLocal(ip) ? localPlace() : blank();
  const result = insertActivity.run(
    details.kind,
    String(details.name || '').slice(0, 120),
    String(details.email || '').slice(0, 180),
    String(details.role || '').slice(0, 40),
    ip,
    String(req.headers['user-agent'] || '').slice(0, 240),
    path,
    known.hostname,
    known.asn,
    known.isp,
    known.services,
    known.country,
    known.region,
    known.city,
    known.latitude,
    known.longitude
  );
  if (!isLocal(ip)) {
    const id = Number(result.lastInsertRowid);
    lookupIp(ip).then((place) => {
      if (place.hostname || place.country || place.isp) writePlace(id, place);
    }).catch(() => {});
  }
}

async function listActivity() {
  const pending = missingPlaces.all();
  await Promise.all(pending.map(async (row) => {
    const place = await lookupIp(row.ip);
    if (place.hostname || place.country || place.isp || place.services) writePlace(row.id, place);
  }));
  return recentActivity.all();
}

module.exports = { recordActivity, listActivity };
