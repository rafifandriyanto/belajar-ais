/** util.js — helper format & keamanan DOM. */

export const TYPE_COLORS = {
  ferry: '#5cb8e8',
  cargo: '#e8a33d',
  tanker: '#e05d5d',
  tug: '#4fc47f',
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