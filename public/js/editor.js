/** editor.js — Form kapal + gambar rute dengan klik peta.
 * Dialog non-modal (show, bukan showModal) supaya peta tetap bisa diklik
 * saat form terbuka; posisi dialog di kiri agar area peta bebas. */
export function createEditor(map, { onSaved }) {
  const dlg = document.getElementById('editorDialog');
  const form = document.getElementById('editorForm');
  const err = document.getElementById('edErr');
  const count = document.getElementById('edRouteCount');
  let points = [];
  let layers = [];
  let editing = null;
  let handler = null;
  let onKey = null;

  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3fd8c7';
  function redraw() {
    layers.forEach((l) => map.removeLayer(l));
    layers = [];
    const c = accent();
    points.forEach((p) => {
      layers.push(L.circleMarker(p, { radius: 5, color: c, weight: 1.5, fillColor: c, fillOpacity: 0.35, interactive: false }).addTo(map));
    });
    if (points.length >= 2) layers.push(L.polyline(points, { color: c, weight: 1.5, dashArray: '5 4', interactive: false }).addTo(map));
    count.textContent = `${points.length} titik, klik peta untuk menambah waypoint`;
  }
  function fill(s) {
    document.getElementById('editorTitle').textContent = s ? 'EDIT KAPAL' : 'TAMBAH KAPAL';
    document.getElementById('edName').value = s?.name || '';
    document.getElementById('edMmsi').value = s?.mmsi || '';
    document.getElementById('edMmsi').disabled = !!s;
    document.getElementById('edType').value = s?.type || 'cargo';
    document.getElementById('edSpeed').value = s?.speedKn ?? 12;
    document.getElementById('edDwell').value = s?.dwellSeconds ?? 20;
    document.getElementById('edDest').value = s?.destination || '';
    document.getElementById('edImo').value = s?.imo || '';
    document.getElementById('edCall').value = s?.callSign || '';
    document.getElementById('edFlag').value = s?.flag || '';
    document.getElementById('edLen').value = s?.lengthM ?? '';
    document.getElementById('edBeam').value = s?.beamM ?? '';
  }
  function cleanup() {
    if (handler) map.off('click', handler);
    handler = null;
    if (onKey) document.removeEventListener('keydown', onKey);
    onKey = null;
    layers.forEach((l) => map.removeLayer(l));
    layers = [];
  }
  function open(ship) {
    cleanup(); // buka ulang saat dialog masih terbuka: jangan tumpuk handler
    editing = ship || null;
    points = ship?.route ? ship.route.map((p) => [p[0], p[1]]) : [];
    fill(ship);
    err.hidden = true;
    if (!dlg.open) dlg.show();
    handler = (e) => { points.push([Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]); redraw(); };
    map.on('click', handler);
    // Dialog non-modal tidak menerima cancel native: Esc harus menutup manual
    onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    redraw();
  }
  function close() {
    cleanup();
    dlg.close();
  }
  // Penutupan native dialog tetap membersihkan layer peta
  dlg.addEventListener('close', cleanup);
  document.getElementById('editorClose').addEventListener('click', close);
  document.getElementById('edUndo').addEventListener('click', () => { points.pop(); redraw(); });
  document.getElementById('edClear').addEventListener('click', () => { points = []; redraw(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const num = (id) => { const v = document.getElementById(id).value; return v === '' ? undefined : Number(v); };
    const payload = {
      name: document.getElementById('edName').value,
      mmsi: document.getElementById('edMmsi').value,
      type: document.getElementById('edType').value,
      speedKn: num('edSpeed'),
      dwellSeconds: num('edDwell'),
      destination: document.getElementById('edDest').value || undefined,
      imo: document.getElementById('edImo').value || undefined,
      callSign: document.getElementById('edCall').value || undefined,
      flag: document.getElementById('edFlag').value || undefined,
      lengthM: num('edLen'),
      beamM: num('edBeam'),
      route: points,
    };
    const r = await fetch(editing ? `/api/ships/${editing.mmsi}` : '/api/ships', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) { err.textContent = j?.message || 'Gagal menyimpan kapal'; err.hidden = false; return; }
    close();
    onSaved(j.data);
  });
  return { open, close };
}