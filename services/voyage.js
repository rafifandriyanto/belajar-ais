/**
 * services/voyage.js — Perhitungan voyage pure: sisa jarak ke ujung rute
 * searah arah kapal sekarang, dan ETA termasuk sisa waktu sandar.
 */
const { distanceMeters } = require('../simulator');
const KNOTS_TO_MS = 0.514444;

function computeVoyage(dyn, route, nowMs = Date.now()) {
  let remaining = distanceMeters(dyn.lat, dyn.lon, route[dyn.targetIndex][0], route[dyn.targetIndex][1]);
  for (let i = dyn.targetIndex + dyn.direction; i >= 0 && i < route.length; i += dyn.direction) {
    const a = route[i - dyn.direction];
    const b = route[i];
    remaining += distanceMeters(a[0], a[1], b[0], b[1]);
  }
  const speedMs = Math.max(dyn.speedKn, 0.1) * KNOTS_TO_MS;
  const dwellLeftMs = Math.max(0, (dyn.dwellUntil || 0) - nowMs);
  const etaMs = nowMs + dwellLeftMs + (remaining / speedMs) * 1000;
  return { remainingM: Math.round(remaining), etaIso: new Date(etaMs).toISOString(), speedKn: dyn.speedKn };
}

module.exports = { computeVoyage };