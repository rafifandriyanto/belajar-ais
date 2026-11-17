/**
 * scripts/verify-e2e-auth.mjs — E2E UI auth + CRUD dengan PostgreSQL nyala.
 * Register operator via UI -> tambah kapal klik peta -> live & bergerak ->
 * edit rute (reset posisi) -> hapus dua langkah -> batas operator ->
 * login admin -> tombol edit kapal seed -> logout.
 * Prasyarat: Chrome CDP 9222, server 3000, PG nyala + seed sudah jalan.
 */
import { newTab, closeTab, connect, sleep, evaluate, shot } from './cdp.mjs';

const tab = await newTab('http://localhost:3000/');
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(7000);

const clickMap = (fx, fy) => evaluate(cdp, `(() => {
  const m = document.getElementById('map'); const r = m.getBoundingClientRect();
  m.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width * ${fx}, clientY: r.top + r.height * ${fy} }));
})()`);
const getShip = (mmsi) => evaluate(cdp, `fetch('/api/ships').then(r => r.json()).then(j => j.data.find(s => s.mmsi === '${mmsi}') || null)`);
const assert = (ok, msg) => { if (!ok) throw new Error('E2E GAGAL: ' + msg); };

// 1. Register operator baru via UI
const uname = 'uiop' + (Date.now() % 100000);
await evaluate(cdp, `document.getElementById('authBtn').click()`);
await sleep(400);
await evaluate(cdp, `document.getElementById('tabRegister').click()`);
await evaluate(cdp, `(() => { document.getElementById('authUsername').value = '${uname}'; document.getElementById('authPassword').value = 'rahasia123'; })()`);
await evaluate(cdp, `document.getElementById('authSubmit').click()`);
await sleep(1500);
const topbar = await evaluate(cdp, `(() => ({
  user: document.getElementById('authUser').textContent,
  userHidden: document.getElementById('authUser').hidden,
  addHidden: document.getElementById('addShipBtn').hidden,
  outHidden: document.getElementById('logoutBtn').hidden,
  inHidden: document.getElementById('authBtn').hidden,
}))()`);
console.log('topbar setelah register:', JSON.stringify(topbar));
assert(!topbar.userHidden && topbar.user.startsWith(uname) && topbar.user.includes('operator'), 'username+role di topbar');
assert(!topbar.addHidden && !topbar.outHidden && topbar.inHidden, 'tombol mutasi muncul saat login');
await shot(cdp, 'docs/screenshots/v21-e2e-loggedin.png');

// 2. Tambah kapal via klik peta -> live tanpa reload
await evaluate(cdp, `document.getElementById('addShipBtn').click()`);
await sleep(400);
await clickMap(0.45, 0.4); await clickMap(0.5, 0.45); await clickMap(0.55, 0.5);
await sleep(400);
await evaluate(cdp, `(() => {
  document.getElementById('edName').value = 'Kapal UI E2E';
  document.getElementById('edMmsi').value = '525009002';
  document.getElementById('edType').value = 'cargo';
  document.getElementById('edSpeed').value = '12';
})()`);
await evaluate(cdp, `document.getElementById('edSubmit').click()`);
await sleep(1500);
const added = await evaluate(cdp, `(() => ({
  editorOpen: document.getElementById('editorDialog').open,
  row: !!document.querySelector('.ship-row[data-mmsi="525009002"]'),
  rowHidden: document.querySelector('.ship-row[data-mmsi="525009002"]')?.classList.contains('hidden'),
  marker: !!document.querySelector('.ship-icon-svg[data-mmsi="525009002"]'),
}))()`);
console.log('kapal baru live:', JSON.stringify(added));
assert(!added.editorOpen && added.row && !added.rowHidden && added.marker, 'row + marker muncul via fleet:update');
await shot(cdp, 'docs/screenshots/v21-e2e-newship.png');

// 3. Kapal bergerak (dua snapshot posisi berbeda)
const p1 = await getShip('525009002');
await sleep(2500);
const p2 = await getShip('525009002');
console.log('gerak:', p1.lat.toFixed(5), p1.lon.toFixed(5), '->', p2.lat.toFixed(5), p2.lon.toFixed(5));
assert(p1 && p2 && (p1.lat !== p2.lat || p1.lon !== p2.lon), 'kapal baru bergerak');

// 4. Edit rute -> posisi reset ke waypoint pertama rute baru
await evaluate(cdp, `document.querySelector('.ship-row[data-mmsi="525009002"]').click()`);
await sleep(800);
assert(await evaluate(cdp, `!!document.querySelector('.detail-drawer [data-el="edit"]')`), 'EDIT ada untuk pemilik');
await evaluate(cdp, `document.querySelector('.detail-drawer [data-el="edit"]').click()`);
await sleep(500);
console.log('rute lama di editor:', await evaluate(cdp, `document.getElementById('edRouteCount').textContent`));
await evaluate(cdp, `document.getElementById('edClear').click()`);
await clickMap(0.35, 0.35); await clickMap(0.4, 0.45);
await sleep(400);
await evaluate(cdp, `document.getElementById('edSubmit').click()`);
await sleep(1500);
const after = await getShip('525009002');
const detail = await evaluate(cdp, `fetch('/api/ships/525009002').then(r => r.json()).then(j => j.data)`);
console.log('posisi setelah edit rute:', after.lat.toFixed(5), after.lon.toFixed(5), '| rute[0]:', detail.route[0]);
assert(Math.abs(after.lat - detail.route[0][0]) < 0.001 && Math.abs(after.lon - detail.route[0][1]) < 0.001, 'posisi reset ke awal rute baru');

// 5. Hapus dua langkah
await evaluate(cdp, `document.querySelector('.detail-drawer [data-el="del"]').click()`);
await sleep(300);
const armed = await evaluate(cdp, `document.querySelector('.detail-drawer [data-el="del"]').textContent`);
console.log('langkah 1:', armed);
assert(armed.includes('YAKIN'), 'konfirmasi dua langkah');
await shot(cdp, 'docs/screenshots/v21-e2e-delete-arm.png');
await evaluate(cdp, `document.querySelector('.detail-drawer [data-el="del"]').click()`);
await sleep(1500);
const gone = await evaluate(cdp, `(() => ({
  row: !!document.querySelector('.ship-row[data-mmsi="525009002"]'),
  marker: !!document.querySelector('.ship-icon-svg[data-mmsi="525009002"]'),
  drawer: !document.querySelector('.detail-drawer').hidden,
}))()`);
console.log('setelah hapus:', JSON.stringify(gone));
assert(!gone.row && !gone.marker && !gone.drawer, 'kapal hilang dari row, marker, drawer');

// 6. Operator tidak boleh edit kapal seed
await evaluate(cdp, `document.querySelector('.ship-row[data-mmsi="525001001"]').click()`);
await sleep(800);
const seedActs = await evaluate(cdp, `(() => ({
  edit: !!document.querySelector('.detail-drawer [data-el="edit"]'),
  del: !!document.querySelector('.detail-drawer [data-el="del"]'),
}))()`);
console.log('aksi operator di kapal seed:', JSON.stringify(seedActs));
assert(!seedActs.edit && !seedActs.del, 'operator tanpa EDIT/HAPUS di kapal seed');
await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
await sleep(300);

// 7. Logout menyembunyikan tombol mutasi
await evaluate(cdp, `document.getElementById('logoutBtn').click()`);
await sleep(1000);
const out = await evaluate(cdp, `(() => ({
  userHidden: document.getElementById('authUser').hidden,
  addHidden: document.getElementById('addShipBtn').hidden,
  inHidden: document.getElementById('authBtn').hidden,
}))()`);
console.log('topbar setelah logout:', JSON.stringify(out));
assert(out.userHidden && out.addHidden && !out.inHidden, 'logout bersih');

// 8. Login admin -> EDIT/HAPUS ada di kapal seed
await evaluate(cdp, `document.getElementById('authBtn').click()`);
await sleep(400);
await evaluate(cdp, `(() => { document.getElementById('authUsername').value = 'tester1'; document.getElementById('authPassword').value = 'rahasia123'; })()`);
await evaluate(cdp, `document.getElementById('authSubmit').click()`);
await sleep(1500);
console.log('topbar admin:', await evaluate(cdp, `document.getElementById('authUser').textContent`));
await evaluate(cdp, `document.querySelector('.ship-row[data-mmsi="525001001"]').click()`);
await sleep(800);
const adminActs = await evaluate(cdp, `(() => ({
  edit: !!document.querySelector('.detail-drawer [data-el="edit"]'),
  del: !!document.querySelector('.detail-drawer [data-el="del"]'),
}))()`);
console.log('aksi admin di kapal seed:', JSON.stringify(adminActs));
assert(adminActs.edit && adminActs.del, 'admin boleh edit kapal seed');
await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
await sleep(300);
await evaluate(cdp, `document.getElementById('logoutBtn').click()`);
await sleep(800);

await closeTab(tab.id);
cdp.close();
console.log('E2E UI SELESAI: semua assertion lolos');