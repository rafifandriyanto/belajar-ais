/**
 * fleet.js — marker kapal di peta + daftar armada di sidebar.
 * Sidebar di-update per baris (keyed), bukan rebuild innerHTML tiap tick;
 * event klik pakai delegation; trail pakai satu polyline per kapal.
 */

import { escapeHtml, fmtCoord, TYPE_COLORS } from './util.js';

const SHIP_SIZES = {
  ferry: { w: 18, h: 40 },
  cargo: { w: 16, h: 50 },
  tanker: { w: 18, h: 50 },
  tug: { w: 20, h: 28 },
};
const TRAIL_MAX = 6;
const ALL_TYPES = ['ferry', 'cargo', 'tanker', 'tug'];

/** SVG siluet kapal tampak atas — ID filter unik per MMSI (bukan per tipe). */
function buildShipSVG(type, heading, mmsi) {
  const { w, h } = SHIP_SIZES[type] || SHIP_SIZES.ferry;
  const halfW = w / 2;
  const hullPoints = [
    `${halfW},1`,
    `${w - 1},${h * 0.35}`,
    `${w - 1},${h * 0.72}`,
    `${w * 0.85},${h - 1}`,
    `${w * 0.15},${h - 1}`,
    `1,${h * 0.72}`,
    `1,${h * 0.35}`,
  ].join(' ');

  const bTop = h * 0.28;
  const bBot = h * 0.5;
  const bLeft = halfW - w * 0.22;
  const bRight = halfW + w * 0.22;

  return `
<svg class="ship-icon-svg ${type}" data-mmsi="${mmsi}"
     style="transform:rotate(${heading}deg); width:${w}px; height:${h}px;"
     viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" overflow="visible">
  <filter id="sh-${mmsi}">
    <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.5"/>
  </filter>
  <polygon class="hull ${type}" points="${hullPoints}"
    stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-linejoin="round"
    filter="url(#sh-${mmsi})"/>
  <line x1="${halfW}" y1="${h * 0.08}" x2="${halfW}" y2="${h * 0.7}"
        stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>
  <rect x="${bLeft}" y="${bTop}" width="${bRight - bLeft}" height="${bBot - bTop}"
        rx="1.5" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" stroke-width="0.7"/>
</svg>`;
}

function popupHtml(ship) {
  const moored = ship.status === 'moored';
  return `
<div class="popup-title">${escapeHtml(ship.name)}</div>
<span class="popup-type ${escapeHtml(ship.type)}">${escapeHtml(ship.type)}${moored ? ' · MOORED' : ''}</span>
<div class="popup-divider"></div>
<div class="popup-row"><span class="popup-row-label">MMSI</span><span class="popup-row-value">${escapeHtml(ship.mmsi)}</span></div>
<div class="popup-row"><span class="popup-row-label">Status</span><span class="popup-row-value ${moored ? 'moored' : 'ok'}">${moored ? 'MOORED' : 'UNDERWAY'}</span></div>
<div class="popup-row"><span class="popup-row-label">Kecepatan</span><span class="popup-row-value">${Number(ship.speed).toFixed(1)} kn</span></div>
<div class="popup-row"><span class="popup-row-label">Heading</span><span class="popup-row-value">${ship.heading}°</span></div>
<div class="popup-row"><span class="popup-row-label">Lat / Lon</span><span class="popup-row-value">${fmtCoord(ship.lat)}, ${fmtCoord(ship.lon)}</span></div>`;
}

export function createFleet(map, { onSelect }) {
  const markers = new Map(); // mmsi → {marker, trail, history, data, row, els}
  const activeFilters = new Set(ALL_TYPES);
  let selected = null;
  let selRing = null; // lingkaran aksen penanda kapal terpilih di peta
  let fitted = false;

  const listEl = document.getElementById('shipList');
  const emptyEl = document.createElement('div');
  emptyEl.className = 'state-box';
  emptyEl.style.display = 'none';
  emptyEl.innerHTML = '<span>Tidak ada kapal yang sesuai filter</span>';
  listEl.appendChild(emptyEl);

  // Event delegation: satu listener untuk seluruh daftar (klik + keyboard)
  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('.ship-row');
    if (row) onSelect(row.dataset.mmsi);
  });
  listEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.ship-row');
    if (row) {
      e.preventDefault();
      onSelect(row.dataset.mmsi);
    }
  });

  function makeRow(ship) {
    const row = document.createElement('div');
    row.className = 'ship-row';
    row.dataset.mmsi = ship.mmsi;
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-label', `${ship.name}, ${ship.type}, MMSI ${ship.mmsi}`);
    // Entrance stagger hanya saat baris pertama kali dibuat
    row.style.animationDelay = `${Math.min(markers.size * 35, 315)}ms`;
    row.innerHTML = `
      <div class="ship-row-top">
        <span class="ship-name" title="${escapeHtml(ship.name)}">${escapeHtml(ship.name)}</span>
        <span class="type-tag ${escapeHtml(ship.type)}">${escapeHtml(ship.type)}</span>
      </div>
      <div class="ship-row-meta">
        <span class="status-dot" data-el="dot"></span>
        <span data-el="speed"></span>
        <span data-el="heading"></span>
        <span data-el="status"></span>
        <span class="mmsi">…${escapeHtml(ship.mmsi.slice(-4))}</span>
      </div>`;
    listEl.appendChild(row);
    return {
      row,
      els: {
        dot: row.querySelector('[data-el="dot"]'),
        speed: row.querySelector('[data-el="speed"]'),
        heading: row.querySelector('[data-el="heading"]'),
        status: row.querySelector('[data-el="status"]'),
      },
    };
  }

  function makeMarker(ship) {
    const { w, h } = SHIP_SIZES[ship.type] || SHIP_SIZES.ferry;
    const icon = L.divIcon({
      className: 'custom-ship-marker',
      html: `<div class="ship-marker-wrapper">${buildShipSVG(ship.type, ship.heading, ship.mmsi)}</div>`,
      iconSize: [w, h],
      iconAnchor: [w / 2, h / 2],
      popupAnchor: [0, -(h / 2 + 6)],
    });
    const marker = L.marker([ship.lat, ship.lon], { icon });
    marker.bindPopup(popupHtml(ship));
    marker.on('click', () => onSelect(ship.mmsi));

    const trail = L.polyline([], {
      color: TYPE_COLORS[ship.type] || TYPE_COLORS.ferry,
      weight: 1.5,
      opacity: 0.65,
      dashArray: '4 3',
      className: 'ship-trail',
    });

    return { marker, trail };
  }

  function setVisible(obj, visible) {
    if (visible) {
      if (!map.hasLayer(obj.marker)) obj.marker.addTo(map);
      if (obj.history.length >= 2 && !map.hasLayer(obj.trail)) obj.trail.addTo(map);
      obj.row.classList.remove('hidden');
    } else {
      if (map.hasLayer(obj.marker)) map.removeLayer(obj.marker);
      if (map.hasLayer(obj.trail)) map.removeLayer(obj.trail);
      obj.row.classList.add('hidden');
      if (obj.data.mmsi === selected && selRing) {
        map.removeLayer(selRing);
        selRing = null;
      }
    }
  }

  function update(ships) {
    // Fit hanya bila ukuran peta sudah valid (hindari fit saat container 0px)
    if (!fitted && ships.length) {
      const size = map.getSize();
      if (size.x > 0 && size.y > 0) {
        map.fitBounds(ships.map((s) => [s.lat, s.lon]), { padding: [60, 60] });
        fitted = true;
      }
    }

    const seen = new Set();
    let visibleCount = 0;

    for (const ship of ships) {
      seen.add(ship.mmsi);
      const visible = activeFilters.has(ship.type);
      if (visible) visibleCount++;

      let obj = markers.get(ship.mmsi);
      if (!obj) {
        const { marker, trail } = makeMarker(ship);
        const { row, els } = makeRow(ship);
        obj = { marker, trail, history: [], data: ship, row, els };
        markers.set(ship.mmsi, obj);
      }
      obj.data = ship;

      if (visible) {
        obj.marker.setLatLng([ship.lat, ship.lon]);
        const svg = obj.marker.getElement()?.querySelector('.ship-icon-svg');
        if (svg) {
          svg.style.transform = `rotate(${ship.heading}deg)`;
          svg.classList.toggle('moored', ship.status === 'moored');
        }
        if (obj.marker.isPopupOpen()) obj.marker.setPopupContent(popupHtml(ship));

        obj.history.push([ship.lat, ship.lon]);
        if (obj.history.length > TRAIL_MAX) obj.history.shift();
        obj.trail.setLatLngs(obj.history);

        // Update teks baris sidebar hanya bila berubah
        const speedTxt = `${Number(ship.speed).toFixed(1)} kn`;
        const headTxt = `${ship.heading}°`;
        const statusTxt = ship.status === 'moored' ? 'MOORED' : '';
        if (obj.els.speed.textContent !== speedTxt) obj.els.speed.textContent = speedTxt;
        if (obj.els.heading.textContent !== headTxt) obj.els.heading.textContent = headTxt;
        if (obj.els.status.textContent !== statusTxt) {
          obj.els.status.textContent = statusTxt;
          obj.els.status.classList.toggle('moored', !!statusTxt);
          obj.els.dot.classList.toggle('moored', !!statusTxt);
        }

        // Ring kapal terpilih mengikuti posisi live
        if (ship.mmsi === selected && selRing) selRing.setLatLng([ship.lat, ship.lon]);
      }
      setVisible(obj, visible);
    }

    // Kapal yang hilang dari feed (tidak terjadi di simulasi ini, tapi aman)
    for (const [mmsi, obj] of markers) {
      if (!seen.has(mmsi)) {
        map.removeLayer(obj.marker);
        map.removeLayer(obj.trail);
        obj.row.remove();
        markers.delete(mmsi);
      }
    }

    emptyEl.style.display = visibleCount === 0 ? 'flex' : 'none';
    document.getElementById('sidebarCount').textContent = visibleCount;
    return visibleCount;
  }

  function toggleFilter(type) {
    if (activeFilters.has(type)) activeFilters.delete(type);
    else activeFilters.add(type);
    const all = [...markers.values()].map((o) => o.data);
    return update(all);
  }

  function setSelected(mmsi) {
    selected = mmsi;
    for (const [key, obj] of markers) {
      obj.row.classList.toggle('selected', key === mmsi);
    }
    if (selRing) { map.removeLayer(selRing); selRing = null; }
    const obj = markers.get(mmsi);
    if (obj && map.hasLayer(obj.marker)) {
      selRing = L.circleMarker(obj.marker.getLatLng(), {
        radius: 18,
        color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3fd8c7',
        weight: 1.5, opacity: 0.9,
        fill: false, dashArray: '3 3', interactive: false,
      }).addTo(map);
      map.panTo(obj.marker.getLatLng(), { animate: true, duration: 0.6 });
      // Popup dibuka setelah peta selesai bergerak (pan / fitBounds riwayat),
      // supaya autoPan Leaflet tidak terpotong topbar atau panel.
      setTimeout(() => {
        if (selected === mmsi && map.hasLayer(obj.marker)) obj.marker.openPopup();
      }, 700);
      obj.row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  const getName = (mmsi) => markers.get(mmsi)?.data?.name || mmsi;
  const getSelected = () => selected;

  return { update, toggleFilter, setSelected, getName, getSelected };
}