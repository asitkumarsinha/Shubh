const WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS = 20;
const REGISTER_ATTEMPTS = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const FAILURES = 8;

const attempts = new Map();
const failures = new Map();

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function hit(map, key, windowMs, max) {
  const now = Date.now();
  const recent = (map.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= max) {
    map.set(key, recent);
    return false;
  }
  recent.push(now);
  map.set(key, recent);
  return true;
}

function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

function limitLogin(req, res, next) {
  if (!hit(attempts, `login:${clientKey(req)}`, WINDOW_MS, LOGIN_ATTEMPTS)) {
    return res.status(429).json({ message: 'Too many sign-in attempts. Try again later.' });
  }
  next();
}

function limitRegister(req, res, next) {
  if (!hit(attempts, `register:${clientKey(req)}`, REGISTER_WINDOW_MS, REGISTER_ATTEMPTS)) {
    return res.status(429).json({ message: 'Too many accounts created from this network. Try again later.' });
  }
  next();
}

function loginLocked(email) {
  const key = String(email || '').toLowerCase();
  const row = failures.get(key);
  if (!row) return false;
  if (Date.now() - row.start > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return row.count >= FAILURES;
}

function noteLoginFailure(email) {
  const key = String(email || '').toLowerCase();
  const row = failures.get(key);
  if (!row || Date.now() - row.start > WINDOW_MS) {
    failures.set(key, { count: 1, start: Date.now() });
    return;
  }
  row.count += 1;
}

function clearLoginFailures(email) {
  failures.delete(String(email || '').toLowerCase());
}

module.exports = {
  securityHeaders,
  limitLogin,
  limitRegister,
  loginLocked,
  noteLoginFailure,
  clearLoginFailures,
};
