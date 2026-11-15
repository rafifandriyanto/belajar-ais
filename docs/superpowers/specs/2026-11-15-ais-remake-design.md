# Spec: Remake Dashboard AIS — "VTS Console" (v2)

Tanggal: 2026-11-15 · Status: disetujui user di chat ("gasss") · Branch: `remake/v2`

## Tujuan

Remake `belajar-ais` sesuai hasil review: perbaiki masalah fungsional/performa/keamanan,
hidupkan fitur riwayat MongoDB yang mati, dan ganti UI "AI slop" (navy glassmorphism cyan)
dengan estetika **konsol VTS maritim gelap yang flat dan disiplin**.

Stack tetap: Node.js + Express + Socket.io + PostgreSQL (`pg`) + MongoDB (Mongoose) +
Leaflet + vanilla JS (ES modules). **Tanpa dependensi baru, tanpa build step.**
Tailwind Play CDN dibuang → CSS tulisan tangan dengan design tokens.

## Design system

- Palet flat: bg `#0d1117`, panel `#161b22`, border 1px `#262d37`, teks `#e2e8f0` / `#8b96a3`.
- Aksen UI tunggal: oranye sinyal `#ff7a29` (state aktif, tombol utama) — dipakai hemat.
- Warna tipe kapal (muted): ferry `#5cb8e8`, cargo `#e8a33d`, tanker `#e05d5d`, tug `#4fc47f`.
  Konsisten di marker, trail, sidebar, legend, panel riwayat.
- Font: IBM Plex Sans (UI) + IBM Plex Mono (semua angka: MMSI, koordinat, speed, heading, jam).
- Sudut 2–4px, tanpa glassmorphism/blur, tanpa emoji di UI, ikon SVG garis tipis,
  label mikro uppercase letter-spaced.
- Peta: OSM standar di-darken via CSS filter (tanpa API key); opsi satelit Esri tetap ada.
  Marker SVG siluet kapal yang lama dipertahankan, diperbaiki ID-nya, warna ikut palet.
- Layout: header tipis padat data; sidebar kanan = daftar instrumen (baris padat);
  panel bawah untuk riwayat/playback saat kapal dipilih.

## Backend

1. **Satu sumber data statis**: `data/fleet.js` berisi 10 kapal (mmsi, name, type, speed,
   route, dwell) + 3 pelabuhan. Dipakai oleh `db/seed.js` DAN simulator (fallback bila PG mati).
   Server load nama/tipe dari PG saat start (`services/fleet.js`); simulator hanya dinamika.
2. **Payload konsisten**: satu fungsi merge (statis PG + dinamika simulator) dipakai oleh
   broadcast Socket.io `ships:update` dan `GET /api/ships`.
3. **Fisika simulator**: knot → m/detik (×0.514444), gerak berbasis delta-time,
   koreksi cos(lat) untuk bujur, heading dari bearing. Ferry/tug dwell ±20 detik di
   waypoint ujung (terminal) sebelum balik arah. Kecepatan diberi jitter kecil (±5%).
4. **MongoDB**: compound index `{mmsi:1, timestamp:-1}`; TTL index 30 hari
   (`POSITION_TTL_DAYS` di .env, 0 = nonaktif). Simpan tiap 10 detik tetap.
5. **API**: `GET /api/ships/:mmsi/history` validasi MMSI 9 digit, param `limit`
   (default 100, maks 1000), `from`/`to` (ISO). Urut naik untuk playback.
   `GET /api/ports` tetap. Error response generik (detail hanya di log server).
6. **Robustness**: graceful shutdown SIGINT/SIGTERM (clearInterval, server.close,
   pool.end, mongoose.disconnect); broadcast hanya bila `io.engine.clientsCount > 0`;
   hack `dns.setServers` hanya bila `USE_PUBLIC_DNS=true`; `initTables` hanya via seed
   (server tidak membuat tabel).
7. **Struktur**: `server.js` tipis (bootstrap + socket + interval), `routes/api.js`,
   `services/fleet.js`, `db/postgres.js`, `db/seed.js`, `models/Position.js`,
   `simulator.js`, `data/fleet.js`.

## Frontend

- `public/index.html` + `public/css/console.css` (tokens + komponen) + modul ES di
  `public/js/`: `main.js`, `map.js`, `fleet.js` (marker/sidebar), `history.js`
  (panel riwayat + playback), `socket.js`, `util.js` (escape, format).
- **Riwayat + playback**: klik kapal (marker/card) → panel bawah terbuka, fetch history,
  gambar track polyline di peta, slider waktu + tombol play/pause + kecepatan 1×/4×/16×;
  marker playback bergerak sepanjang track; tombol tutup kembali ke live.
- **Offline indicator**: `socket.on('disconnect')` → badge LIVE jadi OFFLINE (merah),
  toast saat reconnect; data terakhir tetap tampil dengan label basi.
- **Performa**: sidebar keyed-update per baris + event delegation; trail satu
  `L.polyline` per kapal di-`setLatLngs`; popup hanya di-update saat terbuka.
- **Keamanan**: escape HTML semua string dari server sebelum masuk DOM; ID filter SVG
  unik per MMSI.
- Filter tipe kapal, toggle sidebar, toggle tema peta, layer satelit: fitur lama tetap ada.

## Testing & verifikasi

- Unit test `node:test` (tanpa dependensi): `test/simulator.test.js` (bearing, step
  fisika, dwell, balik arah), `test/fleet.test.js` (merge, validasi MMSI).
- Verifikasi manual: server jalan dengan DB asli (.env sudah terisi), buka di browser,
  cek live update, filter, popup, riwayat + playback, offline indicator (matikan server).
- Screenshot otomatis via browser tool → `docs/screenshots/` → dipasang di README.

## Deliverables lain

- README ditulis ulang (sinkron kode, screenshot di atas, diagram arsitektur ASCII,
  cara jalanin, dokumentasi API termasuk param history).
- `LICENSE` ISC, deskripsi `package.json` diperbarui, `.env.example` dipulihkan +
  variabel baru, komentar basi dibersihkan.
- Semua di branch `remake/v2`; commit & push dilakukan user.

## Di luar scope

Deploy/hosting, framework frontend, autentikasi, data AIS asli (tetap simulasi).