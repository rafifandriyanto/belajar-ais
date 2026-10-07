# Dashboard Monitoring Kapal AIS (Simulasi)

Web dashboard pemantauan pergerakan kapal virtual Automatic Identification System (AIS) di perairan **Selat Madura dan Pelabuhan Tanjung Perak, Surabaya**.

Proyek ini dibangun untuk kebutuhan simulasi dan pembelajaran navigasi maritim mahasiswa Teknik Perkapalan, menggunakan arsitektur event-driven real-time dengan **Socket.io** dan penyimpanan riwayat posisi ke **MongoDB**.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, Socket.io (WebSocket), Mongoose (ODM), Dotenv
- **Database**: MongoDB (penyimpanan riwayat jejak posisi kapal)
- **Frontend**: HTML5, Vanilla CSS (Maritime Glassmorphism Dark Theme), JavaScript ES6+
- **Peta & GIS**: Leaflet.js, OpenStreetMap Tiles (bebas API key)

---

## 📅 Fitur per Minggu

### ⚓ Minggu 1: Fondasi Peta & Simulasi Kapal
- **Simulasi 10 Kapal Virtual**: Bergerak di perairan Selat Madura & Tanjung Perak mengikuti rute waypoint (KM Dharma Kencana VII, Meratus Surabaya, Pertamina Pride, TB Bima Perkasa, dll).
- **Rotasi Marker Kapal Dinamis**: Ikon SVG kapal berorientasi presisi mengikuti arah (*heading*) 0–359°.
- **Popup Detail Kapal**: Informasi Nama, MMSI 9 digit, tipe armada (Ferry, Cargo, Tanker, Tug), kecepatan (*knot*), heading, dan koordinat.
- **REST Endpoint**: `GET /api/ships` mengembalikan status armada saat ini.
- **Auto FitBounds**: Peta otomatis menyesuaikan batas pandang agar seluruh kapal langsung terlihat.

### ⚡ Minggu 2: Real-time Socket.io & Riwayat MongoDB
- **Socket.io Real-time Push**: Menggantikan polling HTTP fetch/setInterval. Server memancarkan event `ships:update` tiap 2 detik langsung ke browser secara efisien.
- **Koneksi Database MongoDB**: Menggunakan Mongoose dengan kredensial aman dari variabel lingkungan `.env`.
- **Model Position**: Skema pencatatan posisi kapal (`mmsi`, `lat`, `lon`, `speed`, `heading`, `timestamp`).
- **Penyimpanan Berkala**: Seluruh posisi kapal disimpan otomatis ke koleksi MongoDB setiap 10 detik.
- **Endpoint Riwayat Posisi**: `GET /api/ships/:mmsi/history` untuk mengambil hingga 100 data posisi terakhir dari kapal tertentu.

---

## 🚀 Cara Instalasi & Menjalankan

### 1. Prasyarat
- [Node.js](https://nodejs.org/) (versi 18 ke atas)
- [MongoDB](https://www.mongodb.com/) (lokal atau MongoDB Atlas)
- Git

### 2. Kloning Repositori & Masuk Folder
```bash
git clone https://github.com/rafifandriyanto/belajar-ais.git
cd belajar-ais
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Konfigurasi Variabel Lingkungan (.env)
Salin berkas `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi konfigurasi pada file `.env`:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/belajar-ais
```
*(Catatan: Jika MongoDB belum terhubung, simulasi dan Socket.io tetap berjalan normal tanpa mematikan server).*

### 5. Jalankan Aplikasi
Mode produksi:
```bash
npm start
```
Mode pengembangan (*auto reload*):
```bash
npm run dev
```

Buka peramban (browser) di:
```text
http://localhost:3000
```

---

## 📡 Dokumentasi Endpoint REST API

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/ships` | Mengambil seluruh data kapal virtual terkini |
| `GET` | `/api/ships/:mmsi/history` | Mengambil 100 titik riwayat posisi terakhir kapal berdasarkan MMSI |

---

## 🛡️ Keamanan & Git Best Practices
- Berkas kredensial `.env` dilindungi oleh `.gitignore` dan tidak pernah di-commit ke repositori.
- Menggunakan template `.env.example` untuk memudahkan konfigurasi lingkungan tim.
- Cabang `minggu-2` terpisah secara bersih dari cabang utama `main`.
