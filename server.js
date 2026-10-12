/**
 * server.js - Server Express untuk Dashboard Monitoring AIS
 * Menyajikan API pergerakan kapal virtual, berkas statis, WebSocket Socket.io,
 * penyimpanan riwayat posisi ke MongoDB, dan data statis kapal dari PostgreSQL.
 *
 * Minggu 1: Peta Leaflet + Simulator 10 kapal
 * Minggu 2: Socket.io real-time + Riwayat posisi MongoDB
 * Minggu 3: PostgreSQL (ships, ports) + Tailwind UI + Filter + Ikon kapal baru
 */

require("dotenv").config();

const dns = require("dns");
// Gunakan public DNS (Google & Cloudflare) agar resolusi SRV MongoDB Atlas stabil
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // abaikan jika tidak diizinkan oleh sistem
}

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const { updateShips, getShips } = require("./simulator");
const Position = require("./models/Position");
const { pool, initTables } = require("./db/postgres"); // ← Minggu 3: PostgreSQL

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// ─── Koneksi MongoDB (Minggu 2) ────────────────────────────────────────────
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log("🍃 Terhubung ke database MongoDB"))
    .catch((err) =>
      console.warn("⚠️  Gagal terhubung ke MongoDB:", err.message),
    );
} else {
  console.log(
    "ℹ️  MONGODB_URI belum disetel di .env (simulasi & socket tetap berjalan)",
  );
}

// ─── Koneksi dan Inisialisasi PostgreSQL (Minggu 3) ────────────────────────
initTables().catch((err) =>
  console.warn("⚠️  Gagal inisialisasi PostgreSQL:", err.message),
);

// ─── Middleware Statis ──────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ─── GET /api/ships ────────────────────────────────────────────────────────
// Minggu 3: Menggabungkan data posisi dari simulator dengan
// nama & tipe kapal dari PostgreSQL (data statis lebih akurat)
app.get("/api/ships", async (req, res) => {
  try {
    const simulatorShips = getShips(); // posisi real-time dari simulator

    // Ambil data statis (nama & tipe) dari PostgreSQL
    const { rows: pgShips } = await pool.query(
      "SELECT mmsi, name, type FROM ships",
    );

    // Buat Map dari PostgreSQL (key: mmsi) untuk pencarian cepat O(1)
    const pgMap = new Map(pgShips.map((s) => [s.mmsi, s]));

    // Gabungkan: posisi dari simulator + nama/tipe dari PostgreSQL
    const merged = simulatorShips.map((ship) => {
      const pgData = pgMap.get(ship.mmsi);
      return {
        ...ship,
        // Jika ada di PostgreSQL, gunakan nama/tipe dari sana; fallback ke simulator
        name: pgData ? pgData.name : ship.name,
        type: pgData ? pgData.type : ship.type,
      };
    });

    res.json({
      status: "success",
      timestamp: new Date().toISOString(),
      count: merged.length,
      data: merged,
    });
  } catch (err) {
    // Jika PostgreSQL error, fallback ke data simulator murni
    console.warn("⚠️  PostgreSQL error, fallback ke simulator:", err.message);
    const ships = getShips();
    res.json({
      status: "success",
      timestamp: new Date().toISOString(),
      count: ships.length,
      data: ships,
    });
  }
});

// ─── GET /api/ships/:mmsi/history (Minggu 2) ───────────────────────────────
// Mengambil 100 posisi terakhir kapal berdasarkan MMSI dari MongoDB
app.get("/api/ships/:mmsi/history", async (req, res) => {
  const { mmsi } = req.params;

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: "error",
        message: "Koneksi database MongoDB belum tersedia",
      });
    }

    const history = await Position.find({ mmsi })
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({
      status: "success",
      mmsi,
      count: history.length,
      data: history,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ─── GET /api/ports (Minggu 3) ─────────────────────────────────────────────
// Mengambil daftar pelabuhan dari PostgreSQL
app.get("/api/ports", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, lat, lon FROM ports ORDER BY id",
    );
    res.json({ status: "success", count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ─── Socket.io: Broadcast posisi kapal setiap 2 detik ──────────────────────
const SIMULATION_INTERVAL_MS = 2000;
setInterval(() => {
  updateShips();
  io.emit("ships:update", getShips());
}, SIMULATION_INTERVAL_MS);

// ─── Simpan posisi ke MongoDB setiap 10 detik (Minggu 2) ───────────────────
const DB_SAVE_INTERVAL_MS = 10000;
setInterval(async () => {
  if (mongoose.connection.readyState === 1) {
    try {
      const records = getShips().map((ship) => ({
        mmsi: ship.mmsi,
        lat: ship.lat,
        lon: ship.lon,
        speed: ship.speed,
        heading: ship.heading,
        timestamp: new Date(),
      }));
      await Position.insertMany(records);
    } catch (err) {
      console.error("Gagal menyimpan posisi ke MongoDB:", err.message);
    }
  }
}, DB_SAVE_INTERVAL_MS);

// ─── Socket.io: Kirim data terkini saat client terhubung ───────────────────
io.on("connection", (socket) => {
  socket.emit("ships:update", getShips());
});

// ─── Jalankan Server ───────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AIS Monitoring Server berjalan di http://localhost:${PORT}`);
  console.log(`📡 Area Pemantauan: Selat Madura & Pelabuhan Tanjung Perak`);
  console.log(`⚡ WebSocket Socket.io aktif pada port ${PORT}`);
  console.log(
    `⏱️  Interval update simulator : ${SIMULATION_INTERVAL_MS / 1000} detik`,
  );
  console.log(
    `💾 Interval simpan MongoDB    : ${DB_SAVE_INTERVAL_MS / 1000} detik`,
  );
  console.log(`🐘 PostgreSQL ships & ports   : aktif`);
  console.log(`=======================================================`);
});
