/**
 * services/fleet.js — Penggabung data statis kapal + dinamika simulator.
 * Data statis di-load dari PostgreSQL saat server start; bila PG mati,
 * fallback ke data/fleet.js. Satu fungsi merge dipakai REST dan Socket.io
 * supaya payload keduanya selalu konsisten.
 */

const { FLEET } = require('../data/fleet');
const sim = require('../simulator');

let staticMap = new Map(FLEET.map((s) => [s.mmsi, s]));

/** Ambil data statis lengkap (particulars + rute) dari PostgreSQL saat start. */
async function loadStaticFromPg(pool) {
  try {
    const { rows } = await pool.query(
      `SELECT s.mmsi, s.name, s.type, s.imo, s.call_sign, s.flag, s.length_m, s.beam_m,
              s.destination, s.owner_id, r.waypoints, r.speed_kn, r.dwell_s
       FROM ships s LEFT JOIN routes r ON r.mmsi = s.mmsi`,
    );
    for (const r of rows) {
      const base = staticMap.get(r.mmsi) || {};
      staticMap.set(r.mmsi, {
        ...base,
        mmsi: r.mmsi, name: r.name, type: r.type,
        imo: r.imo, callSign: r.call_sign, flag: r.flag,
        lengthM: r.length_m == null ? null : Number(r.length_m),
        beamM: r.beam_m == null ? null : Number(r.beam_m),
        destination: r.destination, owner_id: r.owner_id,
        route: r.waypoints || base.route,
        speedKn: r.speed_kn == null ? base.speedKn : Number(r.speed_kn),
        dwellSeconds: r.dwell_s == null ? base.dwellSeconds : r.dwell_s,
      });
    }
    return rows.length;
  } catch (err) {
    console.warn('PostgreSQL tidak tersedia, pakai data fleet lokal:', err.message);
    return 0;
  }
}

const getStaticFleet = () => [...staticMap.values()];
const getStatic = (mmsi) => staticMap.get(mmsi);
function setStatic(obj) { staticMap.set(obj.mmsi, { ...staticMap.get(obj.mmsi), ...obj }); }
function dropStatic(mmsi) { staticMap.delete(mmsi); }

/** Gabungkan dinamika simulator dengan data statis (nama, tipe, rute). */
function mergeShips(dynamics, map = staticMap) {
  return dynamics.map((d) => {
    const s = map.get(d.mmsi) || {};
    return { ...s, ...d, name: s.name, type: s.type };
  });
}

/** Snapshot lengkap untuk API & broadcast socket. */
const getMergedShips = () => mergeShips(sim.getShips());

module.exports = { loadStaticFromPg, mergeShips, getMergedShips, getStaticFleet, getStatic, setStatic, dropStatic };