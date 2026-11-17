/**
 * services/auth.js — Auth hand-rolled tanpa dependensi baru: scrypt hash,
 * token sesi cookie, rate limit in-memory, dan aturan ownership kapal.
 * Password tidak pernah keluar dari modul ini dalam bentuk plain.
 */
const crypto = require('crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const COOKIE_NAME = 'ais_sid';

function hashPassword(password, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expect = Buffer.from(hashHex, 'hex');
    const got = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expect.length, { N: +N, r: +r, p: +p });
    return got.length === expect.length && crypto.timingSafeEqual(got, expect);
  } catch {
    return false;
  }
}

const newToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
const sessionExpiry = (nowMs = Date.now()) => new Date(nowMs + SESSION_TTL_MS);
const isExpired = (expiresAt, nowMs = Date.now()) => new Date(expiresAt).getTime() <= nowMs;

/** Rate limit sederhana per key (IP): max percobaan per jendela waktu. */
function createRateLimiter(max = 5, windowMs = 60000) {
  const hits = new Map();
  return {
    try(key, nowMs = Date.now()) {
      if (hits.size > 500) {
        for (const [k, r] of hits) if (nowMs - r.start >= windowMs) hits.delete(k);
      }
      const rec = hits.get(key);
      if (!rec || nowMs - rec.start >= windowMs) {
        hits.set(key, { start: nowMs, n: 1 });
        return true;
      }
      rec.n += 1;
      return rec.n <= max;
    },
    reset() { hits.clear(); },
  };
}

/** admin: semua kapal; operator: hanya miliknya; kapal seed (owner null): admin. */
function canEditShip(user, ship) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return ship.owner_id != null && ship.owner_id === user.id;
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_MS,
  hashPassword,
  verifyPassword,
  newToken,
  hashToken,
  sessionExpiry,
  isExpired,
  createRateLimiter,
  canEditShip,
};