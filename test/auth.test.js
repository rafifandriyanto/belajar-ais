const test = require('node:test');
const assert = require('node:assert');
const A = require('../services/auth');

test('hash/verify roundtrip dan password salah ditolak', () => {
  const h = A.hashPassword('rahasia123');
  assert.ok(A.verifyPassword('rahasia123', h));
  assert.ok(!A.verifyPassword('salah1234', h));
});

test('verify menolak format rusak tanpa throw', () => {
  assert.ok(!A.verifyPassword('x', 'md5$abc'));
  assert.ok(!A.verifyPassword('x', ''));
  assert.ok(!A.verifyPassword('x', null));
});

test('salt membuat hash unik', () => {
  assert.notStrictEqual(A.hashPassword('rahasia123'), A.hashPassword('rahasia123'));
});

test('sesi kedaluwarsa tepat setelah TTL', () => {
  const exp = A.sessionExpiry(1000);
  assert.ok(!A.isExpired(exp, 1000 + A.SESSION_TTL_MS - 1));
  assert.ok(A.isExpired(exp, 1000 + A.SESSION_TTL_MS));
});

test('rate limiter 5 percobaan per jendela per key', () => {
  const rl = A.createRateLimiter(5, 60000);
  for (let i = 0; i < 5; i++) assert.ok(rl.try('ip', 1000));
  assert.ok(!rl.try('ip', 1000));
  assert.ok(rl.try('ip', 61000));
  assert.ok(rl.try('other', 1000));
});