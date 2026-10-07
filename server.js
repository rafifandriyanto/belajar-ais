/**
 * server.js - Server Express untuk Dashboard Monitoring AIS
 * Menyajikan API pergerakan kapal virtual, berkas statis, WebSocket Socket.io,
 * dan penyimpanan riwayat posisi ke MongoDB.
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const { updateShips, getShips } = require('./simulator');
const Position = require('./models/Position');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Koneksi ke Database MongoDB menggunakan Mongoose
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log('🍃 Terhubung ke database MongoDB');
    })
    .catch((err) => {
      console.warn('⚠️ Gagal terhubung ke MongoDB:', err.message);
    });
} else {
  console.log('ℹ️ MONGODB_URI belum disetel di .env (simulasi & socket tetap berjalan)');
}

// Middleware untuk menyajikan aset statis dari direktori public
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint API untuk mendapatkan data seluruh kapal virtual
app.get('/api/ships', (req, res) => {
  res.json({
    status: 'success',
    timestamp: new Date().toISOString(),
    count: getShips().length,
    data: getShips()
  });
});

// Endpoint API untuk mendapatkan 100 posisi terakhir kapal berdasarkan MMSI
app.get('/api/ships/:mmsi/history', async (req, res) => {
  const { mmsi } = req.params;

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Koneksi database MongoDB belum tersedia'
      });
    }

    const history = await Position.find({ mmsi })
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({
      status: 'success',
      mmsi,
      count: history.length,
      data: history
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

// Update posisi simulasi kapal setiap 2 detik dan pancarkan event ke client
const SIMULATION_INTERVAL_MS = 2000;
setInterval(() => {
  updateShips();
  io.emit('ships:update', getShips());
}, SIMULATION_INTERVAL_MS);

// Simpan posisi seluruh kapal ke database MongoDB setiap 10 detik
const DB_SAVE_INTERVAL_MS = 10000;
setInterval(async () => {
  if (mongoose.connection.readyState === 1) {
    try {
      const currentShips = getShips();
      const records = currentShips.map((ship) => ({
        mmsi: ship.mmsi,
        lat: ship.lat,
        lon: ship.lon,
        speed: ship.speed,
        heading: ship.heading,
        timestamp: new Date()
      }));

      await Position.insertMany(records);
    } catch (err) {
      console.error('Gagal menyimpan posisi ke MongoDB:', err.message);
    }
  }
}, DB_SAVE_INTERVAL_MS);

// Tangani koneksi client Socket.io
io.on('connection', (socket) => {
  // Kirim data kapal terkini langsung ke client saat terhubung
  socket.emit('ships:update', getShips());
});

// Jalankan server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AIS Monitoring Server berjalan di http://localhost:${PORT}`);
  console.log(`📡 Area Pemantauan: Selat Madura & Pelabuhan Tanjung Perak`);
  console.log(`⚡ WebSocket Socket.io aktif pada port ${PORT}`);
  console.log(`⏱️  Interval update simulator: ${SIMULATION_INTERVAL_MS / 1000} detik`);
  console.log(`💾 Interval penyimpanan database: ${DB_SAVE_INTERVAL_MS / 1000} detik`);
  console.log(`=======================================================`);
});
