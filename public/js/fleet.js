/**
 * fleet.js — marker kapal di peta + daftar armada di sidebar.
 * Sidebar di-update per baris (keyed), bukan rebuild innerHTML tiap tick;
 * event klik pakai delegation; trail pakai satu polyline per kapal.
 */

import { escapeHtml, TYPE_COLORS, matchShip } from './util.js';
const typeColor = (t) => ({ ferry:'bg-sky-500/20 text-sky-300', cargo:'bg-amber-500/20 text-amber-300', tanker:'bg-rose-500/20 text-rose-300', tug:'bg-emerald-500/20 text-emerald-300' }[t] || 'bg-slate-500/20 text-slate-300');
const TYPE_ICONS = {
  ferry: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4a11.6 11.6 0 0 0 1.62 6"/><path d="M12 10V2"/></svg>`,
  cargo: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="11" rx="1"/><path d="M3 11h18"/><path d="M7 7V4h10v3"/></svg>`,
  tanker: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M6 20V10l6-6 6 6v10"/><path d="M10 20v-4h4v4"/></svg>`,
  tug: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18"/><path d="M5 17V9l4-4 4 4v8"/><path d="M13 17V7l3-3 3 3v10"/></svg>`,
};
const typeIcon = (t) => TYPE_ICONS[t] || '';

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

export function createFleet(map, { onSelect, favorites, onToggleFav }) {
  const markers = new Map(); // mmsi → {marker, trail, history, data, row, els}
  const activeFilters = new Set(ALL_TYPES);
  let selected = null;
  let selRing = null; // lingkaran aksen penanda kapal terpilih di peta
  let fitted = false;
  let query = '';
  let favFilter = false;
  let kbdIndex = -1;

  const listEl = document.getElementById('shipList');
  const emptyEl = document.createElement('div');
  emptyEl.className = 'state-box';
  emptyEl.style.display = 'none';
  emptyEl.innerHTML = '<span>Tidak ada kapal yang sesuai filter</span>';
  listEl.appendChild(emptyEl);

  // Event delegation: satu listener untuk seluruh daftar.
  // Baris memakai <button> asli, jadi Enter/Space ditangani browser.
  listEl.addEventListener('click', (e) => {
    const star = e.target.closest('.fav-star');
    if (star) {
      const row = star.closest('.ship-row');
      if (row) onToggleFav(row.dataset.mmsi);
      return;
    }
    const open = e.target.closest('.ship-open');
    if (open) onSelect(open.closest('.ship-row').dataset.mmsi);
  });

  function makeRow(ship) {
    const row = document.createElement('div');
    row.className = 'ship-row';
    row.dataset.mmsi = ship.mmsi;
    // Entrance stagger hanya saat baris pertama kali dibuat
    row.style.animationDelay = `${Math.min(markers.size * 35, 315)}ms`;
    row.innerHTML = `
      <button class="ship-open flex w-full flex-col gap-1 rounded px-2 py-1.5 text-left hover:bg-slate-800" type="button" aria-expanded="false" aria-controls="detailDrawer"
              aria-label="${escapeHtml(ship.name)}, ${escapeHtml(ship.type)}, MMSI ${escapeHtml(ship.mmsi)}">
        <span class="flex min-w-0 items-center justify-between gap-2">
          <span class="truncate font-medium" title="${escapeHtml(ship.name)}">${escapeHtml(ship.name)}</span>
          <span class="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${typeColor(ship.type)}">${typeIcon(ship.type)} ${escapeHtml(ship.type)}</span>
        </span>
        <span class="flex items-center gap-2 text-xs text-slate-400">
          <span class="status-dot" data-el="dot"></span>
          <span data-el="speed"></span>
          <span data-el="heading"></span>
          <span data-el="status"></span>
          <span class="ml-auto font-mono">…${escapeHtml(ship.mmsi.slice(-4))}</span>
        </span>
      </button>
      <button class="fav-star rounded p-1 text-slate-400 hover:text-amber-300" data-el="fav" aria-pressed="false" title="Favorit" aria-label="Favoritkan ${escapeHtml(ship.name)}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9"/></svg>
      </button>`;
    listEl.appendChild(row);
    return {
      row,
      els: {
        open: row.querySelector('.ship-open'),
        dot: row.querySelector('[data-el="dot"]'),
        speed: row.querySelector('[data-el="speed"]'),
        heading: row.querySelector('[data-el="heading"]'),
        status: row.querySelector('[data-el="status"]'),
        fav: row.querySelector('[data-el="fav"]'),
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
    marker.on('click', () => onSelect(ship.mmsi));
    marker.on('add', () => {
      const el = marker.getElement();
      if (el) el.setAttribute('aria-label', `${ship.name}, ${ship.type}, MMSI ${ship.mmsi}`);
    });

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
      const visible = activeFilters.has(ship.type) && (!favFilter || favorites?.has(ship.mmsi)) && matchShip(ship, query);
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
        if (obj.marker.isPopupOpen()) obj.marker.closePopup();

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

        // Sinkron bintang favorit
        const isFav = !!favorites?.has(ship.mmsi);
        obj.els.fav.classList.toggle('on', isFav);
        obj.els.fav.setAttribute('aria-pressed', String(isFav));

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
        if (mmsi === selected) {
          selected = null;
          if (selRing) { map.removeLayer(selRing); selRing = null; }
        }
      }
    }

    if (visibleCount === 0) {
      emptyEl.innerHTML = query ? '<span>Tidak ada kapal yang cocok dengan pencarian</span>' : '<span>Tidak ada kapal yang sesuai filter</span>';
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
      const isSelected = key === mmsi;
      obj.row.classList.toggle('selected', isSelected);
      obj.els.open.setAttribute('aria-expanded', String(isSelected));
    }
    if (selRing) { map.removeLayer(selRing); selRing = null; }
    const obj = markers.get(mmsi);
    if (obj && map.hasLayer(obj.marker)) {
      selRing = L.circleMarker(obj.marker.getLatLng(), {
        radius: 18,
        color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3fd8c7',
        weight: 1.5, opacity: 0.9,
        fill: false, dashArray: '3 3', interactive: false,
        className: 'sel-ring',
      }).addTo(map);
      map.panTo(obj.marker.getLatLng(), { animate: true, duration: 0.6 });
      obj.row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  const getName = (mmsi) => markers.get(mmsi)?.data?.name || mmsi;
  const getSelected = () => selected;
  const getShip = (mmsi) => markers.get(mmsi)?.data;

  const allData = () => [...markers.values()].map((o) => o.data);
  const visibleRows = () => [...markers.values()].filter((o) => !o.row.classList.contains('hidden')).map((o) => o.row);
  function clearKbdClassOnly() { listEl.querySelectorAll('.kbd-active').forEach((r) => r.classList.remove('kbd-active')); }
  function clearKbd() { kbdIndex = -1; clearKbdClassOnly(); }
  function setSearch(q) { query = q; clearKbd(); return update(allData()); }
  function setFavFilter(on) { favFilter = on; return update(allData()); }
  function moveKbd(delta) {
    const rows = visibleRows();
    if (!rows.length) return;
    kbdIndex = Math.min(Math.max(kbdIndex + delta, 0), rows.length - 1);
    clearKbdClassOnly();
    rows[kbdIndex].classList.add('kbd-active');
    rows[kbdIndex].scrollIntoView({ block: 'nearest' });
  }
  function selectKbd() {
    const rows = visibleRows();
    if (!rows.length) return;
    if (kbdIndex < 0) kbdIndex = 0;
    const row = rows[Math.min(kbdIndex, rows.length - 1)];
    if (row) onSelect(row.dataset.mmsi);
  }

  return { update, toggleFilter, setSelected, getName, getSelected, getShip, setSearch, setFavFilter, moveKbd, selectKbd, clearKbd };
}