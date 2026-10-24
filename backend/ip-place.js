const dns = require('dns').promises;

const cache = new Map();

function isLocal(ip) {
  return (
    !ip
    || ip === '127.0.0.1'
    || ip === '::1'
    || ip === '0.0.0.0'
    || ip.startsWith('10.')
    || ip.startsWith('192.168.')
    || ip.startsWith('169.254.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    || ip.startsWith('fc')
    || ip.startsWith('fd')
    || ip.startsWith('fe80:')
  );
}

function blank() {
  return {
    hostname: '',
    asn: '',
    isp: '',
    services: '',
    country: '',
    region: '',
    city: '',
    latitude: '',
    longitude: '',
  };
}

function localPlace() {
  return {
    ...blank(),
    hostname: 'localhost',
    services: 'Local network',
  };
}

async function hostnameFor(ip, fallback) {
  try {
    const names = await Promise.race([
      dns.reverse(ip),
      new Promise((resolve) => setTimeout(() => resolve([]), 1200)),
    ]);
    if (Array.isArray(names) && names[0]) return String(names[0]).slice(0, 180);
  } catch {
    /* A missing reverse name still leaves the network lookup. */
  }
  return String(fallback || '').slice(0, 180);
}

async function lookupIp(ip) {
  const key = String(ip || '');
  if (cache.has(key)) return cache.get(key);
  if (isLocal(key)) {
    const place = localPlace();
    cache.set(key, place);
    return place;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(key)}`, { signal: controller.signal });
    const data = await response.json();
    if (!data?.success) throw new Error('lookup failed');
    const place = {
      hostname: await hostnameFor(key, data.connection?.domain),
      asn: data.connection?.asn ? `AS${data.connection.asn}` : '',
      isp: String(data.connection?.isp || '').slice(0, 180),
      services: String(data.connection?.org || '').slice(0, 180),
      country: String(data.country || '').slice(0, 80),
      region: String(data.region || '').slice(0, 80),
      city: String(data.city || '').slice(0, 80),
      latitude: data.latitude == null ? '' : String(data.latitude),
      longitude: data.longitude == null ? '' : String(data.longitude),
    };
    cache.set(key, place);
    return place;
  } catch {
    return blank();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { lookupIp, isLocal, localPlace, blank };
