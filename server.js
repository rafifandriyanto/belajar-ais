/**
 * server.js — Bootstrap server dashboard AIS.
 * Express (static + REST) + Socket.io (broadcast live) + simulator.
 * Data statis kapal dari PostgreSQL (fallback data/fleet.js),
 * riwayat posisi disimpan ke MongoDB.
 */

require('dotenv').config();

const dns = require('dns');
// Opsional: public DNS untuk resolusi SRV MongoDB Atlas di jaringan tertentu.
// Default OFF karena mengubah resolusi DNS seluruh proses.
if (process.env.USE_PUBLIC_DNS === 'true') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    // abaikan bila tidak diizinkan sistem
  }
}

const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const sim = require('./simulator');
const { FLEET } = require('./data/fleet');
const { pool } = require('./db/postgres');
const { loadStaticFromPg, getMergedShips } = require('./services/fleet');
const apiRouter = require('./routes/api');
const Position = require('./models/Position');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SIM_INTERVAL_MS = 2000;
const DB_SAVE_INTERVAL_MS = 10000;

// ─── Database ───────────────────────────────────────────────────────────────
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB terhubung (riwayat posisi aktif)'))
    .catch((err) => console.warn('MongoDB gagal terhubung:', err.message));
} else {
  console.log('MONGODB_URI belum disetel — riwayat posisi nonaktif');
}

// ─── HTTP ───────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);
app.use('/api', (req, res) => res.status(404).json({ status: 'error', message: 'Endpoint tidak ditemukan' }));

// ─── Simulasi & broadcast ───────────────────────────────────────────────────
sim.initSimulator(FLEET);
let lastTick = Date.now();

const simTimer = setInterval(() => {
  const now = Date.now();
  const dt = Math.min(Math.max((now - lastTick) / 1000, 0.1), 10);
  lastTick = now;
  sim.updateShips(dt, now);
  if (io.engine.clientsCount > 0) {
    io.emit('ships:update', getMergedShips());
  }
}, SIM_INTERVAL_MS);

const saveTimer = setInterval(async () => {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const records = sim.getShips().map((s) => ({
      mmsi: s.mmsi,
      lat: s.lat,
      lon: s.lon,
      speed: s.speed,
      heading: s.heading,
      timestamp: new Date(),
    }));
    await Position.insertMany(records);
  } catch (err) {
    console.error('Gagal menyimpan riwayat:', err.message);
  }
}, DB_SAVE_INTERVAL_MS);

io.on('connection', (socket) => {
  socket.emit('ships:update', getMergedShips());
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} diterima — menutup server...`);
  clearInterval(simTimer);
  clearInterval(saveTimer);
  const force = setTimeout(() => process.exit(1), 5000);
  force.unref();
  try {
    io.close();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    await mongoose.disconnect();
  } catch {
    // abaikan error saat penutupan
  }
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ─── Start ──────────────────────────────────────────────────────────────────
(async () => {
  const n = await loadStaticFromPg(pool);
  console.log(n > 0 ? `Data statis ${n} kapal dimuat dari PostgreSQL` : 'Data statis memakai fleet lokal');
  server.listen(PORT, () => {
    console.log(`AIS Monitor berjalan di http://localhost:${PORT}`);
    console.log(`Area: Selat Madura & Tanjung Perak | ${FLEET.length} kapal | update ${SIM_INTERVAL_MS / 1000}s`);
  });
})();