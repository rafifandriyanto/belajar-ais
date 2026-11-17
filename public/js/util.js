/** util.js — helper format & keamanan DOM. */

export const TYPE_COLORS = {
  ferry: '#6fb7e8',
  cargo: '#e8b04b',
  tanker: '#e0655d',
  tug: '#7fd08a',
};

/** Escape semua string dari server sebelum masuk innerHTML. */
export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

export const fmtCoord = (n) => Number(n).toFixed(4);

export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('id-ID', { hour12: false });

export const fmtSpeed = (kn) => `${Number(kn).toFixed(1)} kn`;

/** Matcher search sidebar: nama substring (case-insensitive) atau MMSI substring. */
export function matchShip(ship, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  return String(ship.name || '').toLowerCase().includes(s) || String(ship.mmsi || '').includes(s);
}

/** Meter → mil laut, 1 desimal. */
export const fmtNm = (m) => (m / 1852).toFixed(1);