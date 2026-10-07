# Dashboard Monitoring Kapal AIS (Simulasi)

Web dashboard pemantauan pergerakan kapal virtual Automatic Identification System (AIS) di perairan **Selat Madura dan Pelabuhan Tanjung Perak, Surabaya**.

Proyek ini dibangun menggunakan **Node.js, Express.js, Leaflet.js**, dan peta maritim OpenStreetMap dengan polling pembaruan posisi setiap 2 detik.

---

## 🌟 Fitur Utama

- **Peta Kapal Real-Time (Simulasi)**: Menampilkan posisi kapal di sekitar Selat Madura dan Tanjung Perak menggunakan Leaflet.js.
- **Simulasi 10 Kapal Virtual**: Bergerak otomatis menyusuri alur pelayaran dan berbalik arah saat mencapai ujung rute (*ping-pong navigation*).
- **Marker Berotasi Dinamis**: Ikon kapal SVG berputar sesuai dengan derajat sudut *heading* kapal secara akurat.
- **Popup Detail Kapal**: Klik pada marker atau kartu armada untuk melihat Nama, MMSI (9 digit), Tipe kapal, Kecepatan (knot), Heading, serta koordinat Latitude dan Longitude.
- **Kategori Armada Berwarna**:
  - ⛴️ **Ferry** (Cyan)
  - 🚢 **Cargo** (Amber)
  - ⛽ **Tanker** (Rose)
  - ⚓ **Tugboat** (Emerald)
- **Auto FitBounds & Bebas Ketergantungan API Key**: Seluruh armada langsung masuk ke dalam bingkai pandang peta tanpa memerlukan API Key berbayar.

---

## 📁 Struktur Proyek

```text
├── public/
│   ├── index.html        # Antarmuka web utama dashboard
│   ├── style.css         # Styling dark modern maritim glassmorphism
│   └── app.js            # Logika Leaflet, polling 2 detik, dan rotasi marker
├── simulator.js          # Generator data dan navigasi rute kapal virtual
├── server.js             # Backend Express server dan API endpoint
├── package.json          # Konfigurasi dependensi Node.js
└── README.md             # Dokumentasi proyek
```

---

## 🚀 Cara Menjalankan Proyek Secara Lokal

### 1. Prasyarat
- [Node.js](https://nodejs.org/) versi 18 atau lebih baru.
- Git.

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Menjalankan Server
```bash
npm start
```
Atau untuk mode pengembangan (*auto-reload*):
```bash
npm run dev
```

Buka peramban (browser) dan akses:
```text
http://localhost:3000
```

---

## 📡 Dokumentasi Endpoint API

### `GET /api/ships`
Mengembalikan status data 10 kapal virtual AIS yang diperbarui setiap 2 detik di memori server.

**Contoh Respons JSON:**
```json
{
  "status": "success",
  "timestamp": "2026-10-07T12:00:00.000Z",
  "count": 10,
  "data": [
    {
      "mmsi": "525001001",
      "name": "KM Dharma Kencana VII",
      "type": "ferry",
      "lat": -7.1955,
      "lon": 112.7395,
      "speed": 13.5,
      "heading": 333,
      "route": [ ... ]
    }
  ]
}
```

---

## 🛡️ Lisensi & Keamanan
Proyek ini dibuat untuk kebutuhan pembelajaran dan simulasi navigasi maritim mahasiswa Teknik Perkapalan. Tidak ada token rahasia atau kunci API privat yang disertakan dalam repositori ini.
