/**
 * models/Position.js — Model Mongoose untuk riwayat posisi kapal AIS.
 * Compound index {mmsi, timestamp} melayani query riwayat per kapal;
 * TTL index otomatis menghapus data lama (default 30 hari, atur di .env).
 */

const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  mmsi: { type: String, required: true },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  speed: { type: Number, required: true },
  heading: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Query utama: riwayat satu kapal urut waktu
positionSchema.index({ mmsi: 1, timestamp: -1 });

// Retensi data: 0 = nonaktif (simpan selamanya)
const ttlDays = Number(process.env.POSITION_TTL_DAYS || 30);
if (ttlDays > 0) {
  positionSchema.index({ timestamp: 1 }, { expireAfterSeconds: ttlDays * 86400 });
}

module.exports = mongoose.model('Position', positionSchema);