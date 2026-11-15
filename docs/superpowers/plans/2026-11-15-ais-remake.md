# AIS Remake "VTS Console" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remake dashboard AIS: sumber data tunggal, fisika benar, riwayat+playback hidup, UI konsol VTS flat anti-AI-slop.

**Architecture:** Express + Socket.io tetap; data statis kapal dari PostgreSQL (fallback `data/fleet.js`), simulator hanya dinamika; satu fungsi merge dipakai REST & socket. Frontend vanilla ES modules + CSS tokens, tanpa Tailwind/build step.

**Tech Stack:** Node 18+, Express 4, Socket.io 4, pg 8, Mongoose, Leaflet 1.9.4, IBM Plex Sans/Mono, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-15-ais-remake-design.md`

## Global Constraints

- Tanpa dependensi npm baru; tanpa build step. Tailwind CDN dibuang.
- Palet: bg `#0d1117`, panel `#161b22`, border `#262d37`, teks `#e2e8f0`/`#8b96a3`, aksen `#ff7a29`; ferry `#5cb8e8`, cargo `#e8a33d`, tanker `#e05d5d`, tug `#4fc47f`.
- Font: IBM Plex Sans (UI), IBM Plex Mono (semua angka). Sudut 2–4px, tanpa blur/glass, tanpa emoji di UI.
- Semua string dari server di-escape sebelum masuk DOM. ID SVG unik per MMSI.
- Error HTTP: pesan generik ke client, detail di log server.
- Kerja di branch `remake/v2`. **User memegang commit/push** — step "Commit" diganti checkpoint verifikasi; jangan commit otomatis.
- Folder kerja: `D:\Coding\FOLDER CODING\BELAJAR AIS`.

---

### Task 1: Branch + sumber data tunggal `data/fleet.js`

**Files:**
- Create: `data/fleet.js`, `test/fleet.test.js`
- Modify: `package.json` (script test, description)

**Interfaces:**
- Produces: `FLEET` (array `{mmsi,name,type,speedKn,route:[[lat,lon]...],dwellSeconds}`), `PORTS` (array `{name,lat,lon}`), `isValidMmsi(s)→boolean`, `getFleetShip(mmsi)→object|undefined`.

- [ ] **Step 1: Buat branch** — `git checkout -b remake/v2`
- [ ] **Step 2: Tulis test gagal** `test/fleet.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { FLEET, PORTS, isValidMmsi, getFleetShip } = require('../data/fleet');

test('FLEET berisi 10 kapal unik, MMSI 9 digit', () => {
  assert.equal(FLEET.length, 10);
  const seen = new Set(FLEET.map(s => s.mmsi));
  assert.equal(seen.size, 10);
  for (const s of FLEET) {
    assert.ok(isValidMmsi(s.mmsi));
    assert.ok(s.route.length >= 2);
    assert.ok(s.speedKn > 0);
  }
});
test('isValidMmsi menolak non-9-digit', () => {
  assert.equal(isValidMmsi('525001001'), true);
  assert.equal(isValidMmsi('12345'), false);
  assert.equal(isValidMmsi('52500100a'), false);
  assert.equal(isValidMmsi(undefined), false);
});
test('getFleetShip menemukan kapal & PORTS berisi 3 pelabuhan', () => {
  assert.equal(getFleetShip('525001001').name, 'KM Dharma Kencana VII');
  assert.equal(getFleetShip('000000000'), undefined);
  assert.equal(PORTS.length, 3);
});
```

- [ ] **Step 3: Jalankan, pastikan gagal** — `node --test test/fleet.test.js` → FAIL (module not found).
- [ ] **Step 4: Implementasi `data/fleet.js`** — pindahkan 10 kapal dari `simulator.js` lama + 3 pelabuhan dari `db/seed.js` lama ke sini. Format tiap kapal: `{ mmsi:'525001001', name:'KM Dharma Kencana VII', type:'ferry', speedKn:13.5, dwellSeconds:20, route:[[-7.1955,112.7395],...] }` (route & speed persis dari simulator lama; `dwellSeconds:20` untuk ferry & tug, `0` untuk cargo/tanker). Tambah:

```js
const isValidMmsi = (s) => typeof s === 'string' && /^\d{9}$/.test(s);
const getFleetShip = (mmsi) => FLEET.find((s) => s.mmsi === mmsi);
module.exports = { FLEET, PORTS, isValidMmsi, getFleetShip };
```

- [ ] **Step 5: package.json** — `"test": "node --test test/"`, description: `"Real-time AIS vessel tracking simulation — Selat Madura & Tanjung Perak (Express, Socket.io, PostgreSQL, MongoDB, Leaflet)"`.
- [ ] **Step 6: Jalankan test → PASS.** Checkpoint.

---

### Task 2: Simulator fisika benar + dwell

**Files:**
- Create: `test/simulator.test.js`
- Rewrite: `simulator.js`

**Interfaces:**
- Consumes: `FLEET` dari Task 1.
- Produces: `calculateBearing(lat1,lon1,lat2,lon2)→deg`, `distanceMeters(lat1,lon1,lat2,lon2)→m`, `destinationPoint(lat,lon,bearingDeg,distM)→[lat,lon]`, `initSimulator(fleet)`, `updateShips(dtSeconds, nowMs)`, `getShips()→[{mmsi,lat,lon,heading,speed,status}]` (`status:'underway'|'moored'`).

- [ ] **Step 1: Tulis test gagal** `test/simulator.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const sim = require('../simulator');
const { FLEET } = require('../data/fleet');

test('bearing: utara=0, timur=90', () => {
  assert.equal(sim.calculateBearing(-7.0, 112.0, -6.0, 112.0), 0);
  assert.equal(sim.calculateBearing(-7.0, 112.0, -7.0, 113.0), 90);
});
test('distanceMeters: 1 derajat lintang ≈ 111.19 km', () => {
  const d = sim.distanceMeters(-7.0, 112.0, -6.0, 112.0);
  assert.ok(Math.abs(d - 111195) < 200, `d=${d}`);
});
test('destinationPoint: maju 1000 m ke utara menambah lat', () => {
  const [lat, lon] = sim.destinationPoint(-7.0, 112.0, 0, 1000);
  assert.ok(lat > -7.0 && Math.abs(lon - 112.0) < 1e-9);
  assert.ok(Math.abs(sim.distanceMeters(-7.0, 112.0, lat, lon) - 1000) < 1);
});
test('updateShips: kapal bergerak ≈ speed×0.514444×dt meter', () => {
  sim.initSimulator(FLEET);
  const before = sim.getShips().find(s => s.mmsi === '525002001'); // cargo, dwell 0
  sim.updateShips(2, Date.now());
  const after = sim.getShips().find(s => s.mmsi === '525002001');
  const d = sim.distanceMeters(before.lat, before.lon, after.lat, after.lon);
  const expect = 14.8 * 0.514444 * 2;
  assert.ok(Math.abs(d - expect) < expect * 0.1, `d=${d} expect≈${expect}`);
});
test('ferry moored di ujung rute lalu balik arah', () => {
  const ferry = FLEET.find(s => s.type === 'ferry');
  sim.initSimulator([ferry]);
  // teleport dekat waypoint terakhir
  const st = sim._state()[0];
  const end = ferry.route[ferry.route.length - 1];
  st.lat = end[0]; st.lon = end[1]; st.targetIndex = ferry.route.length - 1; st.direction = 1;
  sim.updateShips(2, 1000);
  assert.equal(sim.getShips()[0].status, 'moored');
  sim.updateShips(2, 1000 + (ferry.dwellSeconds + 1) * 1000); // dwell selesai
  assert.equal(sim.getShips()[0].status, 'underway');
  assert.equal(st.direction, -1);
});
```

- [ ] **Step 2: Jalankan → FAIL.**
- [ ] **Step 3: Rewrite `simulator.js`** dengan rumus:

```js
const KNOTS_TO_MS = 0.514444;
const EARTH_R = 6371000;
const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;

function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}
function distanceMeters(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}
function destinationPoint(lat, lon, bearingDeg, distM) {
  const δ = distM / EARTH_R, θ = toRad(bearingDeg), φ1 = toRad(lat), λ1 = toRad(lon);
  const φ2 = Math.asin(Math.sin(φ1)*Math.cos(δ) + Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1), Math.cos(δ) - Math.sin(φ1)*Math.sin(φ2));
  return [toDeg(φ2), ((toDeg(λ2) + 540) % 360) - 180];
}
```

State per kapal: `{mmsi, lat, lon, heading, targetIndex, direction, dwellUntil, speedKn, jitter}` — `jitter` di-set sekali per kapal `0.95 + Math.random()*0.1` (stabil, bukan per-tick). `initSimulator(fleet)` membangun state dari route[0], heading ke route[1]. `updateShips(dtSeconds, nowMs)`: bila `nowMs < dwellUntil` → status moored, skip; else gerak `dist = speedKn*KNOTS_TO_MS*dt*jitter` menuju waypoint via `destinationPoint`; bila sisa jarak ≤ dist → snap ke waypoint, maju index; bila di ujung → `dwellUntil = nowMs + dwellSeconds*1000`, balik direction, targetIndex mundur 1; heading = bearing ke target baru. `getShips()` return `{mmsi, lat:+lat.toFixed(6), lon:+lon.toFixed(6), heading, speed: moored?0:+(speedKn*jitter).toFixed(1), status}`. Export tambahan `_state()` untuk test.

- [ ] **Step 4: Jalankan test → PASS** (semua test Task 1+2). Checkpoint.

---

### Task 3: Layer DB — index Mongo, TTL, seed dari fleet

**Files:**
- Modify: `models/Position.js`, `db/postgres.js`, `db/seed.js`

**Interfaces:**
- Consumes: `FLEET`, `PORTS` (Task 1).
- Produces: `pool`, `initTables()` (dipanggil HANYA oleh seed), model `Position` dengan compound index + TTL opsional.

- [ ] **Step 1: `models/Position.js`** — ganti index tunggal `mmsi`/`timestamp` dengan:

```js
positionSchema.index({ mmsi: 1, timestamp: -1 });
const ttlDays = Number(process.env.POSITION_TTL_DAYS || 30);
if (ttlDays > 0) positionSchema.index({ timestamp: 1 }, { expireAfterSeconds: ttlDays * 86400 });
```

- [ ] **Step 2: `db/seed.js`** — hapus array shipsSeed/portsSeed lokal; `const { FLEET, PORTS } = require('../data/fleet')`; insert dari sana (kolom sama: mmsi/name/type; name/lat/lon). Logika ON CONFLICT tetap.
- [ ] **Step 3: `db/postgres.js`** — tetap, tapi tambah `pool.on('error', ...)` log agar koneksi idle yang putus tidak crash proses.
- [ ] **Step 4: Verifikasi** — `node db/seed.js` dengan DB asli → output sukses; cek `\d ships` via query `SELECT count(*) FROM ships` = 10. Checkpoint.

---

### Task 4: Service merge + routes + server bootstrap

**Files:**
- Create: `services/fleet.js`, `routes/api.js`, `test/merge.test.js`
- Rewrite: `server.js`

**Interfaces:**
- Consumes: simulator (Task 2), pool/initTables (Task 3), FLEET/PORTS/isValidMmsi (Task 1), Position.
- Produces: `loadStaticFromPg(pool)`, `getMergedShips()→[{mmsi,name,type,lat,lon,heading,speed,status,route}]`, router API.

- [ ] **Step 1: Test gagal** `test/merge.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { mergeShips } = require('../services/fleet');
const dyn = [{ mmsi: '525001001', lat: -7.1, lon: 112.7, heading: 90, speed: 12, status: 'underway' }];
const staticMap = new Map([['525001001', { mmsi: '525001001', name: 'Nama PG', type: 'ferry', route: [[0,0],[1,1]] }]]);
test('merge: nama/tipe dari statis, posisi dari dinamis', () => {
  const [s] = mergeShips(dyn, staticMap);
  assert.equal(s.name, 'Nama PG');
  assert.equal(s.lat, -7.1);
  assert.deepEqual(s.route, [[0,0],[1,1]]);
});
test('merge: mmsi tak dikenal tetap lolos tanpa nama PG', () => {
  const [s] = mergeShips([{ mmsi: '999999999', lat: 0, lon: 0 }], staticMap);
  assert.equal(s.mmsi, '999999999');
});
```

- [ ] **Step 2: Jalankan → FAIL.**
- [ ] **Step 3: `services/fleet.js`**:

```js
const { FLEET } = require('../data/fleet');
let staticMap = new Map(FLEET.map(s => [s.mmsi, s]));
async function loadStaticFromPg(pool) {
  try {
    const { rows } = await pool.query('SELECT mmsi, name, type FROM ships');
    for (const r of rows) {
      const base = staticMap.get(r.mmsi) || {};
      staticMap.set(r.mmsi, { ...base, mmsi: r.mmsi, name: r.name, type: r.type });
    }
    return rows.length;
  } catch (err) { console.warn('⚠️ PostgreSQL tidak tersedia, pakai data fleet lokal:', err.message); return 0; }
}
function mergeShips(dynamics, map = staticMap) {
  return dynamics.map(d => { const s = map.get(d.mmsi) || {}; return { ...s, ...d, name: s.name, type: s.type }; });
}
const getStaticMap = () => staticMap;
module.exports = { loadStaticFromPg, mergeShips, getStaticMap };
```

- [ ] **Step 4: Jalankan test → PASS.**
- [ ] **Step 5: `routes/api.js`** — Router dengan:
  - `GET /ships` → `{status:'success', timestamp, count, data: getMergedShips()}` (getMergedShips = `mergeShips(sim.getShips())`, diekspor dari services/fleet).
  - `GET /ships/:mmsi/history` → validasi `isValidMmsi` (400 bila gagal); bila Mongo tidak connect → 503; parse `limit` (default 100, clamp 1–1000), `from`/`to` (ISO valid → filter timestamp `$gte/$lte`); `Position.find(query).sort({timestamp:1}).limit(limit)`; response `{status:'success', mmsi, count, data}`.
  - `GET /ports` → coba PG; catch → fallback `PORTS` dengan `id` index+1; response sama.
  - Semua catch: `console.error(err)` + `res.status(500).json({status:'error', message:'Terjadi kesalahan pada server'})`.
- [ ] **Step 6: Rewrite `server.js`** — bootstrap tipis:
  - dotenv; `if (process.env.USE_PUBLIC_DNS === 'true') { try { dns.setServers(['8.8.8.8','1.1.1.1']); } catch {} }`
  - connect Mongo bila URI ada (log warn bila gagal, app tetap jalan).
  - `await loadStaticFromPg(pool)` (tidak memanggil initTables).
  - static files; `app.use('/api', apiRouter)`; route 404 API JSON.
  - `sim.initSimulator(FLEET)`; interval 2000ms: hitung `dt = (now - lastTick)/1000` (clamp 0.1–10), `sim.updateShips(dt, now)`, bila `io.engine.clientsCount > 0` → `io.emit('ships:update', getMergedShips())`.
  - Interval 10000ms: bila Mongo connect → `Position.insertMany(records)` (mmsi/lat/lon/speed/heading/timestamp).
  - `io.on('connection')` → emit snapshot merged.
  - Graceful shutdown: `function shutdown(sig)` → clearInterval keduanya, `io.close()`, `server.close()`, `pool.end()`, `mongoose.disconnect()`, exit 0; daftar SIGINT/SIGTERM; timeout paksa 5 detik.
- [ ] **Step 7: Verifikasi** — `node server.js` dengan DB asli; `curl localhost:3000/api/ships` (nama dari PG), `curl "localhost:3000/api/ships/525001001/history?limit=5"` (setelah >10 detik), `curl localhost:3000/api/ships/abc/history` → 400. Ctrl+C → exit bersih. Checkpoint.

---

### Task 5: Frontend fondasi — HTML + CSS tokens + util/socket/map

**Files:**
- Rewrite: `public/index.html`, `public/style.css` → ganti `public/css/console.css`
- Create: `public/js/util.js`, `public/js/socket.js`, `public/js/map.js`
- Delete: `public/app.js` (digantikan modul di Task 6–8)

**Interfaces:**
- Produces: `util.escapeHtml/fmtCoord/fmtTime`, `socket.connectSocket({onUpdate,onStatus})`, `map.initMap()→{map, setDark, loadPorts}`, CSS classes di bawah.

- [ ] **Step 1: `public/css/console.css`** — tokens persis Global Constraints + komponen:
  - `*{box-sizing:border-box}` body font `--font-ui`, bg `--bg`, color `--text`, `height:100vh; overflow:hidden; display:flex; flex-direction:column`.
  - `.mono{font-family:var(--font-mono)}` — dipakai untuk SEMUA angka.
  - Header `.topbar`: tinggi 48px, panel bg, border-b 1px, flex; brand kiri (ikon radar SVG stroke `--accent`), judul 14px bold, subjudul 10px dim; kanan: `.stat` (label uppercase 9px letter-spacing .12em dim + value mono 13px), `.conn-badge` (LIVE hijau / OFFLINE merah, dot 6px).
  - Tombol `.btn`: bg `--panel-2`, border 1px `--border`, radius 3px, padding 4px 10px, font 11px; `.btn.active` border+teks `--accent`; hover border `#3a4350`. Tanpa transisi berlebihan (120ms).
  - Sidebar `.sidebar`: lebar 280px, panel bg, border-l; `.ship-row`: padding 8px 12px, border-b 1px `--border`, grid nama+tag; hover bg `#1c2230`; `.ship-row.selected` border-left 2px `--accent`; nama 12px, meta mono 10px dim; `.type-tag` uppercase 9px dengan warna tipe masing-masing (border 1px currentColor, bg transparan — flat, bukan pill glass).
  - Filter `.filter-grid`: 4 tombol 2×2, dot warna tipe 6px.
  - Panel riwayat `.history-panel`: absolute bawah, tinggi 148px, panel bg, border-t 1px; header (nama kapal mono + tombol tutup), track slider `input[type=range]` full-width accent `--accent`, kontrol play/pause + kecepatan `.btn`, label waktu mono.
  - Popup Leaflet di-override: bg `--panel`, border 1px `--border`, radius 3px, tanpa blur; judul 12px bold, baris label dim 10px + value mono 11px.
  - Peta gelap default: `.map-dark .leaflet-tile{filter:invert(1) hue-rotate(180deg) brightness(.82) contrast(.92) saturate(.55)}`; kontrol Leaflet (zoom/layers) di-style ulang flat panel.
  - `.toast`: fixed bawah-kiri, panel bg border 1px, mono 11px, auto-hide 4 detik.
  - Responsif ≤768px: sidebar jadi panel bawah tinggi 40%, history-panel di atasnya.
- [ ] **Step 2: `public/index.html`** — struktur: head (meta, IBM Plex Sans+Mono Google Fonts, leaflet CSS integrity sama seperti lama, `css/console.css`); body: `.topbar` (brand, stat KAPAL AKTIF `#totalShips`, stat UPDATE `#lastUpdated` mono, `#connBadge`, tombol tema `#toggleMapTheme`); `main` → `#map` + `.sidebar` (header "ARMADA AKTIF" + tombol collapse `#toggleSidebar`, `.filter-grid` 4 tombol `data-filter`, `#shipList` dengan `#loadingState`); `#openSidebarBtn`; `.history-panel#historyPanel` hidden (header `#historyTitle`, `#historyClose`, slider `#historySlider`, `#historyPlay`, `#historySpeed`, `#historyTime`); `#toast`; script leaflet (integrity lama), `/socket.io/socket.io.js`, `<script type="module" src="js/main.js">`. Tanpa emoji, tanpa Tailwind.
- [ ] **Step 3: `public/js/util.js`**:

```js
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmtCoord = (n) => Number(n).toFixed(4);
export const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour12: false });
export const TYPE_COLORS = { ferry:'#5cb8e8', cargo:'#e8a33d', tanker:'#e05d5d', tug:'#4fc47f' };
```

- [ ] **Step 4: `public/js/socket.js`** — `connectSocket({onUpdate,onStatus})`: `const socket = io();` on `ships:update` → onUpdate; on `disconnect` → onStatus(false); on `connect` → onStatus(true) (skip toast pertama). Return socket.
- [ ] **Step 5: `public/js/map.js`** — `initMap()`: center `[-7.185,112.738]` zoom 13, zoomControl topleft; layer OSM (default, Attribution sama) + Esri satelit; `L.control.layers` bottomleft; `setDark(on)` toggle class `map-dark` di `#map` (default ON); `loadPorts()` fetch `/api/ports`, marker pin SVG stroke `#5cb8e8`, popup escapeHtml + koordinat mono. Return `{map, setDark, loadPorts}`.
- [ ] **Step 6: Verifikasi** — buka `http://localhost:3000` (server Task 4 jalan): peta gelap tampil, header rapi, belum ada kapal (Task 6). Cek console bersih. Checkpoint.

---

### Task 6: Fleet frontend — marker, sidebar keyed, filter, popup, offline

**Files:**
- Create: `public/js/fleet.js`

**Interfaces:**
- Consumes: util, map (Task 5).
- Produces: `createFleet(map, {onSelect}) → {update(ships), applyFilters(), getSelected(), setSelected(mmsi)}`.

- [ ] **Step 1: Implementasi `fleet.js`**:
  - State: `markers = new Map()` mmsi → `{marker, trail, history:[], data, row}`; `activeFilters = new Set(['ferry','cargo','tanker','tug'])`; `selected = null`.
  - Ikon: fungsi `buildShipSVG(type, heading, mmsi)` — geometri siluet dari app.js lama (hull polygon, bridge rect, garis tengah) tapi `filter id="sh-${mmsi}"` unik, warna hull dari `TYPE_COLORS`, stroke `rgba(255,255,255,.35)`. Ukuran per tipe sama seperti lama (ferry 18×40, cargo 16×50, tanker 18×50, tug 20×28). `L.divIcon` anchor tengah.
  - `update(ships)`: per kapal — marker baru dibuat sekali (bindPopup, click → onSelect); update `setLatLng`, rotasi via `el.querySelector('svg').style.transform`, `obj.data = ship`; trail: satu `L.polyline` per kapal, `trail.setLatLngs(history)` (history FIFO max 6, push hanya bila kapal visible); popup di-update HANYA bila `marker.isPopupOpen()`. Visibility ikut filter (add/removeLayer).
  - Sidebar keyed: container `#shipList`; per kapal buat `.ship-row` sekali (innerHTML dengan escapeHtml), simpan referensi; update hanya teks yang berubah (speed, heading, status moored → tag "MOORED" dim); urutan stabil; baris kapal yang hilang di-remove. Event delegation: satu listener click di container → `onSelect(mmsi)`. Counter `#totalShips` = jumlah visible.
  - `applyFilters()`: toggle class active tombol, show/hide marker+trail+row, recompute dari data terakhir.
  - `setSelected(mmsi)`: class `.selected` di row, `map.panTo`, buka popup; dipanggil dari onSelect (main.js wiring ke history panel).
- [ ] **Step 2: Verifikasi manual** — reload browser: 10 kapal bergerak halus, rotasi benar, filter menyembunyikan marker+row, klik row → pan+popup, scroll sidebar stabil, tidak ada rebuild DOM tiap 2 detik (inspect). Checkpoint.

---

### Task 7: Riwayat + playback

**Files:**
- Create: `public/js/history.js`

**Interfaces:**
- Consumes: map, util, fleet.setSelected.
- Produces: `createHistory(map) → {open(mmsi, name), close(), isOpen()}`.

- [ ] **Step 1: Implementasi `history.js`**:
  - `open(mmsi,name)`: tampilkan `#historyPanel`, set judul (escapeHtml + mono MMSI), fetch `/api/ships/${mmsi}/history?limit=500`; bila kosong → pesan "Belum ada riwayat (tunggu ±10 detik)"; simpan `points` (ascending timestamp).
  - Gambar track: `L.polyline(latlngs, {color:'#ff7a29', weight:2, opacity:.8, dashArray:'6 4'})` + marker playback `L.circleMarker` radius 5 warna accent dengan outline putih; fitBounds track (padding 60).
  - Slider `#historySlider` min 0 max points.length-1; input → `seek(i)`: posisikan marker di points[i], label `#historyTime` = fmtTime(timestamp) mono.
  - Play: `requestAnimationFrame` loop; maju berdasarkan waktu nyata × faktor kecepatan (1×/4×/16×, tombol `#historySpeed` cycle); interpolasi posisi antar titik berdasar timestamp; selesai → berhenti di ujung, tombol kembali ke play.
  - `close()`: hapus layer track+marker, sembunyikan panel, batalkan rAF.
  - Saat playback aktif, marker live kapal itu tetap jalan (tidak dihapus) — playback marker beda warna jelas.
- [ ] **Step 2: Verifikasi manual** — tunggu server >30 detik agar ada data Mongo; klik kapal → panel muncul, track tergambar, slider menggerakkan marker, play memutar ulang, kecepatan berubah, tutup bersih. Checkpoint.

---

### Task 8: Wiring main.js + offline + dokumentasi + screenshot

**Files:**
- Create: `public/js/main.js`, `LICENSE`, `docs/screenshots/*.png`
- Rewrite: `README.md`, `.env.example`
- Modify: `public/index.html` (bila perlu penyesuaian id)

- [ ] **Step 1: `main.js`** — init: `const {map,setDark,loadPorts} = initMap(); loadPorts();` fleet = createFleet(map, {onSelect: mmsi => {fleet.setSelected(mmsi); history.open(mmsi, name)}}); history = createHistory(map); connectSocket({onUpdate: ships => {fleet.update(ships); updateHeader(ships); hideLoading();}, onStatus: ok => setConnBadge(ok) + toast}); wiring tombol filter (fleet.applyFilters), toggle sidebar (class collapsed + tombol buka), tema peta (setDark + label), escape menutup history. `updateHeader`: total visible + `#lastUpdated` fmtTime.
- [ ] **Step 2: `.env.example`**:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/belajar-ais
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/ais_monitor
# Opsional:
POSITION_TTL_DAYS=30
USE_PUBLIC_DNS=false
```

- [ ] **Step 3: `LICENSE`** — ISC standar, copyright 2026 rafifandriyanto.
- [ ] **Step 4: README baru** — judul + 1 kalimat deskripsi; screenshot `![Dashboard](docs/screenshots/dashboard.png)` di atas; badge stack teks; fitur (live tracking, riwayat+playback, filter, offline indicator); arsitektur ASCII (Browser ⇄ Socket.io/Express ⇄ PG statis + Mongo riwayat + Simulator); cara jalan (prasyarat, npm install, cp .env, node db/seed.js, npm run dev); tabel API termasuk param history; struktur folder baru; catatan simulasi (bukan data AIS asli); lisensi.
- [ ] **Step 5: Test penuh** — `npm test` → semua PASS; `node server.js` jalan.
- [ ] **Step 6: Screenshot** — via browser tool: (1) dashboard utama dengan kapal bergerak, (2) popup kapal + sidebar, (3) panel riwayat/playback aktif, (4) filter aktif. Simpan ke `docs/screenshots/`.
- [ ] **Step 7: Verifikasi akhir** — cek semua item spec; tunjukkan app jalan ke user; serahkan daftar perubahan + cara commit. Checkpoint final.

---

## Self-review catatan

- Spec coverage: semua poin spec terpetakan ke Task 1–8 (design system → Task 5; sumber tunggal → 1,4; fisika → 2; Mongo → 3; API → 4; robustness → 4; frontend fitur → 6,7,8; test → 1,2,4; docs → 8).
- Tipe konsisten: `getShips()` dynamics `{mmsi,lat,lon,heading,speed,status}`; merged menambah `name,type,route` — dipakai konsisten di routes & frontend.
- Deviasi dari skill: step commit diganti checkpoint karena user memegang commit (instruksi user menang).