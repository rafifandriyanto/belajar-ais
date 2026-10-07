# PRD Minggu 1: Dashboard Monitoring Kapal AIS (Simulasi)

Versi 1.0 · Cakupan: Minggu 1 · Area: Selat Madura / Pelabuhan Tanjung Perak

## 1. Ringkasan

Web dashboard sederhana yang menampilkan pergerakan kapal virtual (simulasi AIS) di peta secara hampir real-time. Minggu 1 fokus pada fondasi: simulator kapal, API, dan peta yang bergerak. Belum memakai database, Socket.io, maupun Tailwind.

## 2. Masalah dan Pengguna

**Pengguna utama:** mahasiswa teknik perkapalan ITS yang ingin melihat pergerakan kapal di Selat Madura dan Tanjung Perak.

**Masalah:** website AIS publik yang ada saat ini rumit, penuh iklan, dan sulit difokuskan ke area tertentu.

## 3. Tujuan Minggu 1

- Pengguna langsung melihat kapal bergerak begitu halaman dibuka.
- Kapal terasa hidup: posisi berubah dan ikon berputar sesuai arah.
- Pengguna bisa melihat detail kapal dengan sekali klik.
- Pembuat (pemula) memahami alur dasar Express, fetch, dan Leaflet.

## 4. Fitur (In Scope)

1. **Peta kapal real-time (simulasi):** peta Leaflet berpusat di Tanjung Perak, marker kapal diperbarui tiap 2 detik lewat polling.
2. **Simulasi 10 kapal virtual:** bergerak mengikuti waypoint rute, berbalik arah di ujung rute.
3. **Info detail kapal:** klik marker memunculkan popup berisi nama, MMSI, tipe, kecepatan, dan heading.
4. **Marker berotasi:** ikon kapal mengikuti heading.

## 5. Di Luar Cakupan (Minggu 1)

- Database (MongoDB, PostgreSQL)
- Socket.io (real-time via push)
- Filter jenis kapal, pencarian, riwayat jejak
- Geofencing dan notifikasi
- Tailwind CSS dan login pengguna
- Hosting dan deploy

## 6. Alur Pengguna

1. Pengguna membuka halaman.
2. Peta muncul dengan 10 kapal di sekitar Tanjung Perak dan Selat Madura.
3. Kapal bergerak tiap 2 detik.
4. Pengguna klik satu kapal, popup detail muncul.

## 7. Spesifikasi Teknis

- **Backend:** Node.js + Express.js, simulator berjalan di memori (array).
- **Endpoint:** GET /api/ships mengembalikan seluruh kapal dalam JSON.
- **Frontend:** HTML + JavaScript biasa, Leaflet.js via CDN, fetch tiap 2 detik.
- **Struktur:** server.js, simulator.js, folder public (index.html, app.js).

## 8. Data Kapal

| Field | Keterangan |
| --- | --- |
| mmsi | ID 9 digit |
| name | Nama kapal |
| type | cargo, tanker, ferry, tug |
| lat, lon | Koordinat posisi |
| speed | Kecepatan (knot) |
| heading | Arah (derajat) |
| route | Daftar waypoint |

## 9. Kriteria Selesai

- Server berjalan di localhost tanpa error.
- 10 kapal tampil dan bergerak mulus di peta.
- Ikon berputar sesuai heading.
- Popup detail benar untuk setiap kapal.
- Kode tersimpan di Git dengan commit per fitur kecil.

## 10. Rencana Lanjutan

- **Minggu 2:** Socket.io dan penyimpanan posisi ke MongoDB.
- **Minggu 3:** PostgreSQL untuk data master, Tailwind CSS untuk UI, filter jenis kapal.
- **Opsional:** geofencing, alert, replay rute.
