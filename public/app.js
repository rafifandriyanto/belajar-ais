/**
 * app.js - Logika Frontend Dashboard Monitoring Kapal AIS
 * Leaflet.js map, polling 2 detik, marker rotasi SVG, & interaksi detail.
 */

// Konfigurasi Awal
const MAP_CENTER = [-7.1850, 112.7380]; // Pusat: Selat Madura & Tanjung Perak
const MAP_ZOOM = 13;
const POLLING_INTERVAL_MS = 2000;

// Penyimpanan referensi marker kapal (key: MMSI)
const markersMap = new Map();
let currentSelectedMmsi = null;

// 1. Inisialisasi Peta Leaflet
const map = L.map('map', {
  center: MAP_CENTER,
  zoom: MAP_ZOOM,
  zoomControl: false
});

// Kontrol zoom di pojok kiri atas
L.control.zoom({ position: 'topleft' }).addTo(map);

// Tile Layer CartoDB Voyager (tampilan nautikal bersih dan kontras tinggi untuk perairan)
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

// 2. Fungsi Membuat SVG Icon Kapal dengan Orientasi Arah (Heading)
function createShipIcon(ship) {
  const svgHtml = `
    <div class="ship-marker-wrapper" title="${ship.name} (${ship.heading}°)">
      <svg class="ship-icon-svg ${ship.type}" style="transform: rotate(${ship.heading}deg);" viewBox="0 0 32 32">
        <path class="hull-outline" d="M16 2 L25 22 L16 18 L7 22 Z" fill="rgba(0,0,0,0.6)" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
        <path class="hull" d="M16 4 L23 20.5 L16 17 L9 20.5 Z"/>
        <line x1="16" y1="6" x2="16" y2="15.5" stroke="rgba(255,255,255,0.8)" stroke-width="1.2"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'custom-ship-marker',
    html: svgHtml,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -18]
  });
}

// 3. Fungsi Membuat Konten Popup Detail Kapal
function createPopupContent(ship) {
  return `
    <div class="ship-popup">
      <div class="popup-header">
        <div class="popup-title">${ship.name}</div>
        <span class="popup-badge ${ship.type}">${ship.type}</span>
      </div>
      <div class="popup-details">
        <div class="popup-row">
          <span class="popup-row-label">MMSI:</span>
          <span class="popup-row-value">${ship.mmsi}</span>
        </div>
        <div class="popup-row">
          <span class="popup-row-label">Kecepatan:</span>
          <span class="popup-row-value">${ship.speed} knot</span>
        </div>
        <div class="popup-row">
          <span class="popup-row-label">Heading:</span>
          <span class="popup-row-value">${ship.heading}°</span>
        </div>
        <div class="popup-row">
          <span class="popup-row-label">Latitude:</span>
          <span class="popup-row-value">${ship.lat.toFixed(5)}</span>
        </div>
        <div class="popup-row">
          <span class="popup-row-label">Longitude:</span>
          <span class="popup-row-value">${ship.lon.toFixed(5)}</span>
        </div>
      </div>
    </div>
  `;
}

// 4. Render Daftar Kapal di Sidebar
function renderShipList(ships) {
  const container = document.getElementById('shipListContainer');
  if (!container) return;

  container.innerHTML = ships.map((ship) => {
    const isActive = ship.mmsi === currentSelectedMmsi ? 'active' : '';
    return `
      <div class="ship-item-card ${isActive}" data-mmsi="${ship.mmsi}">
        <div class="card-top">
          <div class="card-name" title="${ship.name}">${ship.name}</div>
          <span class="card-tag ${ship.type}">${ship.type}</span>
        </div>
        <div class="card-meta">
          <span class="card-speed">⚡ ${ship.speed} kn</span>
          <span class="card-heading">🧭 ${ship.heading}°</span>
          <span>MMSI: ${ship.mmsi.slice(-4)}</span>
        </div>
      </div>
    `;
  }).join('');

  // Pasang event klik pada tiap card kapal
  container.querySelectorAll('.ship-item-card').forEach((card) => {
    card.addEventListener('click', () => {
      const mmsi = card.getAttribute('data-mmsi');
      focusShip(mmsi);
    });
  });
}

// 5. Fungsi Fokus ke Kapal Tertentu
function focusShip(mmsi) {
  currentSelectedMmsi = mmsi;
  const markerObj = markersMap.get(mmsi);
  if (markerObj) {
    const latLng = markerObj.marker.getLatLng();
    map.panTo(latLng, { animate: true, duration: 0.8 });
    markerObj.marker.openPopup();
  }

  // Update visual kelas active pada sidebar card
  document.querySelectorAll('.ship-item-card').forEach((card) => {
    if (card.getAttribute('data-mmsi') === mmsi) {
      card.classList.add('active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      card.classList.remove('active');
    }
  });
}

// 6. Fungsi Update Marker dan Posisi Kapal di Peta
function updateMapMarkers(ships) {
  ships.forEach((ship) => {
    if (markersMap.has(ship.mmsi)) {
      // Marker sudah ada: perbarui posisi koordinat & rotasi secara mulus
      const markerObj = markersMap.get(ship.mmsi);
      const marker = markerObj.marker;
      
      marker.setLatLng([ship.lat, ship.lon]);

      // Perbarui rotasi SVG
      const markerElement = marker.getElement();
      if (markerElement) {
        const svgElement = markerElement.querySelector('.ship-icon-svg');
        if (svgElement) {
          svgElement.style.transform = `rotate(${ship.heading}deg)`;
        }
      }

      // Perbarui isi popup jika popup sedang terbuka
      marker.setPopupContent(createPopupContent(ship));
      markerObj.data = ship;
    } else {
      // Marker belum ada: buat marker baru
      const icon = createShipIcon(ship);
      const marker = L.marker([ship.lat, ship.lon], { icon }).addTo(map);
      marker.bindPopup(createPopupContent(ship));

      marker.on('click', () => {
        currentSelectedMmsi = ship.mmsi;
        focusShip(ship.mmsi);
      });

      markersMap.set(ship.mmsi, { marker, data: ship });
    }
  });
}

// 7. Polling Data Kapal dari Backend (/api/ships)
async function fetchShips() {
  try {
    const response = await fetch('/api/ships');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    const ships = json.data || [];

    // Perbarui counter & waktu update
    const totalShipsEl = document.getElementById('totalShips');
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (totalShipsEl) totalShipsEl.textContent = ships.length;
    if (lastUpdatedEl) {
      const now = new Date();
      lastUpdatedEl.textContent = now.toLocaleTimeString('id-ID');
    }

    // Perbarui posisi kapal di peta dan list sidebar
    updateMapMarkers(ships);
    renderShipList(ships);
  } catch (err) {
    console.error('Gagal mengambil data kapal AIS:', err);
  }
}

// 8. Event Listener Toggle Sidebar
const toggleBtn = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
if (toggleBtn && sidebar) {
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    toggleBtn.querySelector('.toggle-icon').textContent = isCollapsed ? '+' : '−';
  });
}

// 9. Jalankan Pemanggilan Awal & Set Polling Interval 2 Detik
fetchShips();
setInterval(fetchShips, POLLING_INTERVAL_MS);
