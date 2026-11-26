/** map.js — inisialisasi Leaflet, tema gelap/terang, marker pelabuhan. */

import { escapeHtml, fmtCoord } from './util.js';

const MAP_CENTER = [-7.185, 112.738];
const MAP_ZOOM = 13;

export function initMap() {
  const map = L.map('map', {
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    zoomControl: false,
  });
  L.control.zoom({ position: 'topleft' }).addTo(map);

  // OSM standar (gratis, tanpa API key) — di-darken via CSS filter
  const tileOSM = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    className: 'tile-osm',
  }).addTo(map);

  const tileSat = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: '&copy; <a href="https://www.esri.com/">Esri</a>', maxZoom: 18 },
  );

  L.control.layers({ 'Peta Standar (OSM)': tileOSM, 'Citra Satelit': tileSat }, null, {
    position: 'bottomleft',
  }).addTo(map);

  // Strip status konsol: koordinat kursor, zoom, jam UTC, datum
  const statusEl = L.DomUtil.create('div', 'flex items-center gap-2 rounded bg-slate-900/80 px-2 py-1 font-mono text-xs text-slate-200');
  statusEl.innerHTML = `
    <span>POS <b data-el="pos">--</b></span><span class="text-slate-500">|</span>
    <span>Z <b data-el="zoom">${MAP_ZOOM}</b></span><span class="text-slate-500">|</span>
    <span><b data-el="clock">--:--:--</b> UTC</span><span class="text-slate-500">|</span>
    <span>WGS-84</span>`;
  L.DomEvent.disableClickPropagation(statusEl);
  const StatusControl = L.Control.extend({ onAdd: () => statusEl });
  new StatusControl({ position: 'bottomright' }).addTo(map);

  const posEl = statusEl.querySelector('[data-el="pos"]');
  const zoomEl = statusEl.querySelector('[data-el="zoom"]');
  const clockEl = statusEl.querySelector('[data-el="clock"]');
  const fmtPos = (ll) => `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
  posEl.textContent = fmtPos(map.getCenter());
  map.on('mousemove', (e) => { posEl.textContent = fmtPos(e.latlng); });
  map.on('mouseout', () => { posEl.textContent = fmtPos(map.getCenter()); });
  map.on('zoomend', () => { zoomEl.textContent = map.getZoom(); });
  const tickClock = () => { clockEl.textContent = new Date().toISOString().slice(11, 19); };
  tickClock();
  setInterval(tickClock, 1000);

  const mapEl = document.getElementById('map');
  const setDark = (on) => mapEl.classList.toggle('map-dark', on);

  async function loadPorts() {
    try {
      const res = await fetch('/api/ports');
      if (!res.ok) return;
      const json = await res.json();
      const layer = L.layerGroup().addTo(map);

      for (const port of json.data || []) {
        const lat = parseFloat(port.lat);
        const lon = parseFloat(port.lon);
        if (isNaN(lat) || isNaN(lon)) continue;

        const icon = L.divIcon({
          className: 'port-marker-wrapper',
          html: `<div class="port-marker-pin" title="${escapeHtml(port.name)}">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <circle cx="12" cy="5" r="3"/>
                     <line x1="12" y1="8" x2="12" y2="22"/>
                     <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
                   </svg>
                 </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        L.marker([lat, lon], { icon })
          .bindPopup(`
            <div class="popup-title">${escapeHtml(port.name)}</div>
            <div class="popup-type ferry">PELABUHAN / TERMINAL</div>
            <div class="popup-divider"></div>
            <div class="popup-row"><span class="popup-row-label">Latitude</span><span class="popup-row-value">${fmtCoord(lat)}°</span></div>
            <div class="popup-row"><span class="popup-row-label">Longitude</span><span class="popup-row-value">${fmtCoord(lon)}°</span></div>
          `)
          .addTo(layer);
      }
    } catch (err) {
      console.warn('Gagal memuat pelabuhan:', err);
    }
  }

  return { map, setDark, loadPorts };
}