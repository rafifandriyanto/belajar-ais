/**
 * main.js — wiring utama: peta, fleet, socket, riwayat, kontrol UI.
 */

import { initMap } from './map.js';
import { createFleet } from './fleet.js';
import { createHistory } from './history.js';
import { createFavorites } from './favorites.js';
import { createDetail } from './detail.js';
import { createAuth } from './auth.js';
import { createEditor } from './editor.js';
import { connectSocket } from './socket.js';
import { fmtClock } from './util.js';

const { map, setDark, loadPorts } = initMap();
loadPorts();

// Pastikan Leaflet tahu ukuran container setelah layout selesai & saat resize.
// ResizeObserver juga menangkap perubahan layout non-window (drawer jadi kolom,
// sidebar ditutup, panel riwayat dibuka).
requestAnimationFrame(() => map.invalidateSize());
window.addEventListener('resize', () => map.invalidateSize());
if (typeof ResizeObserver === 'function') {
  let roTimer = null;
  new ResizeObserver(() => {
    clearTimeout(roTimer);
    roTimer = setTimeout(() => map.invalidateSize(), 120);
  }).observe(document.getElementById('map'));
}

// ─── Nav konsol: satu sumber keadaan untuk tab ──────────────────────────────
const viewTabs = document.querySelectorAll('.view-tab');
function activeView() {
  return document.querySelector('.view-tab[aria-current="page"]')?.dataset.view || 'peta';
}
function activateView(view) {
  viewTabs.forEach((t) => {
    const active = t.dataset.view === view;
    t.classList.toggle('active', active);
    if (active) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
}
let viewBeforeHistory = 'peta';

const history = createHistory(map, {
  onModeChange: (on) => {
    if (on) {
      viewBeforeHistory = activeView() === 'riwayat' ? 'peta' : activeView();
      activateView('riwayat');
    } else {
      activateView(viewBeforeHistory);
    }
    document.body.classList.toggle('is-playback', on);
    document.body.classList.toggle('has-history', on);
    document.getElementById('playbackBadge').hidden = !on;
    // Mobile: drawer jadi bottom sheet dan menutup panel riwayat. Tutup drawer
    // saat riwayat dibuka supaya kontrol playback benar-benar terlihat.
    if (on && window.matchMedia('(max-width: 1023px)').matches && detail.isOpen()) detail.close();
  },
});
const favorites = createFavorites();
let lastShips = [];

// Diisi setelah auth & editor dibuat (di bawah); closure aman karena
// hanya dipanggil saat interaksi, bukan saat konstruksi.
let authCanEdit = () => false;
let editorOpen = () => {};
const detail = createDetail(document.querySelector('.main'), {
  favorites,
  canEdit: (ship) => authCanEdit(ship),
  getDyn: (mmsi) => fleet.getShip(mmsi),
  onHistory: (mmsi) => history.open(mmsi, fleet.getName(mmsi)),
  onEdit: (ship) => editorOpen(ship),
  onDelete: async (mmsi) => {
    const r = await fetch(`/api/ships/${mmsi}`, { method: 'DELETE' });
    if (r.ok) { toast('Kapal dihapus'); detail.close(); } else toast((await r.json()).message);
  },
  onFollow: (mmsi) => {
    const f = favorites.setFollow(mmsi);
    toast(f ? 'Follow aktif, peta mengikuti kapal' : 'Follow dimatikan');
  },
  onError: (msg) => toast(msg),
  onClose: () => {
    document.querySelectorAll('.ship-open[aria-expanded="true"]')
      .forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
  },
});

const fleet = createFleet(map, {
  onSelect: (mmsi) => {
    fleet.setSelected(mmsi);
    detail.open(mmsi);
  },
  favorites,
  onToggleFav: (mmsi) => {
    const on = favorites.toggle(mmsi);
    toast(on ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit');
    fleet.update(lastShips);
    if (detail.isOpen()) detail.rerender();
  },
});

// Esc global: tutup lapisan teratas dulu (drawer detail, lalu panel riwayat)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (detail.isOpen()) { detail.close(); return; }
  if (history.isOpen()) history.close();
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

// ─── Status koneksi + kesegaran data ────────────────────────────────────────
const connBadge = document.getElementById('connBadge');
const connLabel = document.getElementById('connLabel');
const staleBanner = document.getElementById('staleBanner');
const staleText = document.getElementById('staleText');
const retryBtn = document.getElementById('retryConn');
const fleetStat = document.getElementById('fleetStat');
const dataAgeEl = document.getElementById('dataAge');
const bootAt = Date.now();
// Tidak pernah anggap live sebelum frame pertama tiba.
let online = false;
let lastDataAt = 0;
let socket = null;

function ageText(ms) {
  const s = Math.max(0, Math.floor(Math.max(0, ms) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  return `${Math.floor(m / 60)} jam lalu`;
}

function paintStaleness() {
  const now = Date.now();
  const booting = !lastDataAt && now - bootAt <= 5000;
  const bootFail = !lastDataAt && !booting;
  const age = lastDataAt ? now - lastDataAt : now - bootAt;
  const stale = booting ? false : bootFail || !online || (!!lastDataAt && age > 12000);
  document.body.classList.toggle('is-stale', stale);
  staleBanner.hidden = !stale;
  retryBtn.hidden = !bootFail;
  dataAgeEl.textContent = lastDataAt && age >= 2000 ? ageText(age) : '';
  if (!stale) return;
  staleText.textContent = bootFail
    ? 'BELUM ADA DATA — server AIS tidak merespons'
    : online
      ? `DATA TERAKHIR — ${ageText(age)}`
      : `KONEKSI TERPUTUS — data terakhir ${ageText(age)}`;
}

function setConn(isOnline, silent, reason) {
  online = isOnline;
  connBadge.classList.toggle('online', isOnline);
  connBadge.classList.toggle('offline', !isOnline && !!lastDataAt);
  connBadge.classList.toggle('connecting', !isOnline && !lastDataAt);
  connLabel.textContent = isOnline ? 'LIVE' : (lastDataAt ? 'OFFLINE' : 'MENYAMBUNG');
  paintStaleness();
  if (silent) return;
  if (reason === 'error' || reason === 'retry') toast('Server AIS belum terjangkau — menunggu data');
  else toast(isOnline ? 'Terhubung kembali — data live dilanjutkan' : 'Koneksi terputus — data terakhir ditampilkan');
}
setInterval(paintStaleness, 1000);
retryBtn.addEventListener('click', () => {
  socket?.retry();
  setConn(false, true, 'retry');
});

// ─── Socket ─────────────────────────────────────────────────────────────────
const totalEl = document.getElementById('totalShips');
let loadingRemoved = false;

// Deep link: ?ship=<mmsi> membuka riwayat kapal itu saat data pertama tiba.
// Opsional &from=&to= (ISO) untuk membatasi jendela waktu track.
const params = new URLSearchParams(location.search);
const deepLinkMmsi = params.get('ship');
const deepLinkOpts = {};
if (params.get('from') && !isNaN(Date.parse(params.get('from')))) deepLinkOpts.from = params.get('from');
if (params.get('to') && !isNaN(Date.parse(params.get('to')))) deepLinkOpts.to = params.get('to');
let deepLinkDone = false;

socket = connectSocket({
  onUpdate: (ships) => {
    lastShips = ships;
    lastDataAt = Date.now();
    setConn(true, true);
    if (!loadingRemoved) {
      document.getElementById('loadingState')?.remove();
      loadingRemoved = true;
    }
    const visible = fleet.update(ships);
    // Playback = satu sumber kebenaran: nilai live drawer dibekukan.
    if (!history.isActive()) detail.refresh(ships);
    totalEl.textContent = visible;
    // Auto-follow dimatikan: peta sepenuhnya dikendalikan user (hindari bouncing).
    // Fitur FOLLOW tetap tersedia via tombol, tapi tidak memaksa pan otomatis.
    if (!deepLinkDone && deepLinkMmsi && ships.some((s) => s.mmsi === deepLinkMmsi)) {
      deepLinkDone = true;
      fleet.setSelected(deepLinkMmsi);
      detail.open(deepLinkMmsi);
      history.open(deepLinkMmsi, fleet.getName(deepLinkMmsi), deepLinkOpts);
    }
  },
  onStatus: setConn,
});

// ─── Jam topbar: WIB operasional + UTC datum ────────────────────────────────
const utcEl = document.getElementById('utcClock');
const wibEl = document.getElementById('wibClock');
const tickClocks = () => {
  utcEl.textContent = new Date().toISOString().slice(11, 19);
  wibEl.textContent = fmtClock(Date.now());
};
tickClocks();
setInterval(tickClocks, 1000);

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

// ─── Nav konsol: aksi tab, keadaan tab diatur oleh onModeChange ─────────────
viewTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    if (history.isOpen() && view !== 'riwayat') history.close();
    if (view === 'riwayat') {
      const mmsi = fleet.getSelected();
      if (!mmsi) {
        toast('Pilih kapal dulu untuk melihat riwayat');
        activateView(activeView() === 'riwayat' ? viewBeforeHistory : activeView());
        return;
      }
      history.open(mmsi, fleet.getName(mmsi));
      activateView('riwayat');
      return;
    }
    activateView(view);
    if (view === 'armada') searchEl.focus();
    else map.invalidateSize();
  });
});

// ─── Filter favorit ─────────────────────────────────────────────────────────
document.getElementById('favFilter').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const on = !btn.classList.contains('active');
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', String(on));
  totalEl.textContent = fleet.setFavFilter(on);
  syncFilterUI();
});

// ─── Filter tipe kapal ──────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const count = fleet.toggleFilter(btn.dataset.filter);
    btn.classList.toggle('active');
    btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
    totalEl.textContent = count;
    syncFilterUI();
  });
});

// ─── Mobile: satu entry point filter ────────────────────────────────────────
const filterToggle = document.getElementById('filterToggle');
const filterGrid = document.getElementById('filterGrid');
const filterLabel = document.getElementById('filterLabel');
const mobileFilter = window.matchMedia('(max-width: 600px)');

function syncFilterUI() {
  filterToggle.hidden = !mobileFilter.matches;
  if (!mobileFilter.matches) filterGrid.classList.remove('open');
  const activeTypes = document.querySelectorAll('.filter-btn[data-filter].active').length;
  const fav = document.getElementById('favFilter').classList.contains('active');
  filterLabel.textContent = `${activeTypes}/4 tipe${fav ? ' · Fav' : ''}`;
  filterToggle.setAttribute('aria-expanded', String(filterGrid.classList.contains('open')));
}
filterToggle.addEventListener('click', () => {
  filterGrid.classList.toggle('open');
  syncFilterUI();
});
mobileFilter.addEventListener('change', syncFilterUI);
syncFilterUI();

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

// ─── Auth + editor kapal ────────────────────────────────────────────────────
const auth = createAuth({
  onChange: (u) => {
    const userEl = document.getElementById('authUser');
    userEl.hidden = !u;
    userEl.textContent = u ? `${u.username} · ${u.role}` : '';
    document.getElementById('authBtn').hidden = !!u;
    document.getElementById('logoutBtn').hidden = !u;
    document.getElementById('addShipBtn').hidden = !u;
    if (detail.isOpen()) detail.rerender();
  },
});
authCanEdit = (ship) => auth.canEdit(ship);
document.getElementById('authBtn').addEventListener('click', () => auth.open('login'));
document.getElementById('logoutBtn').addEventListener('click', () => auth.logout());

const editor = createEditor(map, { onSaved: () => toast('Kapal disimpan, live di peta') });
editorOpen = (ship) => editor.open(ship);
document.getElementById('addShipBtn').addEventListener('click', () => editor.open(null));

// ─── Tampilan: palet + tema peta dalam satu menu ────────────────────────────
let dark = true;
const displayBtn = document.getElementById('displayBtn');
const displayMenu = document.getElementById('displayMenu');
const themeItem = document.getElementById('themeItem');

function syncDisplayMenu() {
  const cur = document.documentElement.dataset.palette || 'sonar';
  displayMenu.querySelectorAll('[data-palette]').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.palette === cur));
  });
  themeItem.setAttribute('aria-checked', String(dark));
  themeItem.textContent = dark ? 'Peta gelap' : 'Peta terang';
  displayBtn.setAttribute('aria-label', `Tampilan: palet ${cur}, peta ${dark ? 'gelap' : 'terang'}`);
}

function setDarkMode(on) {
  dark = on;
  setDark(on);
  syncDisplayMenu();
}

function openDisplayMenu() {
  syncDisplayMenu();
  displayMenu.hidden = false;
  displayBtn.setAttribute('aria-expanded', 'true');
  displayMenu.querySelector('[aria-checked="true"]')?.focus();
}

function closeDisplayMenu() {
  displayMenu.hidden = true;
  displayBtn.setAttribute('aria-expanded', 'false');
}

displayBtn.addEventListener('click', () => {
  if (displayMenu.hidden) openDisplayMenu(); else closeDisplayMenu();
});

displayMenu.addEventListener('click', (e) => {
  const pal = e.target.closest('[data-palette]');
  if (pal) {
    applyPalette(pal.dataset.palette);
    closeDisplayMenu();
    displayBtn.focus();
    return;
  }
  if (e.target.closest('#themeItem')) setDarkMode(!dark);
});

document.addEventListener('click', (e) => {
  if (!displayMenu.hidden && !e.target.closest('.display-control')) closeDisplayMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !displayMenu.hidden) {
    e.stopPropagation();
    closeDisplayMenu();
    displayBtn.focus();
  }
}, true);

function applyPalette(name, silent) {
  document.documentElement.dataset.palette = name;
  localStorage.setItem('ais.palette', name);
  dark = name !== 'chart';
  setDark(dark);
  if (!silent) toast(`Palet ${name} aktif`);
  syncDisplayMenu();
}
applyPalette(localStorage.getItem('ais.palette') || 'sonar', true);

// Refresh sesi paling akhir: onChange menyentuh detail & tombol yang sudah ada
auth.refresh();
