/**
 * routes/api.js — REST API dashboard AIS.
 * GET /api/ships                     posisi live + data statis gabungan
 * GET /api/ships/:mmsi/history       riwayat posisi dari MongoDB (ascending)
 * GET /api/ports                     daftar pelabuhan (PG, fallback lokal)
 */

const express = require('express');
const mongoose = require('mongoose');
const Position = require('../models/Position');
const { pool } = require('../db/postgres');
const { PORTS, isValidMmsi } = require('../data/fleet');
const { getMergedShips } = require('../services/fleet');

const router = express.Router();

const serverError = (res, err) => {
  console.error('API error:', err);
  res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
};

router.get('/ships', (req, res) => {
  const data = getMergedShips();
  res.json({ status: 'success', timestamp: new Date().toISOString(), count: data.length, data });
});

router.get('/ships/:mmsi/history', async (req, res) => {
  const { mmsi } = req.params;
  if (!isValidMmsi(mmsi)) {
    return res.status(400).json({ status: 'error', message: 'MMSI harus 9 digit angka' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'error', message: 'Database riwayat belum tersedia' });
  }

  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 1000);
    const query = { mmsi };
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if (from && isNaN(from.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Parameter from tidak valid' });
    }
    if (to && isNaN(to.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Parameter to tidak valid' });
    }
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = from;
      if (to) query.timestamp.$lte = to;
    }

    // Ambil N terbaru lalu balik ke ascending: siap dipakai playback frontend
    const data = await Position.find(query).sort({ timestamp: -1 }).limit(limit).lean();
    data.reverse();
    res.json({ status: 'success', mmsi, count: data.length, data });
  } catch (err) {
    serverError(res, err);
  }
});

router.get('/ports', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, lat, lon FROM ports ORDER BY id');
    res.json({ status: 'success', count: rows.length, data: rows });
  } catch (err) {
    console.warn('PostgreSQL ports tidak tersedia, fallback lokal:', err.message);
    const data = PORTS.map((p, i) => ({ id: i + 1, ...p }));
    res.json({ status: 'success', count: data.length, data });
  }
});

module.exports = router;