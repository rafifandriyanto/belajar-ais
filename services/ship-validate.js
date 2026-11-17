/**
 * services/ship-validate.js — Validasi payload kapal untuk POST/PUT.
 * Mengembalikan array pesan error per field; kosong berarti valid.
 */
const { isValidMmsi } = require('../data/fleet');
const TYPES = ['ferry', 'cargo', 'tanker', 'tug'];
const BBOX = { latMin: -7.35, latMax: -7.05, lonMin: 112.55, lonMax: 112.85 };

function validateShipPayload(b, { partial = false } = {}) {
  const errs = [];
  const has = (k) => b[k] !== undefined;
  if (!partial || has('mmsi')) {
    if (!isValidMmsi(String(b.mmsi ?? ''))) errs.push('mmsi: harus 9 digit angka');
  }
  if (!partial || has('name')) {
    if (typeof b.name !== 'string') errs.push('name: harus teks');
    else {
      const n = b.name.trim();
      if (n.length < 1 || n.length > 100) errs.push('name: 1-100 karakter');
    }
  }
  if (!partial || has('type')) {
    if (!TYPES.includes(b.type)) errs.push('type: ferry/cargo/tanker/tug');
  }
  if (!partial || has('speedKn')) {
    const s = Number(b.speedKn);
    if (!Number.isFinite(s) || s < 1 || s > 30) errs.push('speedKn: 1-30');
  }
  if (!partial || has('route')) {
    const r = b.route;
    if (!Array.isArray(r) || r.length < 2) errs.push('route: minimal 2 titik');
    else {
      for (const pt of r) {
        const [lat, lon] = Array.isArray(pt) ? pt : [];
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < BBOX.latMin || lat > BBOX.latMax || lon < BBOX.lonMin || lon > BBOX.lonMax) {
          errs.push('route: titik di luar area operasi');
          break;
        }
      }
    }
  }
  if (has('dwellSeconds')) {
    const d = Number(b.dwellSeconds);
    if (!Number.isFinite(d) || d < 0 || d > 3600) errs.push('dwellSeconds: 0-3600');
  }
  for (const [k, max] of [['imo', 12], ['callSign', 12], ['flag', 40], ['destination', 60]]) {
    if (has(k) && (typeof b[k] !== 'string' || b[k].length > max)) errs.push(`${k}: teks maks ${max} karakter`);
  }
  for (const [k, max] of [['lengthM', 400], ['beamM', 100]]) {
    if (has(k)) {
      const v = Number(b[k]);
      if (!Number.isFinite(v) || v <= 0 || v > max) errs.push(`${k}: angka 1-${max}`);
    }
  }
  return errs;
}

module.exports = { validateShipPayload, TYPES, BBOX };