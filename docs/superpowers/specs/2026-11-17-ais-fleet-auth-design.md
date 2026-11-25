# AIS v2.1 — Fleet Intelligence + Auth + Palette System (Design Spec)

**Tanggal:** 2026-11-17
**Branch:** `feat/fleet-auth-ui` (commit oleh agent; push & merge ke main oleh user)
**Status:** disetujui user via brainstorming (scope: semua fitur + ganti palet + switcher palet)

## 1. Goal & Scope

Menambahkan fitur yang belum ada di konsol VTS remake v2, sekaligus mengganti palet
visual dan menyediakan switcher palet live. Empat fitur + sistem palet:

1. **Search** nama / MMSI di sidebar (keyboard navigable).
2. **Detail kapal + voyage** (drawer: particulars, destination, ETA, sisa jarak).
3. **Favorites + follow** (localStorage, filter chip, auto pan-to).
4. **Auth + CRUD kapal** (register/login, operator tambah/edit/hapus kapal sendiri,
   rute digambar dengan klik peta, kapal baru langsung live tanpa restart).
5. **Palette system** (4 palet flat, default sonar teal, switcher di topbar, persist).

Di luar scope ronde ini: geofence alerts, port calls, heatmap, PWA, dokumentasi API
publik. Tidak ada dependensi npm baru, tidak ada build step.

## 2. Palette System

Token CSS di `:root` (default sonar) dan override per `html[data-palette="…"]`.
Warna tipe kapal KONSTAN antar palet (semantik tipe tidak berubah):
ferry `#6fb7e8`, cargo `#e8b04b`, tanker `#e0655d`, tug `#7fd08a`.

| Token | sonar (default) | phosphor | amber | chart (light) |
|---|---|---|---|---|
| `--bg` | `#0b1418` | `#0a0f0b` | `#0e141d` | `#f2efe6` |
| `--panel` | `#101c22` | `#101710` | `#141c28` | `#faf8f1` |
| `--panel-2` | `#16242c` | `#162116` | `#1a2432` | `#ece8dc` |
| `--border` | `#24343b` | `#243024` | `#263243` | `#d8d2c0` |
| `--border-hi` | `#3a4f57` | `#3a4a3a` | `#3c4c60` | `#b9b19a` |
| `--text` | `#e6edf0` | `#e4efe4` | `#e8ecf2` | `#16232e` |
| `--dim` | `#93a6ad` | `#9db39d` | `#9aa8ba` | `#4c5a66` |
| `--faint` | `#7f939b` | `#869986` | `#8492a4` | `#5d6b77` |
| `--accent` | `#3fd8c7` | `#52d869` | `#ffb454` | `#c8402f` |
| `--accent-ink` | `#062a26` | `#06210c` | `#2b1602` | `#fff6f2` |
| peta default | gelap | gelap | gelap | terang |

Aturan: semua teks fungsional ≥ 11px dan kontras ≥ 4.5:1 terhadap panelnya
(`--faint` adalah batas bawah; diverifikasi per palet). Radius tetap 3px.
Spacing memakai skala 4px (`--sp-1: 4px` … `--sp-6: 32px`); seluruh CSS diaudit
memakai token ini, bukan px acak. Font tetap IBM Plex Sans + IBM Plex Mono
(tidak termasuk daftar font yang dilarang user).

**Switcher:** tombol icon di topbar (aria-label + title menyebut palet aktif),
klik = siklus sonar → phosphor → amber → chart. Persist `localStorage['ais.palette']`.
Saat palet berubah, tema peta ikut default palet (label topbar diperbarui);
toggle tema peta manual tetap bekerja sesudahnya. Toast menyebut nama palet.
Di viewport < 480px tombol palet dan auth menjadi icon-only (nama via
aria-label/title) agar topbar tetap muat 390px.

## 3. Audit Anti-Slop (checklist penerimaan dari user)

| # | Larangan | Status / aksi |
|---|---|---|
| 1 | Purple-to-blue gradient | tidak ada; palet baru bebas ungu; filter peta gelap dicek tidak cast ungu |
| 2 | Gradient hero text | tidak ada teks gradient |
| 3 | Emojis di headings | tidak ada |
| 4 | Inter font everywhere | IBM Plex, bukan Inter. Catatan 2026-11-25: `2026-11-25-font-typography-design.md` mengoverride families jadi Fira Sans + Fira Code; Inter tetap dilarang |
| 5 | Colored border cards | border netral `--border`; warna hanya pada dot/tag teks, bukan border kartu |
| 6 | Glassmorphism cards | panel opaque, tanpa blur/transparansi kartu |
| 7 | Low-contrast dark mode | kontras ≥ 4.5:1 diverifikasi per palet |
| 8 | 3 icon boxes in a row | tidak ada; filter grid = 4 tombol filter fungsional ber-dot, bukan kotak ikon dekoratif |
| 9 | Badge above headline | tidak ada pola marketing |
| 10 | Lucide icons everywhere | SVG inline custom konsol |
| 11 | Untouched shadcn UI | tidak memakai shadcn |
| 12 | Fade-in on scroll | tidak ada; entrance stagger baris saat load dipertahankan (bukan scroll) |
| 13 | Cursor-following beam | tidak ada |
| 14 | Buttons fade on hover | hover = perubahan border/warna instan, bukan opacity fade |
| 15 | Inconsistent spacing | skala 4px token, audit seluruh CSS |
| 16 | Em dashes everywhere | ganti em-dash prose & readout gap menjadi `--`; copy diaudit |
| 17 | Generic buzzword copy | copy fungsional Bahasa Indonesia, label operasional konkret |
| 18 | Serif italic accents | tidak ada serif |
| 19 | Space Grotesk + Instrument Serif | tidak dipakai |
| 20 | Grain over a gradient | tidak ada grain/gradient |

## 4. Data & Schema (PostgreSQL)

`db/postgres.js initTables()` menambah (idempotent, hanya dipanggil seed):

```sql
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(24) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(10) NOT NULL DEFAULT 'operator'
                CHECK (role IN ('admin','operator')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,           -- sha256 hex dari token cookie
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE ships ADD COLUMN IF NOT EXISTS imo         VARCHAR(12);
ALTER TABLE ships ADD COLUMN IF NOT EXISTS call_sign   VARCHAR(12);
ALTER TABLE ships ADD COLUMN IF NOT EXISTS flag        VARCHAR(40);
ALTER TABLE ships ADD COLUMN IF NOT EXISTS length_m    NUMERIC(6,1);
ALTER TABLE ships ADD COLUMN IF NOT EXISTS beam_m      NUMERIC(5,1);
ALTER TABLE ships ADD COLUMN IF NOT EXISTS destination VARCHAR(60);
ALTER TABLE ships ADD COLUMN IF NOT EXISTS owner_id    INT REFERENCES users(id);
CREATE TABLE IF NOT EXISTS routes (
  mmsi        VARCHAR(20) PRIMARY KEY REFERENCES ships(mmsi) ON DELETE CASCADE,
  waypoints   JSONB NOT NULL,            -- [[lat,lon],...] min 2 titik
  speed_kn    NUMERIC(4,1) NOT NULL DEFAULT 12,
  dwell_s     INT NOT NULL DEFAULT 60
);
```

`data/fleet.js` tetap satu sumber seed: tiap kapal ditambah particulars
(imo, callSign, flag, lengthM, beamM, destination). `db/seed.js` mengisi
ships + routes + particulars (ON CONFLICT DO NOTHING / DO UPDATE untuk routes),
dan membuat admin dari `ADMIN_USERNAME` / `ADMIN_PASSWORD` bila disetel di `.env`
(nilai tidak pernah dicetak). Bila tidak disetel, pendaftar pertama menjadi admin
(didokumentasikan di README). Seed tidak menghapus data apa pun.

MongoDB: tidak ada perubahan schema. DELETE kapal hanya menghapus baris PG
(ships + routes cascade); riwayat Mongo dibiarkan (TTL membersihkan sendiri) —
tidak ada operasi delete Mongo oleh fitur ini.

## 5. Auth (hand-rolled, tanpa deps baru)

`services/auth.js`:
- Hash: `crypto.scryptSync(password, salt16, 64, {N:16384,r:8,p:1})`, format
  `scrypt$16384$8$1$saltHex$hashHex`; verify dengan `timingSafeEqual`.
- Sesi: token `crypto.randomBytes(32).hex`; cookie `ais_sid` (HttpOnly,
  SameSite=Lax, Path=/, Max-Age 7 hari); tabel sessions menyimpan sha256(token).
  Verify = lookup + cek expires_at; baris kedaluwarsa dibersihkan lazy saat login.
- Rate limit login+register: Map in-memory per IP, 5 percobaan / 60 detik → 429.
- Role: `admin` (seed env atau pendaftar pertama) dan `operator` (pendaftar lain).
- Ownership: `canEditShip(user, ship)` = admin → true; operator →
  `ship.owner_id === user.id`; kapal seed (owner_id NULL) hanya admin.
- Mutasi API menolak Origin yang tidak cocok dengan Host (CSRF); Origin absen
  (client non-browser) diizinkan. SameSite=Lax sudah memblokir POST cross-site.

`routes/auth.js`: POST `/api/auth/register`, POST `/api/auth/login`,
POST `/api/auth/logout`, GET `/api/auth/me` (200 `{data:{id,username,role}}`,
401 bila tanpa sesi).
Validasi: username 3–24 char `[a-z0-9._-]` (lowercase), password ≥ 8 char.
Error: 400 validasi, 401 kredensial salah / sesi tidak ada, 409 username dipakai,
429 rate limit, 503 bila PG mati. Respons sukses tidak pernah memuat hash/password.

## 6. API Kapal & Voyage

- GET `/api/ships` — tetap (list live + statis), kini termasuk particulars ringkas
  dan `owner_id` supaya frontend bisa menampilkan aksi edit/hapus bersyarat.
- GET `/api/ships/:mmsi` — detail: statis + particulars + route +
  `voyage { destination, remainingM, etaIso, speedKn }`; 404 bila tidak dikenal.
- POST `/api/ships` (operator/admin) — body `{mmsi,name,type,speedKn,dwellSeconds?,
  destination?,imo?,callSign?,flag?,lengthM?,beamM?,route}` → 201 + socket
  `fleet:update`. 400 validasi, 409 MMSI sudah ada, 401/403 auth.
- PUT `/api/ships/:mmsi` (owner/admin) — subset field yang sama → 200 +
  `fleet:update`; 403 bila bukan pemilik; 404 bila tidak ada.
- DELETE `/api/ships/:mmsi` (owner/admin) → 200 `{deleted:true}` + `fleet:update`;
  hanya PG (lihat §4).

Validasi kapal: MMSI 9 digit (`isValidMmsi`), nama 1–100 char, type ∈
{ferry,cargo,tanker,tug}, speedKn 1–30, route ≥ 2 titik dan semua titik dalam
bbox area operasi (lat −7.35…−7.05, lon 112.55…112.85) → 400 dengan pesan field.

`services/voyage.js` (pure, teruji): `computeVoyage(dyn, route, nowMs)` —
sisa jarak = jarak posisi→target saat ini + jumlah segmen waypoint berikutnya
searah `direction` sampai ujung rute; ETA = now + sisa/(speedKn·0.514444);
bila moored, waktu sandar sisa ditambahkan dulu. Destination = teks statis kapal.

## 7. Simulator Dinamis

`simulator.js` menambah:
- `upsertShip(def)` — def `{mmsi,route,speedKn,dwellSeconds}`; bila mmsi sudah ada,
  ganti route/kecepatan dan reset posisi ke route[0] hanya bila route berubah;
  bila baru, push state baru (posisi route[0], heading ke route[1]).
- `removeShip(mmsi)` — splice state.
- `initSimulator(fleet)` tetap untuk start/fallback.

`services/fleet.js`: `loadStaticFromPg` kini SELECT ships + routes (JOIN),
mengisi staticMap termasuk route/particulars/owner; server start memanggil
`sim.initSimulator` dari hasil PG bila ada, else FLEET lokal. Setelah CRUD,
route handler memanggil `sim.upsertShip/removeShip` lalu
`io.emit('fleet:update', getMergedShips())`. Frontend `fleet.update()` sudah
menangani penambahan & penghilangan baris/marker keyed — dipakai apa adanya.

## 8. Frontend

Semua komponen baru memakai token palet (§2) dan pola existing (keyed rows,
delegation, escapeHtml, aria, focus-visible, reduced-motion).

- **Search** (`public/js/fleet.js` + input di sidebar head bawah): debounce 120ms,
  matcher pure `matchShip(ship,q)` di `util.js` (nama substring case-insensitive
  ATAU mmsi substring). ArrowUp/Down memindah highlight `.kbd-active` antar baris
  terlihat, Enter memilih, Escape mengosongkan. Count aria-live polite.
- **Detail drawer** (`public/js/detail.js`): panel kanan lebar 320px (mobile:
  min(320px,100%)), opaque `--panel`, border kiri `--border`. Isi: nama+tipe,
  particulars (MMSI/IMO/call sign/flag/dimensi), voyage (destination, ETA lokal,
  sisa jarak nm), aksi: Favorit (star), Follow, Riwayat, Edit/Hapus (bila
  canEdit). Esc menutup; fokus ke tombol close saat buka, kembali saat tutup.
  Data dari GET `/api/ships/:mmsi`, refresh voyage tiap `ships:update` bila terbuka.
- **Favorites + follow** (`public/js/favorites.js`): `localStorage['ais.favs']`
  array mmsi; star di baris (stopPropagation) + drawer; chip filter "Favorit"
  (AND dengan filter tipe); follow satu kapal (`localStorage['ais.follow']`),
  auto pan-to saat update HANYA bila panel riwayat tertutup; toggle di drawer.
- **Auth UI** (`public/js/auth.js`): tombol topbar "MASUK" → modal `<dialog>`
  dua tab (Masuk / Daftar), error inline per field, sukses menutup modal dan
  topbar menampilkan username + tombol KELUAR + tombol "TAMBAH KAPAL" (operator+).
  State sesi dari GET `/api/auth/me` saat load.
- **Ship editor** (`public/js/editor.js`): `<dialog>` form (nama, mmsi, tipe,
  speedKn, destination, particulars opsional) + mode gambar rute: klik peta
  menambah waypoint (marker bernomor + polyline dashed aksen), tombol Undo /
  Clear, minimal 2 titik; Simpan → POST/PUT; Batal membersihkan layer sementara.
  Edit kapal existing memprefill form + route. Hapus = tombol dua langkah
  ("HAPUS" → "YAKIN? KLIK LAGI"), tanpa confirm() native.
- **Palette switcher** (`public/js/main.js` + CSS): sesuai §2.
- **Socket** (`public/js/socket.js`): subscribe `fleet:update` → callback update
  yang sama dengan `ships:update`.

## 9. Error Handling & Keamanan (ringkas)

400 validasi field-specific · 401 belum login/sesi habis · 403 bukan pemilik ·
404 kapal tidak ada · 409 MMSI/username duplikat · 429 rate limit ·
503 PG/Mongo mati (peta tetap live read-only dari fallback) ·
500 generik tanpa bocoran stack. Cookie tidak pernah berisi data user selain
token acak. Password tidak pernah masuk log/respons. `escapeHtml` untuk semua
data user yang dirender (nama kapal, username, destination).

## 10. Testing & Verifikasi

Unit `node:test` baru (tanpa deps): `test/auth.test.js` (hash/verify roundtrip,
password salah, expiry sesi, rate limiter), `test/voyage.test.js` (underway,
moored, arah balik), `test/ownership.test.js` (admin/operator/seed NULL),
`test/search.test.js` (matcher, import ESM util), `test/simulator-crud.test.js`
(upsert baru, upsert route berubah, remove). 10 test existing tetap hijau.

Verifikasi browser headless Chrome + CDP (real-time, bukan virtual-time):
register → login → tambah kapal via klik peta → kapal bergerak live di sidebar
& peta → edit rute → search keyboard → favorites persist setelah reload →
drawer ETA terisi → ganti 4 palet (screenshot masing-masing) → hapus kapal
fixture test (data buatan sesi verifikasi, bukan data user) → logout.
Screenshot baru: `docs/screenshots/v21-{sonar,phosphor,amber,chart,drawer,editor,mobile}.png`.
Detector impeccable dijalankan pada file CSS/HTML yang berubah; temuan
functional-text/contrast diperbaiki sebelum delivery.

## 11. Constraints (verbatim guardrails)

- Tidak ada dependensi npm baru; tidak ada build step.
- Branch `feat/fleet-auth-ui`; agent commit per fase; push & merge ke main = user.
- Nilai `.env` / `atlas-credentials.env` tidak pernah dicetak.
- Penghapusan data Mongo lama / purge = perintah untuk user, bukan agent.
- Menyalakan service DB = user; server dev (`npm run dev`) sudah jalan oleh agent.
- Teks fungsional ≥ 11px; kontras ≥ 4.5:1; reduced-motion dihormati.