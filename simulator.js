/**
 * simulator.js — Dinamika pergerakan kapal AIS virtual.
 * Data statis (nama, tipe, rute, kecepatan) berasal dari data/fleet.js;
 * file ini hanya menghitung posisi, heading, dan status.
 *
 * Fisika: kecepatan knot dikonversi ke m/detik, pergerakan berbasis
 * delta-time (bukan per-tick), dan jarak dihitung di bola bumi
 * (haversine + destination point) sehingga bujur terkoreksi cos(lat).
 */

const KNOTS_TO_MS = 0.514444;
const EARTH_R = 6371000;

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Bearing (derajat 0–359) dari titik 1 ke titik 2. */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}

/** Jarak meter antar dua koordinat (haversine). */
function distanceMeters(lat1, lon1, lat2, lon2) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

/** Titik baru setelah bergerak distM meter pada bearing tertentu. */
function destinationPoint(lat, lon, bearingDeg, distM) {
  const d = distM / EARTH_R;
  const t = toRad(bearingDeg);
  const p1 = toRad(lat);
  const l1 = toRad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [toDeg(p2), ((toDeg(l2) + 540) % 360) - 180];
}

// ─── State dinamika ────────────────────────────────────────────────────────
let state = [];
let clockMs = Date.now(); // clock simulasi, dimajukan oleh updateShips

/** Bangun state awal dari data fleet (posisi = waypoint pertama). */
function initSimulator(fleet) {
  state = fleet.map((ship) => ({
    mmsi: ship.mmsi,
    route: ship.route,
    speedKn: ship.speedKn,
    dwellSeconds: ship.dwellSeconds || 0,
    // jitter stabil per kapal (±5%) supaya kecepatan tidak terlihat robotik
    jitter: 0.95 + Math.random() * 0.1,
    lat: ship.route[0][0],
    lon: ship.route[0][1],
    targetIndex: 1,
    direction: 1,
    dwellUntil: 0,
    heading: calculateBearing(ship.route[0][0], ship.route[0][1], ship.route[1][0], ship.route[1][1]),
  }));
}

/**
 * Majukan seluruh kapal sejauh dtSeconds detik waktu nyata.
 * nowMs dipakai untuk menghitung masa sandar (dwell) di terminal.
 */
function updateShips(dtSeconds, nowMs = Date.now()) {
  clockMs = nowMs;
  for (const ship of state) {
    if (nowMs < ship.dwellUntil) continue; // masih sandar di terminal

    const target = ship.route[ship.targetIndex];
    const remaining = distanceMeters(ship.lat, ship.lon, target[0], target[1]);
    const step = ship.speedKn * KNOTS_TO_MS * dtSeconds * ship.jitter;

    if (remaining <= step) {
      // Tiba di waypoint
      ship.lat = target[0];
      ship.lon = target[1];

      const nextIndex = ship.targetIndex + ship.direction;
      if (nextIndex >= ship.route.length || nextIndex < 0) {
        // Ujung rute: sandar sebentar lalu balik arah
        ship.dwellUntil = nowMs + ship.dwellSeconds * 1000;
        ship.direction *= -1;
        ship.targetIndex = ship.targetIndex + ship.direction;
      } else {
        ship.targetIndex = nextIndex;
      }
    } else {
      const bearing = calculateBearing(ship.lat, ship.lon, target[0], target[1]);
      const [lat, lon] = destinationPoint(ship.lat, ship.lon, bearing, step);
      ship.lat = lat;
      ship.lon = lon;
    }

    const newTarget = ship.route[ship.targetIndex];
    ship.heading = calculateBearing(ship.lat, ship.lon, newTarget[0], newTarget[1]);
  }
}

/** Snapshot dinamika publik (tanpa data statis — itu tugas services/fleet). */
function getShips() {
  const now = clockMs;
  return state.map((s) => {
    const moored = now < s.dwellUntil;
    return {
      mmsi: s.mmsi,
      lat: Number(s.lat.toFixed(6)),
      lon: Number(s.lon.toFixed(6)),
      heading: s.heading,
      speed: moored ? 0 : Number((s.speedKn * s.jitter).toFixed(1)),
      status: moored ? 'moored' : 'underway',
    };
  });
}

/** Akses state internal — hanya untuk unit test. */
const _state = () => state;

module.exports = {
  calculateBearing,
  distanceMeters,
  destinationPoint,
  initSimulator,
  updateShips,
  getShips,
  _state,
};