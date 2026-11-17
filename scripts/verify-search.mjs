/**
 * scripts/verify-search.mjs — verifikasi search keyboard + favorites persist.
 * Prasyarat: Chrome CDP 9222 + server 3000.
 */
import { newTab, closeTab, connect, sleep, evaluate, shot } from './cdp.mjs';

const tab = await newTab('http://localhost:3000/');
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(7000);

const visibleRows = `document.querySelectorAll('.ship-row:not(.hidden)').length`;
const setVal = (v) => `(() => { const el = document.getElementById('shipSearch'); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
const key = (k) => `document.getElementById('shipSearch').dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true }))`;

console.log('awal baris:', await evaluate(cdp, visibleRows));
await evaluate(cdp, setVal('dharma'));
await sleep(400);
console.log('cari "dharma":', await evaluate(cdp, visibleRows), '(harus 1)');
await evaluate(cdp, `document.getElementById('shipSearch').focus()`);
await evaluate(cdp, key('ArrowDown'));
await evaluate(cdp, key('Enter'));
await sleep(1200);
console.log('selected:', await evaluate(cdp, `document.querySelector('.ship-row.selected .ship-name')?.textContent`));
await shot(cdp, 'docs/screenshots/v21-search.png');
await evaluate(cdp, key('Escape'));
await sleep(400);
console.log('setelah Escape:', await evaluate(cdp, visibleRows), '(harus 10)');

// Favorit: klik star baris pertama, reload, cek persist
await evaluate(cdp, `document.querySelector('.ship-row:not(.hidden) .fav-star').click()`);
await sleep(400);
console.log('favs tersimpan:', await evaluate(cdp, `localStorage.getItem('ais.favs')`));
await evaluate(cdp, `document.getElementById('favFilter').click()`);
await sleep(400);
console.log('filter favorit:', await evaluate(cdp, visibleRows), '(harus 1)');
await shot(cdp, 'docs/screenshots/v21-favorites.png');
await evaluate(cdp, `location.reload()`);
await sleep(7000);
console.log('star tetap on setelah reload:', await evaluate(cdp, `document.querySelectorAll('.fav-star.on').length`), '(harus 1)');
// bersihkan favorit uji
await evaluate(cdp, `document.querySelector('.fav-star.on').click()`);
await closeTab(tab.id);
cdp.close();
console.log('selesai');