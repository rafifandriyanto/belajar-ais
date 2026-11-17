/**
 * scripts/verify-detail.mjs — verifikasi drawer detail + voyage live + Esc.
 * Prasyarat: Chrome CDP 9222 + server 3000.
 */
import { newTab, closeTab, connect, sleep, evaluate, shot } from './cdp.mjs';

const tab = await newTab('http://localhost:3000/');
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(7000);

await evaluate(cdp, `document.querySelector('.ship-row:not(.hidden)').click()`);
await sleep(1500);
console.log('drawer terbuka:', await evaluate(cdp, `!document.querySelector('.detail-drawer').hidden`));
console.log('judul:', await evaluate(cdp, `document.querySelector('.detail-title')?.textContent`));
console.log('ETA:', await evaluate(cdp, `document.querySelector('[data-el="eta"]')?.textContent`));
console.log('sisa nm:', await evaluate(cdp, `document.querySelector('[data-el="nm"]')?.textContent`));
const pos1 = await evaluate(cdp, `document.querySelector('.detail-live')?.textContent`);
await shot(cdp, 'docs/screenshots/v21-detail.png');
await sleep(4500); // 2 tick simulator
const pos2 = await evaluate(cdp, `document.querySelector('.detail-live')?.textContent`);
console.log('live berubah antar tick:', pos1 !== pos2);
await evaluate(cdp, `document.querySelector('.detail-drawer [data-el="hist"]').click()`);
await sleep(1000);
console.log('panel riwayat terbuka:', await evaluate(cdp, `document.getElementById('historyPanel').classList.contains('open')`));
await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
await sleep(300);
console.log('drawer tertutup via Esc:', await evaluate(cdp, `document.querySelector('.detail-drawer').hidden`));
await closeTab(tab.id);
cdp.close();
console.log('selesai');