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

/** Jam lokal konsol (WIB) — satu notasi, titik dua, 24 jam. */
export function fmtClock(d) {
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hourCycle: 'h23',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(d));
  const v = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${v('hour')}:${v('minute')}:${v('second')}`;
}

export const fmtSpeed = (kn) => `${Number(kn).toFixed(1)} kn`;

/** Matcher search sidebar: nama substring (case-insensitive) atau MMSI substring. */
export function matchShip(ship, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  return String(ship.name || '').toLowerCase().includes(s) || String(ship.mmsi || '').includes(s);
}

/** Meter → mil laut, 1 desimal. */
export const fmtNm = (m) => (m / 1852).toFixed(1);