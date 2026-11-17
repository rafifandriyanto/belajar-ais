/**
 * scripts/verify-auth-ui.mjs — verifikasi UI auth/editor tanpa PG (error path)
 * + gambar rute klik peta. Prasyarat: Chrome CDP 9222 + server 3000.
 */
import { newTab, closeTab, connect, sleep, evaluate, shot } from './cdp.mjs';

const tab = await newTab('http://localhost:3000/');
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(7000);

// Modal auth terbuka, tab daftar, error PG tampil rapi
await evaluate(cdp, `document.getElementById('authBtn').click()`);
await sleep(400);
console.log('auth dialog terbuka:', await evaluate(cdp, `document.getElementById('authDialog').open`));
await evaluate(cdp, `document.getElementById('tabRegister').click()`);
await evaluate(cdp, `(() => { document.getElementById('authUsername').value = 'tester1'; document.getElementById('authPassword').value = 'rahasia123'; })()`);
await shot(cdp, 'docs/screenshots/v21-auth.png');
await evaluate(cdp, `document.getElementById('authSubmit').click()`);
await sleep(1200);
console.log('pesan error (PG mati):', await evaluate(cdp, `document.getElementById('authErr').textContent`));
await evaluate(cdp, `document.getElementById('authClose').click()`);

// Editor: buka via tombol (hidden tanpa login, panggil langsung untuk uji UI),
// klik peta 2 titik, undo, clear
await evaluate(cdp, `document.getElementById('addShipBtn').hidden = false; document.getElementById('addShipBtn').click()`);
await sleep(500);
console.log('editor terbuka (non-modal):', await evaluate(cdp, `document.getElementById('editorDialog').open`));
await evaluate(cdp, `(() => {
  const mapEl = document.getElementById('map');
  const r = mapEl.getBoundingClientRect();
  for (const [fx, fy] of [[0.45, 0.4], [0.55, 0.5]]) {
    mapEl.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy }));
  }
})()`);
await sleep(600);
console.log('titik rute:', await evaluate(cdp, `document.getElementById('edRouteCount').textContent`));
await shot(cdp, 'docs/screenshots/v21-editor.png');
await evaluate(cdp, `document.getElementById('edUndo').click()`);
await sleep(300);
console.log('setelah undo:', await evaluate(cdp, `document.getElementById('edRouteCount').textContent`));
await evaluate(cdp, `document.getElementById('edName').value = 'Kapal Uji'; document.getElementById('edMmsi').value = '525009001';`);
await evaluate(cdp, `document.getElementById('edSubmit').click()`);
await sleep(1200);
console.log('error simpan (PG mati / route 1 titik):', await evaluate(cdp, `document.getElementById('edErr').textContent`));
await evaluate(cdp, `document.getElementById('editorClose').click()`);
await sleep(300);
console.log('editor tertutup:', await evaluate(cdp, `!document.getElementById('editorDialog').open`));
await closeTab(tab.id);
cdp.close();
console.log('selesai');