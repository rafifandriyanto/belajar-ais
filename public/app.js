/**
 * app.js — Frontend Dashboard Monitoring AIS (Minggu 3)
 *
 * Fitur:
 *   - Peta Leaflet dengan tile gelap (CartoDB Dark Matter) tanpa API key
 *   - Ikon kapal SVG siluet tampak atas: haluan runcing, lambung lonjong,
 *     buritan datar, anjungan kecil — ukuran berbeda per tipe
 *   - Rotasi marker sesuai heading, warna per tipe
 *   - Jejak polyline pendek (5 posisi terakhir) per kapal
 *   - Filter jenis kapal (Ferry/Cargo/Tanker/Tug): marker & sidebar ikut
 *   - Counter kapal berubah saat filter aktif
 *   - Socket.io real-time dari server
 *   - Klik sidebar card → fokus marker di peta
 *   - Toggle collapse sidebar (desktop: geser kanan, mobile: geser bawah)
 */

/* ─── Konfigurasi ──────────────────────────────────────────────────────── */
const MAP_CENTER = [-7.185, 112.738]; // Pusat Selat Madura & Tanjung Perak
const MAP_ZOOM   = 13;
const TRAIL_MAX  = 6; // jumlah titik jejak yang disimpan per kapal

/* ─── State Global ─────────────────────────────────────────────────────── */
const markersMap  = new Map(); // key: mmsi → { marker, trail, history }
const activeFilters = new Set(['ferry', 'cargo', 'tanker', 'tug']); // semua aktif awal
let currentSelectedMmsi = null;
let fitted = false;

/* ─── 1. Inisialisasi Peta ─────────────────────────────────────────────── */
const map = L.map('map', {
  center: MAP_CENTER,
  zoom: MAP_ZOOM,
  zoomControl: false
});

// Kontrol zoom pojok kiri atas
L.control.zoom({ position: 'topleft' }).addTo(map);

// Layer Tile: CartoDB Dark (gelap), OSM Standar (awal minggu 1-2), Satelit Esri
const tileDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
});

const tileOSM = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
});

const tileSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  maxZoom: 18
});

// Default layer: CartoDB Dark Matter (tema gelap nautikal)
tileDark.addTo(map);
let activeTile = 'dark';

// Kontrol layer Leaflet di kiri bawah (tidak tertutup sidebar kanan)
L.control.layers({
  '🌙 Dark Matter': tileDark,
  '🗺️ OSM Standar (Awal)': tileOSM,
  '🛰️ Satelit Esri': tileSat
}, null, { position: 'bottomleft' }).addTo(map);

// Sinkronisasi pergantian layer dari Leaflet control ke tombol header
map.on('baselayerchange', (e) => {
  if (e.layer === tileOSM) {
    activeTile = 'osm';
    updateThemeButtonUI(true);
  } else if (e.layer === tileDark) {
    activeTile = 'dark';
    updateThemeButtonUI(false);
  } else {
    activeTile = 'sat';
    updateThemeButtonUI(false, '🛰️', 'Peta Satelit');
  }
});

function updateThemeButtonUI(isOSM, customIcon, customLabel) {
  const btnIcon = document.getElementById('mapThemeIcon');
  const btnLabel = document.getElementById('mapThemeLabel');
  if (customIcon && customLabel) {
    if (btnIcon) btnIcon.textContent = customIcon;
    if (btnLabel) btnLabel.textContent = customLabel;
    return;
  }
  if (isOSM) {
    if (btnIcon) btnIcon.textContent = '🌙';
    if (btnLabel) btnLabel.textContent = 'Peta Dark Mode';
  } else {
    if (btnIcon) btnIcon.textContent = '🗺️';
    if (btnLabel) btnLabel.textContent = 'Peta Standar (OSM)';
  }
}

// Tombol cepat di header (Peta Standar OSM / Dark Mode)
const toggleMapThemeBtn = document.getElementById('toggleMapTheme');
if (toggleMapThemeBtn) {
  toggleMapThemeBtn.addEventListener('click', () => {
    if (activeTile === 'dark') {
      map.removeLayer(tileDark);
      tileOSM.addTo(map);
      activeTile = 'osm';
      updateThemeButtonUI(true);
    } else {
      map.removeLayer(tileOSM);
      if (map.hasLayer(tileSat)) map.removeLayer(tileSat);
      tileDark.addTo(map);
      activeTile = 'dark';
      updateThemeButtonUI(false);
    }
  });
}

/* ─── 2. Definisi Ukuran Ikon per Tipe Kapal ──────────────────────────── */
// Kapal kecil besar menggambarkan proporsi: cargo & tanker panjang, tug pendek gemuk
const SHIP_SIZES = {
  ferry:  { w: 18, h: 40 }, // sedang
  cargo:  { w: 16, h: 50 }, // panjang & ramping
  tanker: { w: 18, h: 50 }, // panjang & sedikit lebih lebar
  tug:    { w: 20, h: 28 }  // pendek & gemuk
};

/**
 * Membuat SVG siluet kapal tampak atas:
 *   - Haluan runcing (depan atas)
 *   - Lambung lonjong/oval
 *   - Buritan datar (bawah)
 *   - Kotak anjungan kecil di tengah-depan
 *
 * Semua path relatif terhadap viewBox berukuran w×h.
 */
function buildShipSVG(type, heading) {
  const { w, h } = SHIP_SIZES[type] || SHIP_SIZES.ferry;

  // Persentase posisi fitur terhadap tinggi (h)
  const bowY   = 0;            // ujung haluan (atas)
  const midY   = h * 0.5;      // tengah kapal
  const sternY = h;            // buritan (bawah)
  const halfW  = w / 2;        // setengah lebar

  // Titik-titik lambung (hull) berbentuk tetes air: runcing atas, melebar tengah, datar bawah
  const hullPoints = [
    `${halfW},${bowY + 1}`,          // puncak haluan
    `${w - 1},${h * 0.35}`,         // bahu kanan
    `${w - 1},${h * 0.72}`,         // pinggang kanan
    `${w * 0.85},${sternY - 1}`,    // sudut buritan kanan
    `${w * 0.15},${sternY - 1}`,    // sudut buritan kiri
    `${1},${h * 0.72}`,             // pinggang kiri
    `${1},${h * 0.35}`,             // bahu kiri
  ].join(' ');

  // Anjungan: kotak kecil di 30–50% dari atas
  const bridgeTop   = h * 0.28;
  const bridgeBot   = h * 0.50;
  const bridgeLeft  = halfW - w * 0.22;
  const bridgeRight = halfW + w * 0.22;

  return `
<svg class="ship-icon-svg ${type}"
     style="transform:rotate(${heading}deg); width:${w}px; height:${h}px;"
     viewBox="0 0 ${w} ${h}"
     xmlns="http://www.w3.org/2000/svg"
     overflow="visible">
  <!-- Bayangan lembut -->
  <filter id="shadow-${type}">
    <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.5"/>
  </filter>
  <!-- Lambung kapal -->
  <polygon class="hull"
    points="${hullPoints}"
    stroke="rgba(255,255,255,0.35)"
    stroke-width="1"
    stroke-linejoin="round"
    filter="url(#shadow-${type})"/>
  <!-- Garis tengah (tiang layar) -->
  <line x1="${halfW}" y1="${h * 0.08}" x2="${halfW}" y2="${h * 0.70}"
        stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>
  <!-- Anjungan (bridge) -->
  <rect x="${bridgeLeft}" y="${bridgeTop}"
        width="${bridgeRight - bridgeLeft}" height="${bridgeBot - bridgeTop}"
        rx="1.5"
        fill="rgba(255,255,255,0.25)"
        stroke="rgba(255,255,255,0.5)"
        stroke-width="0.7"/>
</svg>`;
}

/**
 * Membuat Leaflet DivIcon dari SVG siluet kapal.
 */
function createShipIcon(ship) {
  const { w, h } = SHIP_SIZES[ship.type] || SHIP_SIZES.ferry;
  return L.divIcon({
    className: 'custom-ship-marker',
    html: `<div class="ship-marker-wrapper" title="${ship.name} (${ship.heading}°)">
             ${buildShipSVG(ship.type, ship.heading)}
           </div>`,
    iconSize:    [w, h],
    iconAnchor:  [w / 2, h / 2],
    popupAnchor: [0, -(h / 2 + 6)]
  });
}

/* ─── 3. Konten Popup ──────────────────────────────────────────────────── */
function createPopupContent(ship) {
  return `
<div class="ship-popup">
  <div class="popup-header">
    <div class="popup-title">${ship.name}</div>
    <span class="popup-badge ${ship.type}">${ship.type.toUpperCase()}</span>
  </div>
  <div class="popup-divider"></div>
  <div class="popup-row">
    <span class="popup-row-label">MMSI</span>
    <span class="popup-row-value">${ship.mmsi}</span>
  </div>
  <div class="popup-row">
    <span class="popup-row-label">Kecepatan</span>
    <span class="popup-row-value">${ship.speed} kn</span>
  </div>
  <div class="popup-row">
    <span class="popup-row-label">Heading</span>
    <span class="popup-row-value">${ship.heading}°</span>
  </div>
  <div class="popup-row">
    <span class="popup-row-label">Lat / Lon</span>
    <span class="popup-row-value">${ship.lat.toFixed(4)}, ${ship.lon.toFixed(4)}</span>
  </div>
</div>`;
}

/* ─── 4. Trail (Jejak Polyline) ───────────────────────────────────────── */
/**
 * Tambahkan posisi baru ke jejak kapal dan gambar polyline pendek.
 * Maksimal TRAIL_MAX titik disimpan — titik lama dihapus secara FIFO.
 */
function updateTrail(mmsi, lat, lon, type) {
  const obj = markersMap.get(mmsi);
  if (!obj) return;

  // Simpan riwayat posisi (max TRAIL_MAX titik)
  if (!obj.history) obj.history = [];
  obj.history.push([lat, lon]);
  if (obj.history.length > TRAIL_MAX) obj.history.shift();

  // Hapus polyline lama
  if (obj.trail) map.removeLayer(obj.trail);

  // Gambar polyline baru jika sudah punya ≥2 titik
  if (obj.history.length >= 2) {
    obj.trail = L.polyline(obj.history, {
      className: `ship-trail-${type}`,
      weight: 1.5,
      opacity: 0.7,
      dashArray: '4 3'
    }).addTo(map);
  }
}

/* ─── 5. Update Marker di Peta ────────────────────────────────────────── */
function updateMapMarkers(ships) {
  ships.forEach((ship) => {
    const visible = activeFilters.has(ship.type);

    if (markersMap.has(ship.mmsi)) {
      const obj = markersMap.get(ship.mmsi);

      if (visible) {
        // Marker sudah ada & harus terlihat: update posisi + rotasi
        obj.marker.setLatLng([ship.lat, ship.lon]);
        const el = obj.marker.getElement();
        if (el) {
          const svg = el.querySelector('.ship-icon-svg');
          if (svg) svg.style.transform = `rotate(${ship.heading}deg)`;
        }
        obj.marker.setPopupContent(createPopupContent(ship));
        obj.data = ship;

        // Tampilkan marker & trail jika sebelumnya tersembunyi
        if (!map.hasLayer(obj.marker)) obj.marker.addTo(map);
        updateTrail(ship.mmsi, ship.lat, ship.lon, ship.type);
      } else {
        // Sembunyikan marker & trail
        if (map.hasLayer(obj.marker)) map.removeLayer(obj.marker);
        if (obj.trail && map.hasLayer(obj.trail)) map.removeLayer(obj.trail);
      }
    } else {
      // Marker baru: buat dan tambahkan ke peta
      const icon   = createShipIcon(ship);
      const marker = L.marker([ship.lat, ship.lon], { icon });
      marker.bindPopup(createPopupContent(ship));
      marker.on('click', () => focusShip(ship.mmsi));

      // Simpan ke map state (dengan history kosong)
      markersMap.set(ship.mmsi, { marker, trail: null, history: [], data: ship });

      if (visible) {
        marker.addTo(map);
        updateTrail(ship.mmsi, ship.lat, ship.lon, ship.type);
      }
    }
  });
}

/* ─── 6. Render Sidebar ───────────────────────────────────────────────── */
function renderShipList(ships) {
  const container = document.getElementById('shipListContainer');
  if (!container) return;
  const scrollTop = container.scrollTop;

  // Hanya tampilkan kapal yang tipenya aktif di filter
  const filtered = ships.filter((s) => activeFilters.has(s.type));

  // Update counter di header
  const totalEl = document.getElementById('totalShips');
  if (totalEl) totalEl.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-40 gap-2 text-center px-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p class="text-xs text-slate-500">Tidak ada kapal yang sesuai filter</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map((ship) => {
    const isActive = ship.mmsi === currentSelectedMmsi ? 'active' : '';
    return `
<div class="ship-card ${isActive}" data-mmsi="${ship.mmsi}">
  <div class="card-top">
    <div class="card-name" title="${ship.name}">${ship.name}</div>
    <span class="card-tag ${ship.type}">${ship.type}</span>
  </div>
  <div class="card-meta">
    <span class="icon-label">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
      ${ship.speed} kn
    </span>
    <span class="icon-label">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      ${ship.heading}°
    </span>
    <span style="color:#374151">MMSI …${ship.mmsi.slice(-4)}</span>
  </div>
</div>`;
  }).join('');

  container.scrollTop = scrollTop;

  // Event klik tiap card
  container.querySelectorAll('.ship-card').forEach((card) => {
    card.addEventListener('click', () => focusShip(card.getAttribute('data-mmsi')));
  });
}

/* ─── 7. Fokus ke Kapal ───────────────────────────────────────────────── */
function focusShip(mmsi) {
  currentSelectedMmsi = mmsi;
  const obj = markersMap.get(mmsi);
  if (obj && map.hasLayer(obj.marker)) {
    map.panTo(obj.marker.getLatLng(), { animate: true, duration: 0.7 });
    obj.marker.openPopup();
  }
  document.querySelectorAll('.ship-card').forEach((card) => {
    const isThis = card.getAttribute('data-mmsi') === mmsi;
    card.classList.toggle('active', isThis);
    if (isThis) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

/* ─── 8. Filter Logika ────────────────────────────────────────────────── */
document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const type = btn.getAttribute('data-filter');
    if (activeFilters.has(type)) {
      activeFilters.delete(type);
      btn.classList.remove('active');
    } else {
      activeFilters.add(type);
      btn.classList.add('active');
    }
    // Re-render peta & sidebar dengan filter baru (gunakan data terakhir dari state)
    const allShips = [...markersMap.values()].map((o) => o.data).filter(Boolean);
    updateMapMarkers(allShips);
    renderShipList(allShips);
  });
});

/* ─── 9. Socket.io — Terima Data Real-time ────────────────────────────── */
const socket = io();

socket.on('ships:update', (ships) => {
  // Sembunyikan loading state saat data pertama masuk
  const loadingEl = document.getElementById('loadingState');
  if (loadingEl) loadingEl.remove();

  // Update waktu di header
  const lastUpdatedEl = document.getElementById('lastUpdated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = new Date().toLocaleTimeString('id-ID');
  }

  // Auto-fit peta saat data pertama diterima
  if (!fitted && ships.length) {
    map.fitBounds(ships.map((s) => [s.lat, s.lon]), { padding: [60, 60] });
    fitted = true;
  }

  updateMapMarkers(ships);
  renderShipList(ships);
});

/* ─── 10. Toggle Sidebar ──────────────────────────────────────────────── */
const sidebar      = document.getElementById('sidebar');
const toggleBtn    = document.getElementById('toggleSidebar');
const openBtn      = document.getElementById('openSidebarBtn');
const toggleIcon   = document.getElementById('toggleIcon');

function collapseSidebar() {
  sidebar.classList.add('collapsed');
  openBtn.classList.remove('hidden');
  openBtn.style.display = 'flex';
}
function expandSidebar() {
  sidebar.classList.remove('collapsed');
  openBtn.classList.add('hidden');
  openBtn.style.display = 'none';
}

if (toggleBtn)  toggleBtn.addEventListener('click', collapseSidebar);
if (openBtn)    openBtn.addEventListener('click', expandSidebar);

/* ─── 11. Marker Pelabuhan Tanjung Perak (PostgreSQL /api/ports) ──────── */
const portMarkersLayer = L.layerGroup().addTo(map);

async function loadPortMarkers() {
  try {
    const res = await fetch('/api/ports');
    if (!res.ok) return;
    const json = await res.json();
    const ports = json.data || [];

    ports.forEach((port) => {
      const lat = parseFloat(port.lat);
      const lon = parseFloat(port.lon);
      if (isNaN(lat) || isNaN(lon)) return;

      const portIcon = L.divIcon({
        className: 'port-marker-wrapper',
        html: `
          <div class="port-marker-pin" title="${port.name}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="5" r="3"/>
              <line x1="12" y1="8" x2="12" y2="22"/>
              <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });

      const marker = L.marker([lat, lon], { icon: portIcon });
      marker.bindPopup(`
        <div class="p-2 min-w-[200px]">
          <div class="flex items-center gap-2 mb-1.5 pb-1 border-b border-white/10">
            <span class="text-base">⚓</span>
            <div>
              <div class="text-xs font-bold text-sky-400">${port.name}</div>
              <div class="text-[9px] text-slate-400">Pelabuhan / Terminal</div>
            </div>
          </div>
          <div class="text-[11px] text-slate-300 space-y-0.5">
            <div><span class="text-slate-400">Latitude:</span> ${lat.toFixed(4)}°</div>
            <div><span class="text-slate-400">Longitude:</span> ${lon.toFixed(4)}°</div>
          </div>
          <div class="mt-2 pt-1 border-t border-white/5 text-[9px] text-emerald-400/90 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            PostgreSQL: tabel ports (ID #${port.id})
          </div>
        </div>
      `);
      portMarkersLayer.addLayer(marker);
    });
  } catch (err) {
    console.warn('Gagal memuat data pelabuhan:', err);
  }
}

loadPortMarkers();
