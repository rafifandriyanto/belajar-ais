/**
 * server.js - Server Express untuk Dashboard Monitoring AIS
 * Menyajikan API pergerakan kapal virtual, berkas statis, dan WebSocket Socket.io.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { updateShips, getShips } = require('./simulator');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

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

// Update posisi simulasi kapal setiap 2 detik dan kirim via Socket.io
const SIMULATION_INTERVAL_MS = 2000;
setInterval(() => {
  updateShips();
  io.emit('ships:update', getShips());
}, SIMULATION_INTERVAL_MS);

// Tangani koneksi client Socket.io
io.on('connection', (socket) => {
  // Langsung kirim posisi kapal saat ini ke client yang baru terhubung
  socket.emit('ships:update', getShips());
});

// Jalankan server HTTP yang mendukung WebSocket Socket.io
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AIS Monitoring Server berjalan di http://localhost:${PORT}`);
  console.log(`📡 Area Pemantauan: Selat Madura & Pelabuhan Tanjung Perak`);
  console.log(`⚡ WebSocket Socket.io aktif pada port ${PORT}`);
  console.log(`⏱️  Interval update simulator: ${SIMULATION_INTERVAL_MS / 1000} detik`);
  console.log(`=======================================================`);
});
