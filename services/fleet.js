/**
 * services/fleet.js — Penggabung data statis kapal + dinamika simulator.
 * Data statis di-load dari PostgreSQL saat server start; bila PG mati,
 * fallback ke data/fleet.js. Satu fungsi merge dipakai REST dan Socket.io
 * supaya payload keduanya selalu konsisten.
 */

const { FLEET } = require('../data/fleet');
const sim = require('../simulator');

let staticMap = new Map(FLEET.map((s) => [s.mmsi, s]));

/** Ambil nama/tipe terbaru dari PostgreSQL (dipanggil sekali saat start). */
async function loadStaticFromPg(pool) {
  try {
    const { rows } = await pool.query('SELECT mmsi, name, type FROM ships');
    for (const r of rows) {
      const base = staticMap.get(r.mmsi) || {};
      staticMap.set(r.mmsi, { ...base, mmsi: r.mmsi, name: r.name, type: r.type });
    }
    return rows.length;
  } catch (err) {
    console.warn('PostgreSQL tidak tersedia, pakai data fleet lokal:', err.message);
    return 0;
  }
}

/** Gabungkan dinamika simulator dengan data statis (nama, tipe, rute). */
function mergeShips(dynamics, map = staticMap) {
  return dynamics.map((d) => {
    const s = map.get(d.mmsi) || {};
    return { ...s, ...d, name: s.name, type: s.type };
  });
}

/** Snapshot lengkap untuk API & broadcast socket. */
const getMergedShips = () => mergeShips(sim.getShips());

module.exports = { loadStaticFromPg, mergeShips, getMergedShips };