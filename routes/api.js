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
const { getMergedShips, getStatic, setStatic, dropStatic } = require('../services/fleet');
const sim = require('../simulator');
const { computeVoyage } = require('../services/voyage');
const { validateShipPayload } = require('../services/ship-validate');
const { canEditShip } = require('../services/auth');
const { requireAuth, sameOrigin } = require('./auth');

const router = express.Router();

const emitFleet = (req) => req.app.get('io')?.emit('fleet:update', getMergedShips());

/** Serialisasi mutasi per MMSI: PUT/DELETE tidak boleh interleave dan
 * meninggalkan "kapal hantu" (ada di cache+simulator, tanpa baris DB). */
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const gate = new Promise((r) => { release = r; });
  locks.set(key, gate);
  return prev.then(fn).finally(() => {
    release();
    if (locks.get(key) === gate) locks.delete(key);
  });
}

const serverError = (res, err) => {
  console.error('API error:', err);
  res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
};

router.get('/ships', (req, res) => {
  const data = getMergedShips();
  res.json({ status: 'success', timestamp: new Date().toISOString(), count: data.length, data });
});

router.get('/ships/:mmsi', (req, res) => {
  const s = getStatic(req.params.mmsi);
  if (!s) return res.status(404).json({ status: 'error', message: 'Kapal tidak dikenal' });
  const dyn = sim.getDynamics(s.mmsi);
  const voyage = dyn && s.route ? { destination: s.destination || null, ...computeVoyage(dyn, s.route) } : null;
  res.json({ status: 'success', data: { ...s, voyage } });
});

router.post('/ships', requireAuth, sameOrigin, (req, res) => withLock(req.body?.mmsi, async () => {
  const errs = validateShipPayload(req.body || {});
  if (errs.length) return res.status(400).json({ status: 'error', message: errs.join('; ') });
  const b = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dup = await client.query('SELECT 1 FROM ships WHERE mmsi = $1', [b.mmsi]);
    if (dup.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ status: 'error', message: 'MMSI sudah terdaftar' });
    }
    await client.query(
      `INSERT INTO ships (mmsi,name,type,imo,call_sign,flag,length_m,beam_m,destination,owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [b.mmsi, b.name.trim(), b.type, b.imo || null, b.callSign || null, b.flag || null, b.lengthM ?? null, b.beamM ?? null, b.destination || null, req.user.id],
    );
    await client.query('INSERT INTO routes (mmsi,waypoints,speed_kn,dwell_s) VALUES ($1,$2,$3,$4)', [b.mmsi, JSON.stringify(b.route), b.speedKn, b.dwellSeconds || 0]);
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    return res.status(503).json({ status: 'error', message: 'Database kapal belum tersedia' });
  } finally {
    client.release();
  }
  setStatic({ ...b, name: b.name.trim(), owner_id: req.user.id });
  sim.upsertShip({ mmsi: b.mmsi, route: b.route, speedKn: b.speedKn, dwellSeconds: b.dwellSeconds || 0 });
  console.log('AUDIT', req.user.username, 'CREATE ship', b.mmsi);
  emitFleet(req);
  res.status(201).json({ status: 'success', data: getStatic(b.mmsi) });
}));

router.put('/ships/:mmsi', requireAuth, sameOrigin, (req, res) => withLock(req.params.mmsi, async () => {
  const errs = validateShipPayload(req.body || {}, { partial: true });
  if (errs.length) return res.status(400).json({ status: 'error', message: errs.join('; ') });
  const b = req.body;
  const client = await pool.connect();
  let cur, route, speedKn, dwell;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM ships WHERE mmsi = $1', [req.params.mmsi]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ status: 'error', message: 'Kapal tidak dikenal' });
    }
    if (!canEditShip(req.user, rows[0])) {
      await client.query('ROLLBACK');
      return res.status(403).json({ status: 'error', message: 'Hanya pemilik atau admin yang boleh mengubah kapal ini' });
    }
    cur = rows[0];
    await client.query(
      `UPDATE ships SET name=$1, type=$2, imo=$3, call_sign=$4, flag=$5, length_m=$6, beam_m=$7, destination=$8 WHERE mmsi=$9`,
      [b.name ?? cur.name, b.type ?? cur.type, b.imo ?? cur.imo, b.callSign ?? cur.call_sign, b.flag ?? cur.flag, b.lengthM ?? cur.length_m, b.beamM ?? cur.beam_m, b.destination ?? cur.destination, cur.mmsi],
    );
    const rr = (await client.query('SELECT waypoints, speed_kn, dwell_s FROM routes WHERE mmsi=$1', [cur.mmsi])).rows[0];
    route = b.route || rr?.waypoints;
    speedKn = b.speedKn ?? Number(rr?.speed_kn ?? 12);
    dwell = b.dwellSeconds ?? rr?.dwell_s ?? 0;
    if (!Array.isArray(route) || route.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ status: 'error', message: 'route: minimal 2 titik' });
    }
    await client.query(
      `INSERT INTO routes (mmsi,waypoints,speed_kn,dwell_s) VALUES ($1,$2,$3,$4)
       ON CONFLICT (mmsi) DO UPDATE SET waypoints=EXCLUDED.waypoints, speed_kn=EXCLUDED.speed_kn, dwell_s=EXCLUDED.dwell_s`,
      [cur.mmsi, JSON.stringify(route), speedKn, dwell],
    );
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    return res.status(503).json({ status: 'error', message: 'Database kapal belum tersedia' });
  } finally {
    client.release();
  }
  setStatic({ mmsi: cur.mmsi, name: b.name ?? cur.name, type: b.type ?? cur.type, imo: b.imo ?? cur.imo, callSign: b.callSign ?? cur.call_sign, flag: b.flag ?? cur.flag, lengthM: b.lengthM ?? cur.length_m, beamM: b.beamM ?? cur.beam_m, destination: b.destination ?? cur.destination, route, speedKn, dwellSeconds: dwell });
  sim.upsertShip({ mmsi: cur.mmsi, route, speedKn, dwellSeconds: dwell });
  console.log('AUDIT', req.user.username, 'UPDATE ship', cur.mmsi);
  emitFleet(req);
  res.json({ status: 'success', data: getStatic(cur.mmsi) });
}));

router.delete('/ships/:mmsi', requireAuth, sameOrigin, (req, res) => withLock(req.params.mmsi, async () => {
  try {
    const { rows } = await pool.query('SELECT mmsi, owner_id FROM ships WHERE mmsi = $1', [req.params.mmsi]);
    if (!rows.length) return res.status(404).json({ status: 'error', message: 'Kapal tidak dikenal' });
    if (!canEditShip(req.user, rows[0])) return res.status(403).json({ status: 'error', message: 'Hanya pemilik atau admin yang boleh menghapus kapal ini' });
    await pool.query('DELETE FROM ships WHERE mmsi = $1', [req.params.mmsi]);
    dropStatic(req.params.mmsi);
    sim.removeShip(req.params.mmsi);
    console.log('AUDIT', req.user.username, 'DELETE ship', req.params.mmsi);
    emitFleet(req);
    res.json({ status: 'success', deleted: true });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database kapal belum tersedia' });
  }
}));

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