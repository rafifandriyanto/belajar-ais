# AIS v2.1 Feature Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan search, detail+voyage, favorites+follow, auth+CRUD kapal, dan palette system 4 palet ke konsol VTS AIS remake.

**Architecture:** Backend Express modular (services pure + routes tipis), sesi cookie hand-rolled di PG, simulator menerima upsert/remove sehingga CRUD live tanpa restart; frontend ES modules keyed-update mengikuti pola fleet.js existing; palet = CSS custom properties per `html[data-palette]`.

**Tech Stack:** Node 24 (node:crypto, node:test), Express 4, pg, Mongoose, Socket.io 4, Leaflet 1.9.4 CDN, vanilla ES modules, CSS tokens.

**Spec:** `docs/superpowers/specs/2026-11-17-ais-fleet-auth-design.md`

## Global Constraints

- Tidak ada dependensi npm baru; tidak ada build step.
- Branch `feat/fleet-auth-ui`; agent commit per fase; push & merge ke main = user.
- Nilai `.env` / `atlas-credentials.env` tidak pernah dicetak.
- Penghapusan data Mongo lama / purge = perintah untuk user, bukan agent.
- Teks fungsional ≥ 11px; kontras ≥ 4.5:1; reduced-motion dihormati.
- Palet: sonar (default) / phosphor / amber / chart; token persis tabel spec §2; warna tipe konstan ferry `#6fb7e8`, cargo `#e8b04b`, tanker `#e0655d`, tug `#7fd08a`.
- Audit 20 larangan slop spec §3 adalah syarat penerimaan; hover = perubahan warna/border instan (bukan opacity fade); spacing skala 4px; em-dash prose/readout diganti `--`.
- `escapeHtml` untuk semua data user yang dirender; password tidak pernah masuk log/respons.

---

### Task 1: Particulars fleet + schema PG + seed routes/admin

**Files:**
- Modify: `data/fleet.js` (tambah particulars per kapal)
- Modify: `db/postgres.js:25-46` (initTables menambah users/sessions/kolom ships/routes)
- Modify: `db/seed.js` (insert routes + particulars + admin env)
- Test: `test/fleet-particulars.test.js` (baru)

**Interfaces:**
- Consumes: `FLEET`, `PORTS`, `isValidMmsi` dari `data/fleet.js`
- Produces: kapal FLEET ber-field `imo, callSign, flag, lengthM, beamM, destination`; tabel PG `users`, `sessions`, `routes`, kolom ships tambahan; `npm run seed` idempotent.

- [ ] **Step 1: Write the failing test**

```js
// test/fleet-particulars.test.js
const test = require('node:test');
const assert = require('node:assert');
const { FLEET } = require('../data/fleet');
const BBOX = { latMin: -7.35, latMax: -7.05, lonMin: 112.55, lonMax: 112.85 };

test('semua kapal punya particulars dan destination', () => {
  for (const s of FLEET) {
    assert.ok(/^\d{7}$/.test(s.imo), `${s.mmsi} imo`);
    assert.ok(s.callSign && s.flag, `${s.mmsi} callSign/flag`);
    assert.ok(s.lengthM > 0 && s.beamM > 0, `${s.mmsi} dimensi`);
    assert.ok(s.destination, `${s.mmsi} destination`);
  }
});

test('route minimal 2 titik dan dalam bbox area operasi', () => {
  for (const s of FLEET) {
    assert.ok(s.route.length >= 2, s.mmsi);
    for (const [lat, lon] of s.route) {
      assert.ok(lat >= BBOX.latMin && lat <= BBOX.latMax, `${s.mmsi} lat`);
      assert.ok(lon >= BBOX.lonMin && lon <= BBOX.lonMax, `${s.mmsi} lon`);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL pada `test/fleet-particulars.test.js` (imo undefined).

- [ ] **Step 3: Tambah particulars ke FLEET**

Tambahkan field berikut per kapal (sisipkan setelah `type`):

```js
// 525001001
imo: '9187654', callSign: 'YBHA1', flag: 'Indonesia', lengthM: 62.0, beamM: 14.0, destination: 'Terminal Gapura Surya',
// 525001002
imo: '9203411', callSign: 'YBHA2', flag: 'Indonesia', lengthM: 58.5, beamM: 13.2, destination: 'Pelabuhan Tanjung Perak',
// 525001003
imo: '9251188', callSign: 'YBHA3', flag: 'Indonesia', lengthM: 60.0, beamM: 13.8, destination: 'Terminal Gapura Surya',
// 525002001
imo: '9312045', callSign: 'YBCA1', flag: 'Indonesia', lengthM: 118.0, beamM: 20.5, destination: 'Terminal Nilam',
// 525002002
imo: '9345672', callSign: 'YBCA2', flag: 'Indonesia', lengthM: 105.0, beamM: 18.8, destination: 'Pelabuhan Tanjung Perak',
// 525002003
imo: '9368811', callSign: 'YBCA3', flag: 'Indonesia', lengthM: 112.5, beamM: 19.6, destination: 'Terminal Nilam',
// 525003001
imo: '9287733', callSign: 'YBTA1', flag: 'Indonesia', lengthM: 145.0, beamM: 23.0, destination: 'Terminal Nilam',
// 525003002
imo: '9301199', callSign: 'YBTA2', flag: 'Indonesia', lengthM: 132.0, beamM: 21.4, destination: 'Pelabuhan Tanjung Perak',
// 525004001
imo: '9412266', callSign: 'YBTU1', flag: 'Indonesia', lengthM: 32.0, beamM: 10.2, destination: 'Pelabuhan Tanjung Perak',
// 525004002
imo: '9433811', callSign: 'YBTU2', flag: 'Indonesia', lengthM: 30.5, beamM: 9.8, destination: 'Terminal Gapura Surya',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS semua (10 existing + 2 baru).

- [ ] **Step 5: Schema PG idempotent**

Di `db/postgres.js initTables()`, setelah tabel ports, tambahkan:

```js
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(24) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          VARCHAR(10) NOT NULL DEFAULT 'operator'
                    CHECK (role IN ('admin','operator')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS imo VARCHAR(12)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS call_sign VARCHAR(12)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS flag VARCHAR(40)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS length_m NUMERIC(6,1)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS beam_m NUMERIC(5,1)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS destination VARCHAR(60)`);
  await pool.query(`ALTER TABLE ships ADD COLUMN IF NOT EXISTS owner_id INT REFERENCES users(id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS routes (
      mmsi      VARCHAR(20) PRIMARY KEY REFERENCES ships(mmsi) ON DELETE CASCADE,
      waypoints JSONB NOT NULL,
      speed_kn  NUMERIC(4,1) NOT NULL DEFAULT 12,
      dwell_s   INT NOT NULL DEFAULT 60
    )
  `);
  console.log('Tabel PostgreSQL (ships, ports, users, sessions, routes) siap digunakan');
```

- [ ] **Step 6: Seed routes + particulars + admin**

Di `db/seed.js`, ganti loop ships dengan:

```js
    for (const ship of FLEET) {
      await pool.query(
        `INSERT INTO ships (mmsi, name, type, imo, call_sign, flag, length_m, beam_m, destination)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (mmsi) DO UPDATE SET
           imo = COALESCE(ships.imo, EXCLUDED.imo),
           call_sign = COALESCE(ships.call_sign, EXCLUDED.call_sign),
           flag = COALESCE(ships.flag, EXCLUDED.flag),
           length_m = COALESCE(ships.length_m, EXCLUDED.length_m),
           beam_m = COALESCE(ships.beam_m, EXCLUDED.beam_m),
           destination = COALESCE(ships.destination, EXCLUDED.destination)`,
        [ship.mmsi, ship.name, ship.type, ship.imo, ship.callSign, ship.flag, ship.lengthM, ship.beamM, ship.destination],
      );
      await pool.query(
        `INSERT INTO routes (mmsi, waypoints, speed_kn, dwell_s)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (mmsi) DO NOTHING`,
        [ship.mmsi, JSON.stringify(ship.route), ship.speedKn, ship.dwellSeconds || 0],
      );
    }
```

Setelah loop ports, tambahkan (nilai env tidak pernah dicetak):

```js
    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
      const { hashPassword } = require('../services/auth');
      await pool.query(
        `INSERT INTO users (username, password_hash, role)
         VALUES ($1,$2,'admin') ON CONFLICT (username) DO NOTHING`,
        [process.env.ADMIN_USERNAME, hashPassword(process.env.ADMIN_PASSWORD)],
      );
      console.log('Admin seed siap (kredensial dari .env)');
    } else {
      console.log('ADMIN_USERNAME/PASSWORD tidak disetel — pendaftar pertama akan menjadi admin');
    }
```

- [ ] **Step 7: Verifikasi seed idempotent**

Run: `npm run seed && npm run seed`
Expected: dua kali sukses, log jumlah kapal/pelabuhan sama, tidak ada error duplikat.

- [ ] **Step 8: Commit**

```bash
git add data/fleet.js db/postgres.js db/seed.js test/fleet-particulars.test.js
git commit -m "feat(db): particulars fleet, schema users/sessions/routes, seed idempotent"
```

---

### Task 2: services/auth.js (scrypt, sesi, rate limit, ownership)

**Files:**
- Create: `services/auth.js`
- Test: `test/auth.test.js`, `test/ownership.test.js`

**Interfaces:**
- Consumes: tidak ada (pure node:crypto)
- Produces: `COOKIE_NAME='ais_sid'`, `SESSION_TTL_MS`, `hashPassword(pw,salt?)→string`, `verifyPassword(pw,stored)→bool`, `newToken()→hex64`, `hashToken(t)→hex64`, `sessionExpiry(nowMs?)→Date`, `isExpired(expiresAt,nowMs?)→bool`, `createRateLimiter(max=5,windowMs=60000)→{try(key,nowMs?)→bool,reset()}`, `canEditShip(user,ship)→bool`.

- [ ] **Step 1: Write the failing tests**

```js
// test/auth.test.js
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
```

```js
// test/ownership.test.js
const test = require('node:test');
const assert = require('node:assert');
const { canEditShip } = require('../services/auth');

test('admin boleh edit semua kapal termasuk seed', () => {
  const admin = { id: 1, role: 'admin' };
  assert.ok(canEditShip(admin, { owner_id: null }));
  assert.ok(canEditShip(admin, { owner_id: 9 }));
});
test('operator hanya boleh edit kapal miliknya', () => {
  const op = { id: 2, role: 'operator' };
  assert.ok(canEditShip(op, { owner_id: 2 }));
  assert.ok(!canEditShip(op, { owner_id: 3 }));
  assert.ok(!canEditShip(op, { owner_id: null }));
});
test('tanpa login tidak boleh edit', () => {
  assert.ok(!canEditShip(null, { owner_id: 2 }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL "Cannot find module '../services/auth'".

- [ ] **Step 3: Implement services/auth.js**

```js
/**
 * services/auth.js — Auth hand-rolled tanpa dependensi baru: scrypt hash,
 * token sesi cookie, rate limit in-memory, dan aturan ownership kapal.
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

function createRateLimiter(max = 5, windowMs = 60000) {
  const hits = new Map();
  return {
    try(key, nowMs = Date.now()) {
      const rec = hits.get(key);
      if (!rec || nowMs - rec.start >= windowMs) { hits.set(key, { start: nowMs, n: 1 }); return true; }
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

module.exports = { COOKIE_NAME, SESSION_TTL_MS, hashPassword, verifyPassword, newToken, hashToken, sessionExpiry, isExpired, createRateLimiter, canEditShip };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add services/auth.js test/auth.test.js test/ownership.test.js
git commit -m "feat(auth): scrypt hash, sesi cookie, rate limit, aturan ownership"
```

---

### Task 3: services/voyage.js + services/ship-validate.js

**Files:**
- Create: `services/voyage.js`, `services/ship-validate.js`
- Test: `test/voyage.test.js`, `test/ship-validate.test.js`

**Interfaces:**
- Consumes: `distanceMeters` dari `simulator.js`; `isValidMmsi` dari `data/fleet.js`
- Produces: `computeVoyage(dyn,route,nowMs?)→{remainingM,etaIso,speedKn}` dengan dyn `{lat,lon,targetIndex,direction,speedKn,dwellUntil}`; `validateShipPayload(body,{partial?})→string[]` (kosong = valid); `TYPES`, `BBOX`.

- [ ] **Step 1: Write the failing tests**

```js
// test/voyage.test.js
const test = require('node:test');
const assert = require('node:assert');
const { computeVoyage } = require('../services/voyage');
const route = [[-7.20, 112.70], [-7.19, 112.71], [-7.18, 112.72]];

test('sisa jarak menurun sepanjang rute', () => {
  const a = computeVoyage({ lat: -7.20, lon: 112.70, targetIndex: 1, direction: 1, speedKn: 10, dwellUntil: 0 }, route, 0);
  const b = computeVoyage({ lat: -7.19, lon: 112.71, targetIndex: 2, direction: 1, speedKn: 10, dwellUntil: 0 }, route, 0);
  assert.ok(a.remainingM > b.remainingM && b.remainingM > 0);
});
test('ETA konsisten dengan kecepatan knot', () => {
  const v = computeVoyage({ lat: -7.20, lon: 112.70, targetIndex: 1, direction: 1, speedKn: 10, dwellUntil: 0 }, route, 0);
  const expectMs = (v.remainingM / (10 * 0.514444)) * 1000;
  assert.ok(Math.abs(Date.parse(v.etaIso) - expectMs) < 1500);
});
test('moored menambah sisa waktu sandar ke ETA', () => {
  const base = computeVoyage({ lat: -7.20, lon: 112.70, targetIndex: 1, direction: 1, speedKn: 10, dwellUntil: 0 }, route, 0);
  const moored = computeVoyage({ lat: -7.20, lon: 112.70, targetIndex: 1, direction: 1, speedKn: 10, dwellUntil: 60000 }, route, 0);
  assert.ok(Date.parse(moored.etaIso) - Date.parse(base.etaIso) >= 59000);
});
test('arah balik menghitung ke ujung awal rute', () => {
  const v = computeVoyage({ lat: -7.18, lon: 112.72, targetIndex: 1, direction: -1, speedKn: 10, dwellUntil: 0 }, route, 0);
  assert.ok(v.remainingM > 0);
});
```

```js
// test/ship-validate.test.js
const test = require('node:test');
const assert = require('node:assert');
const { validateShipPayload } = require('../services/ship-validate');
const good = { mmsi: '525009001', name: 'Test Ship', type: 'cargo', speedKn: 12, route: [[-7.2, 112.7], [-7.19, 112.71]] };

test('payload valid lolos', () => assert.deepStrictEqual(validateShipPayload(good), []));
test('mmsi bukan 9 digit ditolak', () => assert.ok(validateShipPayload({ ...good, mmsi: '123' }).length));
test('route satu titik ditolak', () => assert.ok(validateShipPayload({ ...good, route: [[-7.2, 112.7]] }).length));
test('titik di luar bbox ditolak', () => assert.ok(validateShipPayload({ ...good, route: [[-8.0, 112.7], [-7.19, 112.71]] }).length));
test('speed di luar 1-30 ditolak', () => assert.ok(validateShipPayload({ ...good, speedKn: 40 }).length));
test('partial update tanpa mmsi lolos', () => assert.deepStrictEqual(validateShipPayload({ name: 'Baru' }, { partial: true }), []));
test('tipe asing ditolak', () => assert.ok(validateShipPayload({ ...good, type: 'pesawat' }).length));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL module tidak ditemukan.

- [ ] **Step 3: Implement kedua service**

```js
// services/voyage.js
/**
 * services/voyage.js — Perhitungan voyage pure: sisa jarak ke ujung rute
 * searah arah kapal sekarang, dan ETA termasuk sisa waktu sandar.
 */
const { distanceMeters } = require('../simulator');
const KNOTS_TO_MS = 0.514444;

function computeVoyage(dyn, route, nowMs = Date.now()) {
  let remaining = distanceMeters(dyn.lat, dyn.lon, route[dyn.targetIndex][0], route[dyn.targetIndex][1]);
  for (let i = dyn.targetIndex + dyn.direction; i >= 0 && i < route.length; i += dyn.direction) {
    const a = route[i - dyn.direction];
    const b = route[i];
    remaining += distanceMeters(a[0], a[1], b[0], b[1]);
  }
  const speedMs = Math.max(dyn.speedKn, 0.1) * KNOTS_TO_MS;
  const dwellLeftMs = Math.max(0, (dyn.dwellUntil || 0) - nowMs);
  const etaMs = nowMs + dwellLeftMs + (remaining / speedMs) * 1000;
  return { remainingM: Math.round(remaining), etaIso: new Date(etaMs).toISOString(), speedKn: dyn.speedKn };
}

module.exports = { computeVoyage };
```

```js
// services/ship-validate.js
/**
 * services/ship-validate.js — Validasi payload kapal untuk POST/PUT.
 * Mengembalikan array pesan error per field; kosong berarti valid.
 */
const { isValidMmsi } = require('../data/fleet');
const TYPES = ['ferry', 'cargo', 'tanker', 'tug'];
const BBOX = { latMin: -7.35, latMax: -7.05, lonMin: 112.55, lonMax: 112.85 };

function validateShipPayload(b, { partial = false } = {}) {
  const errs = [];
  const has = (k) => b[k] !== undefined;
  if (!partial || has('mmsi')) {
    if (!isValidMmsi(String(b.mmsi ?? ''))) errs.push('mmsi: harus 9 digit angka');
  }
  if (!partial || has('name')) {
    const n = String(b.name ?? '').trim();
    if (n.length < 1 || n.length > 100) errs.push('name: 1-100 karakter');
  }
  if (!partial || has('type')) {
    if (!TYPES.includes(b.type)) errs.push('type: ferry/cargo/tanker/tug');
  }
  if (!partial || has('speedKn')) {
    const s = Number(b.speedKn);
    if (!Number.isFinite(s) || s < 1 || s > 30) errs.push('speedKn: 1-30');
  }
  if (!partial || has('route')) {
    const r = b.route;
    if (!Array.isArray(r) || r.length < 2) errs.push('route: minimal 2 titik');
    else {
      for (const pt of r) {
        const [lat, lon] = Array.isArray(pt) ? pt : [];
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < BBOX.latMin || lat > BBOX.latMax || lon < BBOX.lonMin || lon > BBOX.lonMax) {
          errs.push('route: titik di luar area operasi');
          break;
        }
      }
    }
  }
  if (has('dwellSeconds')) {
    const d = Number(b.dwellSeconds);
    if (!Number.isFinite(d) || d < 0 || d > 3600) errs.push('dwellSeconds: 0-3600');
  }
  if (has('destination') && String(b.destination).length > 60) errs.push('destination: maks 60 karakter');
  return errs;
}

module.exports = { validateShipPayload, TYPES, BBOX };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add services/voyage.js services/ship-validate.js test/voyage.test.js test/ship-validate.test.js
git commit -m "feat(services): voyage ETA pure + validasi payload kapal"
```

---

### Task 4: Simulator dinamis (upsert/remove/getDynamics)

**Files:**
- Modify: `simulator.js` (tambah 3 fungsi + export)
- Test: `test/simulator-crud.test.js`

**Interfaces:**
- Consumes: state internal simulator
- Produces: `upsertShip(def)` def `{mmsi,route,speedKn,dwellSeconds}` → state ship; route berubah (JSON compare) reset posisi ke route[0], kecepatan saja tidak reset; `removeShip(mmsi)→bool`; `getDynamics(mmsi)→{lat,lon,targetIndex,direction,speedKn,dwellUntil}|null`.

- [ ] **Step 1: Write the failing test**

```js
// test/simulator-crud.test.js
const test = require('node:test');
const assert = require('node:assert');
const sim = require('../simulator');
const R1 = [[-7.20, 112.70], [-7.19, 112.71]];
const R2 = [[-7.21, 112.72], [-7.20, 112.73], [-7.19, 112.74]];

test('upsert kapal baru menambah state', () => {
  sim.initSimulator([{ mmsi: '111111111', route: R1, speedKn: 10, dwellSeconds: 0 }]);
  sim.upsertShip({ mmsi: '222222222', route: R2, speedKn: 12, dwellSeconds: 0 });
  assert.strictEqual(sim.getShips().length, 2);
});
test('upsert route berubah mereset posisi ke waypoint pertama', () => {
  sim.initSimulator([{ mmsi: '111111111', route: R1, speedKn: 10, dwellSeconds: 0 }]);
  sim.updateShips(5, 1000);
  sim.upsertShip({ mmsi: '111111111', route: R2, speedKn: 10, dwellSeconds: 0 });
  const s = sim.getShips().find((x) => x.mmsi === '111111111');
  assert.strictEqual(s.lat, R2[0][0]);
  assert.strictEqual(s.lon, R2[0][1]);
});
test('upsert kecepatan saja tidak mereset posisi', () => {
  sim.initSimulator([{ mmsi: '111111111', route: R1, speedKn: 10, dwellSeconds: 0 }]);
  sim.updateShips(5, 1000);
  const before = sim.getShips()[0];
  sim.upsertShip({ mmsi: '111111111', route: R1, speedKn: 14, dwellSeconds: 0 });
  const after = sim.getShips()[0];
  assert.strictEqual(after.lat, before.lat);
  assert.strictEqual(after.speed, 14);
});
test('remove menghapus kapal dari state', () => {
  sim.initSimulator([{ mmsi: '111111111', route: R1, speedKn: 10, dwellSeconds: 0 }]);
  assert.ok(sim.removeShip('111111111'));
  assert.strictEqual(sim.getShips().length, 0);
  assert.ok(!sim.removeShip('999999999'));
});
test('getDynamics memberi input voyage atau null', () => {
  sim.initSimulator([{ mmsi: '111111111', route: R1, speedKn: 10, dwellSeconds: 0 }]);
  const d = sim.getDynamics('111111111');
  assert.strictEqual(d.targetIndex, 1);
  assert.strictEqual(d.direction, 1);
  assert.strictEqual(sim.getDynamics('999999999'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL `sim.upsertShip is not a function`.

- [ ] **Step 3: Implement di simulator.js**

Tambahkan sebelum `module.exports`:

```js
/** Tambah kapal baru atau perbarui kapal ada (CRUD live, tanpa restart). */
function upsertShip(def) {
  const existing = state.find((s) => s.mmsi === def.mmsi);
  if (existing) {
    const routeChanged = JSON.stringify(existing.route) !== JSON.stringify(def.route);
    existing.speedKn = def.speedKn;
    existing.dwellSeconds = def.dwellSeconds || 0;
    if (routeChanged) {
      existing.route = def.route;
      existing.lat = def.route[0][0];
      existing.lon = def.route[0][1];
      existing.targetIndex = 1;
      existing.direction = 1;
      existing.dwellUntil = 0;
      existing.heading = calculateBearing(def.route[0][0], def.route[0][1], def.route[1][0], def.route[1][1]);
    }
    return existing;
  }
  const ship = {
    mmsi: def.mmsi,
    route: def.route,
    speedKn: def.speedKn,
    dwellSeconds: def.dwellSeconds || 0,
    jitter: 0.95 + Math.random() * 0.1,
    lat: def.route[0][0],
    lon: def.route[0][1],
    targetIndex: 1,
    direction: 1,
    dwellUntil: 0,
    heading: calculateBearing(def.route[0][0], def.route[0][1], def.route[1][0], def.route[1][1]),
  };
  state.push(ship);
  return ship;
}

/** Hapus kapal dari simulasi (riwayat Mongo dibiarkan, TTL membersihkan). */
function removeShip(mmsi) {
  const i = state.findIndex((s) => s.mmsi === mmsi);
  if (i >= 0) state.splice(i, 1);
  return i >= 0;
}

/** Input voyage untuk services/voyage (posisi + arah + sandar). */
function getDynamics(mmsi) {
  const s = state.find((x) => x.mmsi === mmsi);
  if (!s) return null;
  return { lat: s.lat, lon: s.lon, targetIndex: s.targetIndex, direction: s.direction, speedKn: s.speedKn, dwellUntil: s.dwellUntil };
}
```

dan tambahkan ketiganya ke `module.exports`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add simulator.js test/simulator-crud.test.js
git commit -m "feat(simulator): upsert/remove kapal live + getDynamics untuk voyage"
```

---

### Task 5: Fleet service PG routes + routes/auth.js + CRUD API + wiring server

**Files:**
- Modify: `services/fleet.js` (loadStaticFromPg JOIN routes; getStaticFleet/getStatic/setStatic/dropStatic)
- Create: `routes/auth.js`
- Modify: `routes/api.js` (detail + CRUD + emit fleet:update)
- Modify: `server.js` (init simulator dari PG static, `app.set('io', io)`, mount routes/auth)
- Test: manual curl (integrasi) setelah server watch restart

**Interfaces:**
- Consumes: Task 2 `services/auth`, Task 3 `computeVoyage/validateShipPayload`, Task 4 `sim.upsertShip/removeShip/getDynamics`
- Produces: `services/fleet`: `loadStaticFromPg(pool)→n`, `getStaticFleet()→array`, `getStatic(mmsi)→obj|undefined`, `setStatic(obj)`, `dropStatic(mmsi)`, `getMergedShips()`; `routes/auth` export `{ router, requireAuth, sameOrigin, sessionUser }`; endpoint sesuai spec §5-6; socket event `fleet:update`.

- [ ] **Step 1: services/fleet.js load PG lengkap**

Ganti `loadStaticFromPg` dan tambah helper:

```js
async function loadStaticFromPg(pool) {
  try {
    const { rows } = await pool.query(
      `SELECT s.mmsi, s.name, s.type, s.imo, s.call_sign, s.flag, s.length_m, s.beam_m,
              s.destination, s.owner_id, r.waypoints, r.speed_kn, r.dwell_s
       FROM ships s LEFT JOIN routes r ON r.mmsi = s.mmsi`,
    );
    for (const r of rows) {
      const base = staticMap.get(r.mmsi) || {};
      staticMap.set(r.mmsi, {
        ...base,
        mmsi: r.mmsi, name: r.name, type: r.type,
        imo: r.imo, callSign: r.call_sign, flag: r.flag,
        lengthM: r.length_m == null ? null : Number(r.length_m),
        beamM: r.beam_m == null ? null : Number(r.beam_m),
        destination: r.destination, owner_id: r.owner_id,
        route: r.waypoints || base.route,
        speedKn: r.speed_kn == null ? base.speedKn : Number(r.speed_kn),
        dwellSeconds: r.dwell_s == null ? base.dwellSeconds : r.dwell_s,
      });
    }
    return rows.length;
  } catch (err) {
    console.warn('PostgreSQL tidak tersedia, pakai data fleet lokal:', err.message);
    return 0;
  }
}

const getStaticFleet = () => [...staticMap.values()];
const getStatic = (mmsi) => staticMap.get(mmsi);
function setStatic(obj) { staticMap.set(obj.mmsi, { ...staticMap.get(obj.mmsi), ...obj }); }
function dropStatic(mmsi) { staticMap.delete(mmsi); }
```

Export semuanya; `mergeShips` tetap (particulars ikut lewat `...s`).

- [ ] **Step 2: routes/auth.js**

```js
/**
 * routes/auth.js — Register/login/logout/me dengan sesi cookie PG.
 * Rate limit 5/menit/IP; Origin check untuk mutasi; tanpa dependensi baru.
 */
const express = require('express');
const { pool } = require('../db/postgres');
const A = require('../services/auth');

const router = express.Router();
const limiter = A.createRateLimiter(5, 60000);
const MAX_AGE = Math.floor(A.SESSION_TTL_MS / 1000);

const pgDown = (res) => res.status(503).json({ status: 'error', message: 'Database akun belum tersedia' });
const bad = (res, msg) => res.status(400).json({ status: 'error', message: msg });

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function sessionUser(req) {
  const tok = parseCookies(req)[A.COOKIE_NAME];
  if (!tok) return null;
  const id = A.hashToken(tok);
  const { rows } = await pool.query(
    'SELECT u.id, u.username, u.role, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1',
    [id],
  );
  if (!rows.length) return null;
  if (A.isExpired(rows[0].expires_at)) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
    return null;
  }
  return { id: rows[0].id, username: rows[0].username, role: rows[0].role };
}

async function requireAuth(req, res, next) {
  try {
    const u = await sessionUser(req);
    if (!u) return res.status(401).json({ status: 'error', message: 'Silakan masuk dulu' });
    req.user = u;
    next();
  } catch {
    pgDown(res);
  }
}

function sameOrigin(req, res, next) {
  const o = req.headers.origin;
  if (o) {
    try {
      if (new URL(o).host !== req.headers.host) {
        return res.status(403).json({ status: 'error', message: 'Origin tidak diizinkan' });
      }
    } catch {
      return res.status(403).json({ status: 'error', message: 'Origin tidak valid' });
    }
  }
  next();
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${A.COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`);
}

async function startSession(res, userId) {
  const token = A.newToken();
  await pool.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2,$3)', [A.hashToken(token), userId, A.sessionExpiry()]);
  setSessionCookie(res, token);
}

router.post('/register', sameOrigin, async (req, res) => {
  if (!limiter.try(req.ip)) return res.status(429).json({ status: 'error', message: 'Terlalu banyak percobaan, coba lagi semenit' });
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) return bad(res, 'username: 3-24 karakter a-z 0-9 . _ -');
  if (password.length < 8) return bad(res, 'password: minimal 8 karakter');
  try {
    const dup = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (dup.rows.length) return res.status(409).json({ status: 'error', message: 'Username sudah dipakai' });
    const count = await pool.query('SELECT count(*)::int AS n FROM users');
    const role = count.rows[0].n === 0 ? 'admin' : 'operator';
    const ins = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3) RETURNING id, username, role',
      [username, A.hashPassword(password), role],
    );
    await startSession(res, ins.rows[0].id);
    res.status(201).json({ status: 'success', data: ins.rows[0] });
  } catch {
    pgDown(res);
  }
});

router.post('/login', sameOrigin, async (req, res) => {
  if (!limiter.try(req.ip)) return res.status(429).json({ status: 'error', message: 'Terlalu banyak percobaan, coba lagi semenit' });
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  try {
    const { rows } = await pool.query('SELECT id, username, role, password_hash FROM users WHERE username = $1', [username]);
    if (!rows.length || !A.verifyPassword(password, rows[0].password_hash)) {
      return res.status(401).json({ status: 'error', message: 'Username atau password salah' });
    }
    await pool.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()', [rows[0].id]);
    await startSession(res, rows[0].id);
    res.json({ status: 'success', data: { id: rows[0].id, username: rows[0].username, role: rows[0].role } });
  } catch {
    pgDown(res);
  }
});

router.post('/logout', sameOrigin, async (req, res) => {
  const tok = parseCookies(req)[A.COOKIE_NAME];
  try {
    if (tok) await pool.query('DELETE FROM sessions WHERE id = $1', [A.hashToken(tok)]);
  } catch { /* sesi tetap dibersihkan di client */ }
  res.setHeader('Set-Cookie', `${A.COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ status: 'success' });
});

router.get('/me', async (req, res) => {
  try {
    const u = await sessionUser(req);
    if (!u) return res.status(401).json({ status: 'error', message: 'Belum masuk' });
    res.json({ status: 'success', data: u });
  } catch {
    pgDown(res);
  }
});

module.exports = { router, requireAuth, sameOrigin, sessionUser };
```

- [ ] **Step 3: routes/api.js detail + CRUD**

Tambahkan import: `const { router: authRouter, requireAuth, sameOrigin } = require('./auth');` tidak di sini — auth di-mount server. Di api.js tambah:

```js
const sim = require('../simulator');
const { computeVoyage } = require('../services/voyage');
const { validateShipPayload } = require('../services/ship-validate');
const { canEditShip } = require('../services/auth');
const { getStatic, setStatic, dropStatic } = require('../services/fleet');
const { requireAuth, sameOrigin } = require('./auth');

const emitFleet = (req) => req.app.get('io')?.emit('fleet:update', getMergedShips());

router.get('/ships/:mmsi', (req, res) => {
  const s = getStatic(req.params.mmsi);
  if (!s) return res.status(404).json({ status: 'error', message: 'Kapal tidak dikenal' });
  const dyn = sim.getDynamics(s.mmsi);
  const voyage = dyn && s.route ? { destination: s.destination || null, ...computeVoyage(dyn, s.route) } : null;
  res.json({ status: 'success', data: { ...s, voyage } });
});

router.post('/ships', requireAuth, sameOrigin, async (req, res) => {
  const errs = validateShipPayload(req.body || {});
  if (errs.length) return res.status(400).json({ status: 'error', message: errs.join('; ') });
  const b = req.body;
  try {
    const dup = await pool.query('SELECT 1 FROM ships WHERE mmsi = $1', [b.mmsi]);
    if (dup.rows.length) return res.status(409).json({ status: 'error', message: 'MMSI sudah terdaftar' });
    await pool.query(
      `INSERT INTO ships (mmsi,name,type,imo,call_sign,flag,length_m,beam_m,destination,owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [b.mmsi, b.name.trim(), b.type, b.imo || null, b.callSign || null, b.flag || null, b.lengthM ?? null, b.beamM ?? null, b.destination || null, req.user.id],
    );
    await pool.query('INSERT INTO routes (mmsi,waypoints,speed_kn,dwell_s) VALUES ($1,$2,$3,$4)', [b.mmsi, JSON.stringify(b.route), b.speedKn, b.dwellSeconds || 0]);
    setStatic({ ...b, name: b.name.trim(), owner_id: req.user.id });
    sim.upsertShip({ mmsi: b.mmsi, route: b.route, speedKn: b.speedKn, dwellSeconds: b.dwellSeconds || 0 });
    emitFleet(req);
    res.status(201).json({ status: 'success', data: getStatic(b.mmsi) });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database kapal belum tersedia' });
  }
});

router.put('/ships/:mmsi', requireAuth, sameOrigin, async (req, res) => {
  const errs = validateShipPayload(req.body || {}, { partial: true });
  if (errs.length) return res.status(400).json({ status: 'error', message: errs.join('; ') });
  try {
    const { rows } = await pool.query('SELECT * FROM ships WHERE mmsi = $1', [req.params.mmsi]);
    if (!rows.length) return res.status(404).json({ status: 'error', message: 'Kapal tidak dikenal' });
    if (!canEditShip(req.user, rows[0])) return res.status(403).json({ status: 'error', message: 'Hanya pemilik atau admin yang boleh mengubah kapal ini' });
    const b = req.body;
    const cur = rows[0];
    await pool.query(
      `UPDATE ships SET name=$1, type=$2, imo=$3, call_sign=$4, flag=$5, length_m=$6, beam_m=$7, destination=$8 WHERE mmsi=$9`,
      [b.name ?? cur.name, b.type ?? cur.type, b.imo ?? cur.imo, b.callSign ?? cur.call_sign, b.flag ?? cur.flag, b.lengthM ?? cur.length_m, b.beamM ?? cur.beam_m, b.destination ?? cur.destination, cur.mmsi],
    );
    const route = b.route || (await pool.query('SELECT waypoints FROM routes WHERE mmsi=$1', [cur.mmsi])).rows[0]?.waypoints;
    const speedKn = b.speedKn ?? Number((await pool.query('SELECT speed_kn FROM routes WHERE mmsi=$1', [cur.mmsi])).rows[0]?.speed_kn ?? 12);
    const dwell = b.dwellSeconds ?? (await pool.query('SELECT dwell_s FROM routes WHERE mmsi=$1', [cur.mmsi])).rows[0]?.dwell_s ?? 0;
    await pool.query(
      `INSERT INTO routes (mmsi,waypoints,speed_kn,dwell_s) VALUES ($1,$2,$3,$4)
       ON CONFLICT (mmsi) DO UPDATE SET waypoints=EXCLUDED.waypoints, speed_kn=EXCLUDED.speed_kn, dwell_s=EXCLUDED.dwell_s`,
      [cur.mmsi, JSON.stringify(route), speedKn, dwell],
    );
    setStatic({ mmsi: cur.mmsi, name: b.name ?? cur.name, type: b.type ?? cur.type, imo: b.imo ?? cur.imo, callSign: b.callSign ?? cur.call_sign, flag: b.flag ?? cur.flag, lengthM: b.lengthM ?? cur.length_m, beamM: b.beamM ?? cur.beam_m, destination: b.destination ?? cur.destination, route, speedKn, dwellSeconds: dwell });
    sim.upsertShip({ mmsi: cur.mmsi, route, speedKn, dwellSeconds: dwell });
    emitFleet(req);
    res.json({ status: 'success', data: getStatic(cur.mmsi) });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database kapal belum tersedia' });
  }
});

router.delete('/ships/:mmsi', requireAuth, sameOrigin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT mmsi, owner_id FROM ships WHERE mmsi = $1', [req.params.mmsi]);
    if (!rows.length) return res.status(404).json({ status: 'error', message: 'Kapal tidak dikenal' });
    if (!canEditShip(req.user, rows[0])) return res.status(403).json({ status: 'error', message: 'Hanya pemilik atau admin yang boleh menghapus kapal ini' });
    await pool.query('DELETE FROM ships WHERE mmsi = $1', [req.params.mmsi]);
    dropStatic(req.params.mmsi);
    sim.removeShip(req.params.mmsi);
    emitFleet(req);
    res.json({ status: 'success', deleted: true });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database kapal belum tersedia' });
  }
});
```

Catatan urutan: route `GET /ships/:mmsi` harus terdaftar SEBELUM `GET /ships/:mmsi/history`? Tidak — path berbeda jumlah segmen, Express cocokkan persis; aman di mana saja setelah `/ships`.

- [ ] **Step 4: server.js wiring**

- Setelah `const io = new Server(server);` tambahkan `app.set('io', io);`
- Mount auth: `app.use('/api/auth', require('./routes/auth').router);` SEBELUM `app.use('/api', apiRouter);`
- Hapus `sim.initSimulator(FLEET);` di baris 58; di blok start async setelah `loadStaticFromPg`:

```js
  const fleet = getStaticFleet().filter((s) => Array.isArray(s.route) && s.route.length >= 2);
  sim.initSimulator(fleet);
```

(import `getStaticFleet` dari services/fleet; log jumlah pakai `fleet.length`).

- [ ] **Step 5: Verifikasi integrasi curl**

Server watch restart otomatis. Run (urutan):

```bash
curl -s -c /tmp/ais.jar -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{"username":"tester1","password":"rahasia123"}'
curl -s -b /tmp/ais.jar localhost:3000/api/auth/me
curl -s -b /tmp/ais.jar -X POST localhost:3000/api/ships -H 'Content-Type: application/json' -d '{"mmsi":"525009001","name":"Kapal Uji","type":"cargo","speedKn":12,"route":[[-7.20,112.70],[-7.19,112.71]]}'
curl -s localhost:3000/api/ships/525009001
curl -s -b /tmp/ais.jar -X DELETE localhost:3000/api/ships/525009001
```

Expected: 201 register (role admin karena user pertama), 200 me, 201 ship, 200 detail dengan voyage.etaIso, 200 deleted. Lalu `npm test` tetap PASS.

- [ ] **Step 6: Commit**

```bash
git add services/fleet.js routes/auth.js routes/api.js server.js
git commit -m "feat(api): auth sesi cookie + CRUD kapal live + detail voyage"
```

---

### Task 6: Palette system + audit slop CSS

**Files:**
- Modify: `public/css/console.css` (token palet, override 3 palet, spacing scale, hover fix, komponen baru Tasks 7-9 disiapkan class-nya)
- Modify: `public/index.html` (tombol palet topbar)
- Modify: `public/js/main.js` (switcher + persist)
- Modify: `public/js/history.js` (readout gap `--` bukan em-dash)

**Interfaces:**
- Consumes: token spec §2
- Produces: `html[data-palette]` ∈ {sonar,phosphor,amber,chart}; `localStorage['ais.palette']`; fungsi `applyPalette(name)` di main.js; class komponen: `.search-row`, `.fav-star`, `.kbd-active`, `.detail-drawer`, `.modal`, `.route-tools`, `.auth-user`.

- [ ] **Step 1: Token palet + spacing**

Di `:root` ganti nilai token existing dengan kolom sonar spec §2 dan tambah:

```css
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px; --sp-6: 32px;
  --accent-ink: #062a26;
```

Tambahkan blok override (nilai persis spec §2):

```css
html[data-palette="phosphor"] { --bg:#0a0f0b; --panel:#101710; --panel-2:#162116; --border:#243024; --border-hi:#3a4a3a; --text:#e4efe4; --dim:#9db39d; --faint:#869986; --accent:#52d869; --accent-ink:#06210c; }
html[data-palette="amber"] { --bg:#0e141d; --panel:#141c28; --panel-2:#1a2432; --border:#263243; --border-hi:#3c4c60; --text:#e8ecf2; --dim:#9aa8ba; --faint:#8492a4; --accent:#ffb454; --accent-ink:#2b1602; }
html[data-palette="chart"] { --bg:#f2efe6; --panel:#faf8f1; --panel-2:#ece8dc; --border:#d8d2c0; --border-hi:#b9b19a; --text:#16232e; --dim:#4c5a66; --faint:#5d6b77; --accent:#c8402f; --accent-ink:#fff6f2; }
```

Audit: ganti padding/gap/margin px acak kelipatan 4 dengan `var(--sp-*)`; hover tombol yang memakai opacity → `border-color: var(--border-hi); color: var(--text);` instan (transition hanya border-color/color 120ms, bukan opacity); pastikan tidak ada gradient/blur/grain; em-dash di copy CSS content diganti `--`.

- [ ] **Step 2: Switcher di main.js + index.html**

index.html topbar-right sebelum `#connBadge`:

```html
      <button id="paletteBtn" class="icon-btn" title="Ganti palet warna" aria-label="Ganti palet warna">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 12l6.5-6.5"/>
        </svg>
      </button>
```

main.js:

```js
// ─── Palet konsol ───────────────────────────────────────────────────────────
const PALETTES = ['sonar', 'phosphor', 'amber', 'chart'];
function applyPalette(name, silent) {
  document.documentElement.dataset.palette = name;
  localStorage.setItem('ais.palette', name);
  const light = name === 'chart';
  dark = !light;
  setDark(dark);
  themeLabel.textContent = light ? 'PETA TERANG' : 'PETA GELAP';
  if (!silent) toast(`Palet ${name} aktif`);
}
applyPalette(localStorage.getItem('ais.palette') || 'sonar', true);
document.getElementById('paletteBtn').addEventListener('click', () => {
  const cur = document.documentElement.dataset.palette || 'sonar';
  applyPalette(PALETTES[(PALETTES.indexOf(cur) + 1) % PALETTES.length]);
});
```

Catatan: blok ini harus setelah deklarasi `dark/setDark/themeLabel` (pindahkan deklarasi tema ke atas wiring palet).

- [ ] **Step 3: Readout gap tanpa em-dash**

Di `public/js/history.js` ganti string `'SOG — · HDG — (gap data)'` menjadi `'SOG -- · HDG -- (gap data)'`.

- [ ] **Step 4: Verifikasi visual 4 palet**

CDP headless: load page, klik `#paletteBtn` 4 kali, screenshot tiap palet, cek computed contrast teks `--dim` vs `--panel` ≥ 4.5 via script evaluasi. Expected: 4 screenshot berbeda jelas, tanpa ungu/gradient.

- [ ] **Step 5: Commit**

```bash
git add public/css/console.css public/index.html public/js/main.js public/js/history.js
git commit -m "feat(ui): palette system 4 palet + switcher + audit spacing/hover slop"
```

---

### Task 7: Search + favorites + follow

**Files:**
- Modify: `public/js/util.js` (matchShip, fmtNm)
- Create: `public/js/favorites.js`
- Modify: `public/js/fleet.js` (search state, fav star, fav filter, keyboard nav)
- Modify: `public/index.html` (search input, chip Favorit)
- Modify: `public/js/main.js` (wiring search/fav/follow pan)
- Modify: `public/css/console.css` (search-row, fav-star, kbd-active, fav-chip)
- Test: `test/search.test.js`

**Interfaces:**
- Consumes: `createFleet(map,{onSelect})` existing
- Produces: `matchShip(ship,q)→bool`, `fmtNm(m)→string`; `createFavorites()→{has,toggle,isFollow,setFollow,getFollow}`; fleet API tambahan `setSearch(q)→count`, `setFavFilter(on)→count`, `moveKbd(delta)`, `selectKbd()`, `clearKbd()`, `getShip(mmsi)`; signature `createFleet(map,{onSelect,favorites,onToggleFav})`.

- [ ] **Step 1: Write the failing test**

```js
// test/search.test.js
const test = require('node:test');
const assert = require('node:assert');

test('matchShip nama substring case-insensitive dan mmsi substring', async () => {
  const { matchShip } = await import('../public/js/util.js');
  const ship = { name: 'KM Dharma Kencana VII', mmsi: '525001001' };
  assert.ok(matchShip(ship, 'dharma'));
  assert.ok(matchShip(ship, '  DHARMA  '));
  assert.ok(matchShip(ship, '525001'));
  assert.ok(matchShip(ship, ''));
  assert.ok(matchShip(ship, null));
  assert.ok(!matchShip(ship, 'tanker'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL matchShip bukan fungsi.

- [ ] **Step 3: util.js + favorites.js**

Tambah ke util.js:

```js
/** Matcher search sidebar: nama substring (case-insensitive) atau MMSI substring. */
export function matchShip(ship, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  return String(ship.name || '').toLowerCase().includes(s) || String(ship.mmsi || '').includes(s);
}
/** Meter → mil laut, 1 desimal. */
export const fmtNm = (m) => (m / 1852).toFixed(1);
```

```js
// public/js/favorites.js
/** favorites.js — Favorit & follow per browser (localStorage), tanpa auth. */
const FAVS_KEY = 'ais.favs';
const FOLLOW_KEY = 'ais.follow';

export function createFavorites() {
  let favs = new Set();
  try { favs = new Set(JSON.parse(localStorage.getItem(FAVS_KEY) || '[]')); } catch { favs = new Set(); }
  let follow = localStorage.getItem(FOLLOW_KEY) || null;
  const save = () => localStorage.setItem(FAVS_KEY, JSON.stringify([...favs]));
  return {
    has: (mmsi) => favs.has(mmsi),
    toggle(mmsi) {
      if (favs.has(mmsi)) favs.delete(mmsi); else favs.add(mmsi);
      save();
      return favs.has(mmsi);
    },
    isFollow: (mmsi) => follow === mmsi,
    getFollow: () => follow,
    setFollow(mmsi) {
      follow = follow === mmsi ? null : mmsi;
      if (follow) localStorage.setItem(FOLLOW_KEY, follow); else localStorage.removeItem(FOLLOW_KEY);
      return follow;
    },
  };
}
```

- [ ] **Step 4: fleet.js search/fav/keyboard**

- Import `matchShip`; signature `createFleet(map, { onSelect, favorites, onToggleFav })`.
- State baru: `let query = ''; let favFilter = false; let kbdIndex = -1;`
- `makeRow`: tambah star setelah type-tag:

```js
        <button class="fav-star" data-el="fav" aria-pressed="false" title="Favorit" aria-label="Favoritkan ${escapeHtml(ship.name)}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9"/></svg>
        </button>
```

dan `els.fav = row.querySelector('[data-el="fav"]')`.
- Delegasi klik: sebelum handler row, `const star = e.target.closest('.fav-star'); if (star) { e.stopPropagation(); onToggleFav(row.dataset.mmsi); return; }`
- Visibility: `const visible = activeFilters.has(ship.type) && (!favFilter || favorites.has(ship.mmsi)) && matchShip(ship, query);`
- Dalam update visible: sinkron star `obj.els.fav.classList.toggle('on', favorites.has(ship.mmsi)); obj.els.fav.setAttribute('aria-pressed', String(favorites.has(ship.mmsi)));`
- Fungsi baru + export:

```js
  const allData = () => [...markers.values()].map((o) => o.data);
  function setSearch(q) { query = q; kbdIndex = -1; clearKbd(); return update(allData()); }
  function setFavFilter(on) { favFilter = on; return update(allData()); }
  const visibleRows = () => [...markers.values()].filter((o) => !o.row.classList.contains('hidden')).map((o) => o.row);
  function clearKbd() { kbdIndex = -1; listEl.querySelectorAll('.kbd-active').forEach((r) => r.classList.remove('kbd-active')); }
  function moveKbd(delta) {
    const rows = visibleRows();
    if (!rows.length) return;
    kbdIndex = Math.min(Math.max(kbdIndex + delta, 0), rows.length - 1);
    clearKbdClassOnly();
    rows[kbdIndex].classList.add('kbd-active');
    rows[kbdIndex].scrollIntoView({ block: 'nearest' });
  }
  function clearKbdClassOnly() { listEl.querySelectorAll('.kbd-active').forEach((r) => r.classList.remove('kbd-active')); }
  function selectKbd() { const rows = visibleRows(); if (rows[kbdIndex]) onSelect(rows[kbdIndex].dataset.mmsi); }
  const getShip = (mmsi) => markers.get(mmsi)?.data;
```

(`clearKbd` memakai `clearKbdClassOnly` + reset index; return object menambah `setSearch, setFavFilter, moveKbd, selectKbd, clearKbd, getShip`.)
- Pesan empty: `emptyEl.innerHTML = query ? '<span>Tidak ada kapal yang cocok dengan pencarian</span>' : '<span>Tidak ada kapal yang sesuai filter</span>';` saat visibleCount 0.

- [ ] **Step 5: index.html + main.js wiring**

Setelah `sidebar-head`, sebelum filter-grid:

```html
      <div class="search-row">
        <input id="shipSearch" type="search" placeholder="Cari nama / MMSI" aria-label="Cari kapal berdasarkan nama atau MMSI" autocomplete="off">
      </div>
```

Tambah chip di filter-grid:

```html
        <button id="favFilter" class="filter-btn fav-chip" aria-pressed="false"><span class="dot"></span>Favorit</button>
```

main.js:

```js
const favorites = createFavorites();
const fleet = createFleet(map, {
  onSelect: (mmsi) => { fleet.setSelected(mmsi); detail.open(mmsi); },
  favorites,
  onToggleFav: (mmsi) => { const on = favorites.toggle(mmsi); toast(on ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit'); fleet.update(lastShips); },
});
let lastShips = [];
// di onUpdate: lastShips = ships; ... follow pan:
const f = favorites.getFollow();
if (f && !history.isOpen()) { const s = ships.find((x) => x.mmsi === f); if (s) map.panTo([s.lat, s.lon], { animate: true, duration: 0.5 }); }
// search:
const searchEl = document.getElementById('shipSearch');
let searchTimer = null;
searchEl.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { totalEl.textContent = fleet.setSearch(searchEl.value); }, 120); });
searchEl.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); fleet.moveKbd(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); fleet.moveKbd(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); fleet.selectKbd(); }
  else if (e.key === 'Escape') { searchEl.value = ''; totalEl.textContent = fleet.setSearch(''); searchEl.blur(); }
});
document.getElementById('favFilter').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const on = !btn.classList.contains('active');
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', String(on));
  totalEl.textContent = fleet.setFavFilter(on);
});
```

`history.js` menambah `isOpen: () => open` pada return object (state `open` sudah ada di modul).

- [ ] **Step 6: CSS komponen**

```css
.search-row { padding: var(--sp-2) var(--sp-3) 0; }
.search-row input { width: 100%; background: var(--panel-2); border: 1px solid var(--border); color: var(--text); font: 500 12px/1.4 var(--font-sans); padding: var(--sp-2) var(--sp-3); border-radius: 3px; }
.search-row input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.search-row input::placeholder { color: var(--faint); }
.fav-star { margin-left: auto; background: none; border: 0; color: var(--faint); cursor: pointer; padding: 2px; display: inline-flex; }
.fav-star:hover { color: var(--text); }
.fav-star.on { color: var(--accent); }
.fav-star.on svg { fill: var(--accent); }
.ship-row.kbd-active { border-color: var(--accent); }
.fav-chip .dot { background: var(--accent); }
.fav-chip:not(.active) .dot { background: var(--text-faint, var(--faint)); }
```

- [ ] **Step 7: Run tests + verifikasi CDP**

Run: `npm test` → PASS. CDP: ketik "dharma" → 1 baris; ArrowDown+Enter → drawer/selected; Escape kosong; klik star → reload → star tetap on; chip Favorit menyaring.

- [ ] **Step 8: Commit**

```bash
git add public/js/util.js public/js/favorites.js public/js/fleet.js public/js/main.js public/js/history.js public/index.html public/css/console.css test/search.test.js
git commit -m "feat(ui): search keyboard, favorites localStorage, follow pan-to"
```

---

### Task 8: Detail drawer + voyage live

**Files:**
- Create: `public/js/detail.js`
- Modify: `public/js/main.js` (wiring detail + refresh)
- Modify: `public/css/console.css` (`.detail-drawer` dll)
- Modify: `public/index.html` (tidak ada; drawer dibuat JS di dalam `.main`)

**Interfaces:**
- Consumes: GET `/api/ships/:mmsi` (Task 5), `favorites`, `fmtNm/escapeHtml/fmtCoord`
- Produces: `createDetail(mainEl, { favorites, canEdit, getDyn, onHistory, onEdit, onDelete, onFollow }) → { open(mmsi)→Promise<bool>, close(), refresh(ships), rerender(), isOpen() }`; `getDyn(mmsi)` mengembalikan snapshot live terakhir supaya drawer langsung terisi saat dibuka.

- [ ] **Step 1: Implement detail.js**

```js
/** detail.js — Drawer kanan: particulars, voyage, aksi favorit/follow/riwayat/edit. */
import { escapeHtml, fmtCoord, fmtNm } from './util.js';

export function createDetail(mainEl, { favorites, canEdit, getDyn, onHistory, onEdit, onDelete, onFollow }) {
  const el = document.createElement('aside');
  el.className = 'detail-drawer';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Detail kapal');
  el.hidden = true;
  mainEl.appendChild(el);
  let current = null;
  let voyageAt = 0;
  let deleteArmed = false;

  const row = (label, value) => `<div class="popup-row"><span class="popup-row-label">${label}</span><span class="popup-row-value">${value}</span></div>`;

  function render() {
    if (!current) return;
    const s = current;
    const v = s.voyage;
    const editable = canEdit(s);
    deleteArmed = false;
    el.innerHTML = `
      <div class="detail-head">
        <span class="detail-title">${escapeHtml(s.name)}</span>
        <button class="icon-btn" data-el="close" aria-label="Tutup detail">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <span class="popup-type ${escapeHtml(s.type)}">${escapeHtml(s.type)}</span>
      <div class="popup-divider"></div>
      ${row('MMSI', escapeHtml(s.mmsi))}
      ${s.imo ? row('IMO', escapeHtml(s.imo)) : ''}
      ${s.callSign ? row('Call sign', escapeHtml(s.callSign)) : ''}
      ${s.flag ? row('Bendera', escapeHtml(s.flag)) : ''}
      ${s.lengthM ? row('Panjang / lebar', `${Number(s.lengthM).toFixed(1)} m / ${Number(s.beamM).toFixed(1)} m`) : ''}
      <div class="popup-divider"></div>
      <div class="detail-live" data-el="live"></div>
      <div class="popup-divider"></div>
      ${v ? row('Destination', escapeHtml(v.destination || '-')) : ''}
      ${v ? row('ETA', `<span data-el="eta">${new Date(v.etaIso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>`) : ''}
      ${v ? row('Sisa jarak', `<span data-el="nm">${fmtNm(v.remainingM)} nm</span>`) : ''}
      <div class="detail-actions">
        <button class="btn" data-el="fav" aria-pressed="${favorites.has(s.mmsi)}">${favorites.has(s.mmsi) ? '★ FAVORIT' : '☆ FAVORIT'}</button>
        <button class="btn" data-el="follow" aria-pressed="${favorites.isFollow(s.mmsi)}">${favorites.isFollow(s.mmsi) ? 'FOLLOW ON' : 'FOLLOW'}</button>
        <button class="btn" data-el="hist">RIWAYAT</button>
        ${editable ? '<button class="btn" data-el="edit">EDIT</button>' : ''}
        ${editable ? '<button class="btn danger" data-el="del">HAPUS</button>' : ''}
      </div>`;
    el.querySelector('[data-el="close"]').addEventListener('click', close);
    el.querySelector('[data-el="fav"]').addEventListener('click', () => { favorites.toggle(s.mmsi); render(); });
    el.querySelector('[data-el="follow"]').addEventListener('click', () => { onFollow(s.mmsi); render(); });
    el.querySelector('[data-el="hist"]').addEventListener('click', () => onHistory(s.mmsi));
    el.querySelector('[data-el="edit"]')?.addEventListener('click', () => onEdit(s));
    el.querySelector('[data-el="del"]')?.addEventListener('click', (e) => {
      if (!deleteArmed) { deleteArmed = true; e.currentTarget.textContent = 'YAKIN? KLIK LAGI'; return; }
      onDelete(s.mmsi);
    });
    paintLive();
  }

  function paintLive(dyn) {
    const live = el.querySelector('[data-el="live"]');
    if (!live || !current) return;
    const d = dyn || current.dyn;
    if (!d) return;
    live.innerHTML = row('Kecepatan', `${Number(d.speed).toFixed(1)} kn`) + row('Heading', `${d.heading}°`) + row('Posisi', `${fmtCoord(d.lat)}, ${fmtCoord(d.lon)}`) + row('Status', d.status === 'moored' ? 'MOORED' : 'UNDERWAY');
  }

  async function open(mmsi) {
    const r = await fetch(`/api/ships/${mmsi}`);
    if (!r.ok) return false;
    current = (await r.json()).data;
    current.dyn = getDyn ? getDyn(mmsi) : null;
    voyageAt = Date.now();
    el.hidden = false;
    render();
    el.querySelector('[data-el="close"]').focus();
    return true;
  }
  function close() { el.hidden = true; current = null; }
  function refresh(ships) {
    if (!current || el.hidden) return;
    const d = ships.find((x) => x.mmsi === current.mmsi);
    if (!d) { close(); return; }
    current.dyn = d;
    paintLive(d);
    if (Date.now() - voyageAt > 10000) {
      voyageAt = Date.now();
      fetch(`/api/ships/${current.mmsi}`).then((r) => (r.ok ? r.json() : null)).then((j) => {
        if (j && current && j.data.mmsi === current.mmsi) {
          current.voyage = j.data.voyage;
          const eta = el.querySelector('[data-el="eta"]');
          const nm = el.querySelector('[data-el="nm"]');
          if (eta && current.voyage) eta.textContent = new Date(current.voyage.etaIso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          if (nm && current.voyage) nm.textContent = `${fmtNm(current.voyage.remainingM)} nm`;
        }
      }).catch(() => {});
    }
  }
  return { open, close, refresh, rerender: render, isOpen: () => !el.hidden };
}
```

Catatan: glyph ★/☆ di tombol adalah teks status, bukan emoji heading (lolos audit #3).

- [ ] **Step 2: CSS drawer**

```css
.detail-drawer { position: absolute; top: 0; right: 0; bottom: 0; width: min(320px, 100%); background: var(--panel); border-left: 1px solid var(--border); padding: var(--sp-3); overflow-y: auto; z-index: 500; display: flex; flex-direction: column; gap: var(--sp-2); }
.detail-drawer[hidden] { display: none; }
.detail-head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }
.detail-title { font: 600 14px/1.3 var(--font-sans); color: var(--text); }
.detail-actions { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
.btn.danger { color: var(--tanker); border-color: var(--border); }
.btn.danger:hover { border-color: var(--tanker); }
```

- [ ] **Step 3: Wiring main.js**

```js
const detail = createDetail(document.querySelector('.main'), {
  favorites,
  canEdit: (ship) => auth.canEdit(ship),
  getDyn: (mmsi) => fleet.getShip(mmsi),
  onHistory: (mmsi) => history.open(mmsi, fleet.getName(mmsi)),
  onEdit: (ship) => editor.open(ship),
  onDelete: async (mmsi) => {
    const r = await fetch(`/api/ships/${mmsi}`, { method: 'DELETE' });
    if (r.ok) { toast('Kapal dihapus'); detail.close(); } else toast((await r.json()).message);
  },
  onFollow: (mmsi) => { const f = favorites.setFollow(mmsi); toast(f ? 'Follow aktif — peta mengikuti kapal' : 'Follow dimatikan'); },
});
// onUpdate tambahan: detail.refresh(ships);
// Esc global: bila detail.isOpen() → detail.close()
```

(Urutan deklarasi: favorites → auth → detail → fleet → editor; sesuaikan hoisting dengan fungsi factory yang tidak saling panggil saat konstruksi.)

- [ ] **Step 4: Verifikasi CDP**

Klik kapal → drawer terbuka dengan particulars + ETA + sisa nm; angka live berubah tiap tick; Esc menutup; tombol RIWAYAT membuka panel riwayat.

- [ ] **Step 5: Commit**

```bash
git add public/js/detail.js public/js/main.js public/css/console.css
git commit -m "feat(ui): drawer detail kapal + voyage ETA live"
```

---

### Task 9: Auth UI + ship editor + socket fleet:update

**Files:**
- Create: `public/js/auth.js`, `public/js/editor.js`
- Modify: `public/index.html` (dialog auth + editor, tombol topbar/sidebar)
- Modify: `public/js/main.js` (wiring auth/editor/add-ship)
- Modify: `public/js/socket.js` (subscribe fleet:update)
- Modify: `public/css/console.css` (modal, form, route-tools, auth-user)

**Interfaces:**
- Consumes: endpoint Task 5; `createFavorites`
- Produces: `createAuth({onChange}) → { refresh(), open(tab), logout(), getUser(), canEdit(ship) }`; `createEditor(map,{onSaved}) → { open(ship|null), close() }`; socket `fleet:update` → onUpdate yang sama.

- [ ] **Step 1: index.html dialogs + tombol**

Topbar-right (setelah paletteBtn):

```html
      <span id="authUser" class="auth-user" hidden></span>
      <button id="authBtn" class="btn">MASUK</button>
      <button id="logoutBtn" class="btn" hidden>KELUAR</button>
```

Sidebar-head (sebelum toggleSidebar):

```html
        <button id="addShipBtn" class="icon-btn" hidden title="Tambah kapal" aria-label="Tambah kapal">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
```

Sebelum `<div id="toast">`:

```html
  <dialog id="authDialog" class="modal">
    <form id="authForm" method="dialog">
      <div class="modal-head">
        <span class="modal-title" id="authTitle">MASUK OPERATOR</span>
        <button type="button" class="icon-btn" id="authClose" aria-label="Tutup">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-tabs">
        <button type="button" class="btn" id="tabLogin" aria-pressed="true">MASUK</button>
        <button type="button" class="btn" id="tabRegister" aria-pressed="false">DAFTAR</button>
      </div>
      <label class="field"><span>Username</span><input id="authUsername" autocomplete="username" required minlength="3" maxlength="24"></label>
      <label class="field"><span>Password</span><input id="authPassword" type="password" autocomplete="current-password" required minlength="8"></label>
      <p id="authErr" class="form-err" role="alert" hidden></p>
      <button class="btn primary" id="authSubmit" type="submit">MASUK</button>
    </form>
  </dialog>

  <dialog id="editorDialog" class="modal wide">
    <form id="editorForm" method="dialog">
      <div class="modal-head">
        <span class="modal-title" id="editorTitle">TAMBAH KAPAL</span>
        <button type="button" class="icon-btn" id="editorClose" aria-label="Tutup">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="form-grid">
        <label class="field"><span>Nama</span><input id="edName" required maxlength="100"></label>
        <label class="field"><span>MMSI (9 digit)</span><input id="edMmsi" required pattern="\d{9}" inputmode="numeric"></label>
        <label class="field"><span>Tipe</span><select id="edType"><option value="ferry">ferry</option><option value="cargo">cargo</option><option value="tanker">tanker</option><option value="tug">tug</option></select></label>
        <label class="field"><span>Kecepatan (kn)</span><input id="edSpeed" type="number" min="1" max="30" step="0.1" value="12"></label>
        <label class="field"><span>Sandar (detik)</span><input id="edDwell" type="number" min="0" max="3600" value="20"></label>
        <label class="field"><span>Destination</span><input id="edDest" maxlength="60"></label>
        <label class="field"><span>IMO</span><input id="edImo" maxlength="12"></label>
        <label class="field"><span>Call sign</span><input id="edCall" maxlength="12"></label>
        <label class="field"><span>Bendera</span><input id="edFlag" maxlength="40"></label>
        <label class="field"><span>Panjang (m)</span><input id="edLen" type="number" min="1" step="0.1"></label>
        <label class="field"><span>Lebar (m)</span><input id="edBeam" type="number" min="1" step="0.1"></label>
      </div>
      <div class="route-tools">
        <span id="edRouteCount" class="history-count">0 titik — klik peta untuk menambah waypoint</span>
        <button type="button" class="btn" id="edUndo">UNDO</button>
        <button type="button" class="btn" id="edClear">CLEAR</button>
      </div>
      <p id="edErr" class="form-err" role="alert" hidden></p>
      <button class="btn primary" id="edSubmit" type="submit">SIMPAN</button>
    </form>
  </dialog>
```

- [ ] **Step 2: auth.js**

```js
/** auth.js — Modal masuk/daftar + state sesi topbar. */
export function createAuth({ onChange }) {
  let user = null;
  let tab = 'login';
  const dlg = document.getElementById('authDialog');
  const form = document.getElementById('authForm');
  const err = document.getElementById('authErr');
  const title = document.getElementById('authTitle');
  const submit = document.getElementById('authSubmit');
  const uEl = document.getElementById('authUsername');
  const pEl = document.getElementById('authPassword');

  function setTab(t) {
    tab = t;
    title.textContent = t === 'login' ? 'MASUK OPERATOR' : 'DAFTAR OPERATOR';
    submit.textContent = t === 'login' ? 'MASUK' : 'DAFTAR';
    document.getElementById('tabLogin').setAttribute('aria-pressed', String(t === 'login'));
    document.getElementById('tabRegister').setAttribute('aria-pressed', String(t === 'register'));
    pEl.autocomplete = t === 'login' ? 'current-password' : 'new-password';
    err.hidden = true;
  }
  document.getElementById('tabLogin').addEventListener('click', () => setTab('login'));
  document.getElementById('tabRegister').addEventListener('click', () => setTab('register'));
  document.getElementById('authClose').addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const r = await fetch(`/api/auth/${tab}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uEl.value, password: pEl.value }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) { err.textContent = j?.message || 'Gagal menghubungi server'; err.hidden = false; return; }
    user = j.data;
    pEl.value = '';
    dlg.close();
    onChange(user);
  });

  async function refresh() {
    const r = await fetch('/api/auth/me');
    user = r.ok ? (await r.json()).data : null;
    onChange(user);
  }
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    user = null;
    onChange(user);
  }
  return {
    refresh, logout,
    open: (t = 'login') => { setTab(t); dlg.showModal(); uEl.focus(); },
    getUser: () => user,
    canEdit: (ship) => !!user && (user.role === 'admin' || (ship.owner_id != null && ship.owner_id === user.id)),
  };
}
```

- [ ] **Step 3: editor.js**

```js
/** editor.js — Form kapal + gambar rute dengan klik peta (mode edit sementara). */
export function createEditor(map, { onSaved }) {
  const dlg = document.getElementById('editorDialog');
  const form = document.getElementById('editorForm');
  const err = document.getElementById('edErr');
  const count = document.getElementById('edRouteCount');
  let points = [];
  let layers = [];
  let editing = null;
  let handler = null;

  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3fd8c7';
  function redraw() {
    layers.forEach((l) => map.removeLayer(l));
    layers = [];
    const c = accent();
    points.forEach((p, i) => {
      layers.push(L.circleMarker(p, { radius: 5, color: c, weight: 1.5, fillColor: c, fillOpacity: 0.35, interactive: false }).addTo(map));
    });
    if (points.length >= 2) layers.push(L.polyline(points, { color: c, weight: 1.5, dashArray: '5 4', interactive: false }).addTo(map));
    count.textContent = `${points.length} titik — klik peta untuk menambah waypoint`;
  }
  function fill(s) {
    document.getElementById('editorTitle').textContent = s ? 'EDIT KAPAL' : 'TAMBAH KAPAL';
    document.getElementById('edName').value = s?.name || '';
    document.getElementById('edMmsi').value = s?.mmsi || '';
    document.getElementById('edMmsi').disabled = !!s;
    document.getElementById('edType').value = s?.type || 'cargo';
    document.getElementById('edSpeed').value = s?.speedKn ?? 12;
    document.getElementById('edDwell').value = s?.dwellSeconds ?? 20;
    document.getElementById('edDest').value = s?.destination || '';
    document.getElementById('edImo').value = s?.imo || '';
    document.getElementById('edCall').value = s?.callSign || '';
    document.getElementById('edFlag').value = s?.flag || '';
    document.getElementById('edLen').value = s?.lengthM ?? '';
    document.getElementById('edBeam').value = s?.beamM ?? '';
  }
  function open(ship) {
    editing = ship || null;
    points = ship?.route ? ship.route.map((p) => [p[0], p[1]]) : [];
    fill(ship);
    err.hidden = true;
    dlg.showModal();
    handler = (e) => { points.push([Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]); redraw(); };
    map.on('click', handler);
    redraw();
  }
  function close() {
    if (handler) map.off('click', handler);
    handler = null;
    layers.forEach((l) => map.removeLayer(l));
    layers = [];
    dlg.close();
  }
  document.getElementById('editorClose').addEventListener('click', close);
  document.getElementById('edUndo').addEventListener('click', () => { points.pop(); redraw(); });
  document.getElementById('edClear').addEventListener('click', () => { points = []; redraw(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const num = (id) => { const v = document.getElementById(id).value; return v === '' ? undefined : Number(v); };
    const payload = {
      name: document.getElementById('edName').value,
      mmsi: document.getElementById('edMmsi').value,
      type: document.getElementById('edType').value,
      speedKn: num('edSpeed'),
      dwellSeconds: num('edDwell'),
      destination: document.getElementById('edDest').value || undefined,
      imo: document.getElementById('edImo').value || undefined,
      callSign: document.getElementById('edCall').value || undefined,
      flag: document.getElementById('edFlag').value || undefined,
      lengthM: num('edLen'),
      beamM: num('edBeam'),
      route: points,
    };
    const r = await fetch(editing ? `/api/ships/${editing.mmsi}` : '/api/ships', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) { err.textContent = j?.message || 'Gagal menyimpan kapal'; err.hidden = false; return; }
    close();
    onSaved(j.data);
  });
  return { open, close };
}
```

- [ ] **Step 4: socket.js + main.js wiring**

socket.js: tambah `socket.on('fleet:update', (ships) => onUpdate(ships));` di sebelah listener `ships:update`.

main.js:

```js
const auth = createAuth({
  onChange: (u) => {
    document.getElementById('authUser').hidden = !u;
    document.getElementById('authUser').textContent = u ? `${u.username} · ${u.role}` : '';
    document.getElementById('authBtn').hidden = !!u;
    document.getElementById('logoutBtn').hidden = !u;
    document.getElementById('addShipBtn').hidden = !u;
    if (detail.isOpen()) detail.rerender();
  },
});
auth.refresh();
document.getElementById('authBtn').addEventListener('click', () => auth.open('login'));
document.getElementById('logoutBtn').addEventListener('click', () => auth.logout());
const editor = createEditor(map, { onSaved: () => toast('Kapal disimpan — live di peta') });
document.getElementById('addShipBtn').addEventListener('click', () => editor.open(null));
// auth.refresh() DIPANGGIL PALING AKHIR wiring (setelah detail & editor ada),
// karena onChange menyentuh detail.isOpen().
auth.refresh();
```

- [ ] **Step 5: CSS modal/form**

```css
.modal { background: var(--panel); color: var(--text); border: 1px solid var(--border-hi); border-radius: 3px; padding: var(--sp-4); width: min(360px, calc(100vw - 32px)); }
.modal.wide { width: min(560px, calc(100vw - 32px)); }
.modal::backdrop { background: rgba(0, 0, 0, 0.55); }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-3); }
.modal-title { font: 600 13px/1.3 var(--font-sans); letter-spacing: 0.06em; }
.modal-tabs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-3); }
.field { display: flex; flex-direction: column; gap: var(--sp-1); margin-bottom: var(--sp-3); font: 500 11px/1.4 var(--font-sans); color: var(--dim); }
.field input, .field select { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); font: 500 12px/1.4 var(--font-sans); padding: var(--sp-2); border-radius: 3px; }
.field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--sp-3); }
.form-err { color: var(--tanker); font: 500 11px/1.4 var(--font-sans); margin: 0 0 var(--sp-2); }
.btn.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); font-weight: 600; }
.btn.primary:hover { border-color: var(--border-hi); }
.route-tools { display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-3); flex-wrap: wrap; }
.auth-user { font: 500 11px/1.4 var(--font-mono); color: var(--dim); }
@media (max-width: 480px) { .form-grid { grid-template-columns: 1fr; } #authBtn, #logoutBtn { padding: var(--sp-1) var(--sp-2); } }
```

- [ ] **Step 6: Verifikasi CDP end-to-end**

Register → topbar username; tambah kapal via klik peta 2 titik → simpan → baris+marker muncul live; edit rute → posisi reset; search kapal baru; hapus dua langkah → hilang dari peta & sidebar; logout → tombol mutasi hilang. `npm test` PASS.

- [ ] **Step 7: Commit**

```bash
git add public/js/auth.js public/js/editor.js public/js/socket.js public/js/main.js public/index.html public/css/console.css
git commit -m "feat(ui): modal auth, editor kapal klik-peta, socket fleet:update"
```

---

### Task 10: Verifikasi penuh + screenshot + README + detector

**Files:**
- Modify: `README.md` (fitur baru + palet + auth)
- Create: `docs/screenshots/v21-*.png`
- Modify: file CSS/HTML bila detector menemukan temuan

**Interfaces:**
- Consumes: semua task sebelumnya
- Produces: bukti kerja (screenshot 7), README terupdate, detector bersih, commit akhir.

- [ ] **Step 1: npm test penuh**

Run: `npm test`
Expected: PASS semua suite (existing 10 + baru ±24).

- [ ] **Step 2: CDP flow lengkap real-time**

Headless Chrome port 9228 profile tmp baru: register/login, tambah kapal fixture via klik peta, verifikasi bergerak (dua snapshot posisi berbeda), search keyboard, favorites reload persist, drawer ETA, 4 palet screenshot, editor screenshot, mobile 390px topbar fit, hapus fixture, logout. Simpan `v21-sonar.png`, `v21-phosphor.png`, `v21-amber.png`, `v21-chart.png`, `v21-drawer.png`, `v21-editor.png`, `v21-mobile.png`.

- [ ] **Step 3: Detector impeccable**

Run: `"C:/Users/Advan/.agents/skills/impeccable/scripts/impeccable.cmd" detect --json public/index.html public/css/console.css`
Expected: tanpa warning functional-text/contrast; advisory em-dash hanya placeholder `--` (bukan em-dash).

- [ ] **Step 4: README update**

Tambah bullet: search keyboard, drawer detail+voyage ETA, favorites/follow lokal, auth operator/admin + CRUD kapal klik-peta, palette switcher 4 palet; sebut `npm run seed` mengisi routes+particulars dan admin env opsional; ganti referensi screenshot lama dengan v21-*.

- [ ] **Step 5: Commit akhir**

```bash
git add README.md docs/screenshots public
git commit -m "docs+test: verifikasi v2.1, screenshot 4 palet, README fitur baru"
```

- [ ] **Step 6: Review independen**

Dispatch subagent reviewer (cavecrew-reviewer atau general-purpose) untuk diff `main..feat/fleet-auth-ui`; perbaiki temuan severity tinggi sebelum handoff. Push & merge = user.