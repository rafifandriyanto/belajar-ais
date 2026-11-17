/**
 * main.js — wiring utama: peta, fleet, socket, riwayat, kontrol UI.
 */

import { initMap } from './map.js';
import { createFleet } from './fleet.js';
import { createHistory } from './history.js';
import { createFavorites } from './favorites.js';
import { connectSocket } from './socket.js';
import { fmtTime } from './util.js';

const { map, setDark, loadPorts } = initMap();
loadPorts();

// Pastikan Leaflet tahu ukuran container setelah layout selesai & saat resize
requestAnimationFrame(() => map.invalidateSize());
window.addEventListener('resize', () => map.invalidateSize());

const history = createHistory(map);
const favorites = createFavorites();
let lastShips = [];
const fleet = createFleet(map, {
  onSelect: (mmsi) => {
    fleet.setSelected(mmsi);
    history.open(mmsi, fleet.getName(mmsi));
  },
  favorites,
  onToggleFav: (mmsi) => {
    const on = favorites.toggle(mmsi);
    toast(on ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit');
    fleet.update(lastShips);
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
    lastShips = ships;
    if (!loadingRemoved) {
      document.getElementById('loadingState')?.remove();
      loadingRemoved = true;
    }
    const visible = fleet.update(ships);
    totalEl.textContent = visible;
    updatedEl.textContent = fmtTime(Date.now());
    // Follow: peta mengikuti kapal favorit selama panel riwayat tidak terbuka
    const f = favorites.getFollow();
    if (f && !history.isOpen()) {
      const s = ships.find((x) => x.mmsi === f);
      if (s) map.panTo([s.lat, s.lon], { animate: true, duration: 0.5 });
    }
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

// ─── Search sidebar (debounce + keyboard) ───────────────────────────────────
const searchEl = document.getElementById('shipSearch');
let searchTimer = null;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { totalEl.textContent = fleet.setSearch(searchEl.value); }, 120);
});
searchEl.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); fleet.moveKbd(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); fleet.moveKbd(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); fleet.selectKbd(); }
  else if (e.key === 'Escape') { searchEl.value = ''; totalEl.textContent = fleet.setSearch(''); searchEl.blur(); }
});

// ─── Filter favorit ─────────────────────────────────────────────────────────
document.getElementById('favFilter').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const on = !btn.classList.contains('active');
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', String(on));
  totalEl.textContent = fleet.setFavFilter(on);
});

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

// ─── Tema peta + palet konsol ───────────────────────────────────────────────
let dark = true;
const themeLabel = document.getElementById('mapThemeLabel');
document.getElementById('toggleMapTheme').addEventListener('click', () => {
  dark = !dark;
  setDark(dark);
  themeLabel.textContent = dark ? 'PETA GELAP' : 'PETA TERANG';
});

const PALETTES = ['sonar', 'phosphor', 'amber', 'chart'];
function applyPalette(name, silent) {
  document.documentElement.dataset.palette = name;
  localStorage.setItem('ais.palette', name);
  const light = name === 'chart';
  dark = !light;
  setDark(dark);
  themeLabel.textContent = light ? 'PETA TERANG' : 'PETA GELAP';
  if (!silent) toast(`Palet ${name} aktif`);
}
applyPalette(localStorage.getItem('ais.palette') || 'sonar', true);
document.getElementById('paletteBtn').addEventListener('click', () => {
  const cur = document.documentElement.dataset.palette || 'sonar';
  applyPalette(PALETTES[(PALETTES.indexOf(cur) + 1) % PALETTES.length]);
});