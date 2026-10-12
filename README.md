# Dashboard Monitoring Kapal AIS (Simulasi)

Web dashboard pemantauan pergerakan kapal virtual **Automatic Identification System (AIS)** di perairan **Selat Madura dan Pelabuhan Tanjung Perak, Surabaya**.

Proyek ini dibangun untuk simulasi dan pembelajaran navigasi maritim mahasiswa Teknik Perkapalan, menggunakan arsitektur event-driven real-time dengan **Socket.io**, riwayat posisi **MongoDB**, dan data statis kapal **PostgreSQL**.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, Socket.io (WebSocket), Mongoose, `pg` (node-postgres), Dotenv
- **Database**: MongoDB (riwayat posisi), PostgreSQL (data statis kapal & pelabuhan)
- **Frontend**: HTML5, Tailwind CSS v3 (CDN), Vanilla JS ES6+
- **Peta & GIS**: Leaflet.js, CartoDB Dark Matter Tiles (tanpa API key)

---

## 📅 Fitur per Minggu

### ⚓ Minggu 1 — Fondasi Peta & Simulasi Kapal
- **10 Kapal Virtual** bergerak di alur Selat Madura & Tanjung Perak (waypoint realistis)
- **Rotasi marker** mengikuti heading 0–359° secara presisi
- **Popup detail kapal**: nama, MMSI, tipe, kecepatan, heading, koordinat
- **REST Endpoint** `GET /api/ships`
- **Auto FitBounds** saat data pertama dimuat

### ⚡ Minggu 2 — Real-time Socket.io & Riwayat MongoDB
- **Socket.io Push**: server pancarkan `ships:update` tiap 2 detik
- **Koneksi MongoDB** via Mongoose, connection string dari `.env`
- **Model Position**: rekam posisi kapal (`mmsi`, `lat`, `lon`, `speed`, `heading`, `timestamp`)
- **Simpan otomatis** ke MongoDB tiap 10 detik
- **Endpoint riwayat** `GET /api/ships/:mmsi/history` (100 titik terakhir)

### 🚀 Minggu 3 — PostgreSQL, UI Tailwind, Filter & Ikon Baru
- **PostgreSQL** via `pg`: tabel `ships` (MMSI, nama, tipe) dan `ports` (pelabuhan referensi)
- **Seed script** `node db/seed.js`: isi 10 kapal + 3 pelabuhan Tanjung Perak
- **GET /api/ships** menggabungkan posisi simulator + nama/tipe dari PostgreSQL
- **GET /api/ports** mengembalikan daftar pelabuhan
- **Tailwind CSS v3** redesign total: tema dark navy glassmorphism, font Inter
- **Tile peta gelap** CartoDB Dark Matter (gratis, tanpa API key)
- **Filter jenis kapal**: toggle Ferry/Cargo/Tanker/Tug — marker & sidebar ikut berubah, counter update
- **Ikon kapal siluet SVG** tampak atas: haluan runcing, lambung lonjong, anjungan, buritan datar — ukuran berbeda per tipe
- **Warna konsisten**: Ferry=cyan, Cargo=amber, Tanker=merah, Tug=hijau
- **Trail polyline**: jejak 6 posisi terakhir per kapal
- **Sidebar responsif**: desktop geser kanan, mobile panel bawah
- **Glassmorphism**: popup, sidebar, header blur+transparan

---

## 🚀 Cara Instalasi & Menjalankan

### 1. Prasyarat

- [Node.js](https://nodejs.org/) versi 18+
- **MongoDB** lokal atau cloud (MongoDB Atlas)
- **PostgreSQL** lokal — direkomendasikan via **FlyEnv** (Windows)
- Git

### 2. Setup FlyEnv (Windows — cara termudah)

[FlyEnv](https://www.flyenv.com/) adalah tool GUI untuk mengelola PHP, MySQL, PostgreSQL, dll di Windows.

1. Download dan install FlyEnv
2. Di menu **Services**, aktifkan **PostgreSQL**
3. Catat port (default: `5432`), user (default: `postgres`)
4. Buka panel **Database Manager** → buat database baru bernama `ais_monitor`
5. FlyEnv otomatis menyalakan PostgreSQL saat dibutuhkan

### 3. Kloning Repositori

```bash
git clone https://github.com/rafifandriyanto/belajar-ais.git
cd belajar-ais
```

### 4. Instalasi Dependensi

```bash
npm install
```

### 5. Konfigurasi Variabel Lingkungan

Salin `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Isi file `.env`:

```env
PORT=3000

# MongoDB (lokal atau Atlas)
MONGODB_URI=mongodb://127.0.0.1:27017/belajar-ais

# PostgreSQL via FlyEnv (sesuaikan user/password jika berbeda)
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/ais_monitor
```

> **Catatan**: Jika MongoDB tidak tersambung, simulator dan Socket.io tetap berjalan normal.

### 6. Inisialisasi Database PostgreSQL

Jalankan seed **sekali** untuk membuat tabel dan mengisi data awal:

```bash
node db/seed.js
```

Output yang diharapkan:
```
🐘 Tabel PostgreSQL (ships, ports) siap digunakan
📦 Mengisi data kapal...
   ✅ 10 kapal berhasil di-seed
🏭 Mengisi data pelabuhan...
   ✅ 3 pelabuhan berhasil di-seed

✨ Seed selesai! Database siap digunakan.
```

### 7. Jalankan Aplikasi

**Mode pengembangan** (auto-reload saat file diubah):
```bash
npm run dev
```

**Mode standar**:
```bash
npm start
```

Buka browser di: **[http://localhost:3000](http://localhost:3000)**

---

## 📡 Dokumentasi API

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/ships` | Semua kapal (posisi simulator + nama/tipe dari PostgreSQL) |
| `GET` | `/api/ships/:mmsi/history` | 100 riwayat posisi terakhir dari MongoDB |
| `GET` | `/api/ports` | Daftar pelabuhan dari PostgreSQL |

---

## 🗂️ Struktur Proyek

```
belajar-ais/
├── db/
│   ├── postgres.js      # Koneksi Pool & initTables()
│   └── seed.js          # Script seed 10 kapal + 3 pelabuhan
├── models/
│   └── Position.js      # Model Mongoose untuk riwayat posisi
├── public/
│   ├── index.html       # Halaman utama (Tailwind CDN)
│   ├── style.css        # CSS custom (Leaflet overrides, marker, trail)
│   └── app.js           # Logika frontend (Socket.io, Leaflet, filter, ikon)
├── .env.example         # Template variabel lingkungan
├── .gitignore
├── package.json
├── README.md
├── server.js            # Entry point Express + Socket.io
└── simulator.js         # Simulator 10 kapal virtual
```

---

## 🛡️ Keamanan & Git Best Practices

- File `.env` tidak pernah di-commit (dilindungi `.gitignore`)
- Password database hanya ada di `.env` lokal — tidak hardcode di kode
- Gunakan `.env.example` sebagai template untuk anggota tim
- Branch terpisah per minggu (`minggu-1`, `minggu-2`, `minggu-3`)
- Jangan pernah `git push --force` ke `main`
