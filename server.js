/**
 * server.js - Server Express untuk Dashboard Monitoring AIS
 * Menyajikan API pergerakan kapal virtual dan berkas statis frontend.
 */

const express = require('express');
const path = require('path');
const { updateShips, getShips } = require('./simulator');

const app = express();
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

// Update posisi simulasi kapal setiap 2 detik
const SIMULATION_INTERVAL_MS = 2000;
setInterval(() => {
  updateShips();
}, SIMULATION_INTERVAL_MS);

// Jalankan server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AIS Monitoring Server berjalan di http://localhost:${PORT}`);
  console.log(`📡 Area Pemantauan: Selat Madura & Pelabuhan Tanjung Perak`);
  console.log(`⏱️  Interval update simulator: ${SIMULATION_INTERVAL_MS / 1000} detik`);
  console.log(`=======================================================`);
});
