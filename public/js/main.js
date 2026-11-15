/**
 * main.js — wiring utama: peta, fleet, socket, riwayat, kontrol UI.
 */

import { initMap } from './map.js';
import { createFleet } from './fleet.js';
import { createHistory } from './history.js';
import { connectSocket } from './socket.js';
import { fmtTime } from './util.js';

const { map, setDark, loadPorts } = initMap();
loadPorts();

// Pastikan Leaflet tahu ukuran container setelah layout selesai & saat resize
requestAnimationFrame(() => map.invalidateSize());
window.addEventListener('resize', () => map.invalidateSize());

const history = createHistory(map);
const fleet = createFleet(map, {
  onSelect: (mmsi) => {
    fleet.setSelected(mmsi);
    history.open(mmsi, fleet.getName(mmsi));
  },
});

// ─── Toast ──────────────────────────────────────────────────────────────────
const toastEl = document.getElementById('toast');
let toastTimer = null;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4000);
}

// ─── Status koneksi ─────────────────────────────────────────────────────────
const connBadge = document.getElementById('connBadge');
const connLabel = document.getElementById('connLabel');
function setConn(online, silent) {
  connBadge.classList.toggle('online', online);
  connBadge.classList.toggle('offline', !online);
  connLabel.textContent = online ? 'LIVE' : 'OFFLINE';
  if (!silent) toast(online ? 'Terhubung kembali — data live dilanjutkan' : 'Koneksi terputus — data terakhir ditampilkan');
}

// ─── Socket ─────────────────────────────────────────────────────────────────
const totalEl = document.getElementById('totalShips');
const updatedEl = document.getElementById('lastUpdated');
let loadingRemoved = false;

// Deep link: ?ship=<mmsi> membuka riwayat kapal itu saat data pertama tiba.
// Opsional &from=&to= (ISO) untuk membatasi jendela waktu track.
const params = new URLSearchParams(location.search);
const deepLinkMmsi = params.get('ship');
const deepLinkOpts = {};
if (params.get('from') && !isNaN(Date.parse(params.get('from')))) deepLinkOpts.from = params.get('from');
if (params.get('to') && !isNaN(Date.parse(params.get('to')))) deepLinkOpts.to = params.get('to');
let deepLinkDone = false;

connectSocket({
  onUpdate: (ships) => {
    if (!loadingRemoved) {
      document.getElementById('loadingState')?.remove();
      loadingRemoved = true;
    }
    const visible = fleet.update(ships);
    totalEl.textContent = visible;
    updatedEl.textContent = fmtTime(Date.now());
    if (!deepLinkDone && deepLinkMmsi && ships.some((s) => s.mmsi === deepLinkMmsi)) {
      deepLinkDone = true;
      fleet.setSelected(deepLinkMmsi);
      history.open(deepLinkMmsi, fleet.getName(deepLinkMmsi), deepLinkOpts);
    }
  },
  onStatus: setConn,
});

// ─── Jam UTC topbar ─────────────────────────────────────────────────────────
const utcEl = document.getElementById('utcClock');
const tickUtc = () => { utcEl.textContent = new Date().toISOString().slice(11, 19); };
tickUtc();
setInterval(tickUtc, 1000);

// ─── Filter tipe kapal ──────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const count = fleet.toggleFilter(btn.dataset.filter);
    btn.classList.toggle('active');
    btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
    totalEl.textContent = count;
  });
});

// ─── Toggle sidebar ─────────────────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const openBtn = document.getElementById('openSidebarBtn');
document.getElementById('toggleSidebar').addEventListener('click', () => {
  sidebar.classList.add('collapsed');
  openBtn.classList.add('visible');
});
openBtn.addEventListener('click', () => {
  sidebar.classList.remove('collapsed');
  openBtn.classList.remove('visible');
});

// ─── Tema peta ──────────────────────────────────────────────────────────────
let dark = true;
const themeLabel = document.getElementById('mapThemeLabel');
document.getElementById('toggleMapTheme').addEventListener('click', () => {
  dark = !dark;
  setDark(dark);
  themeLabel.textContent = dark ? 'PETA GELAP' : 'PETA TERANG';
});