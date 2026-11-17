/**
 * scripts/refresh-legacy-shots.mjs — perbarui screenshot nama lama
 * (dashboard.png, playback.png, mobile.png) ke UI v2.1 final.
 * Prasyarat: Chrome CDP 9222 + server 3000 (PG & Mongo nyala untuk playback).
 */
import { newTab, closeTab, connect, sleep, evaluate, shot } from './cdp.mjs';

const tab = await newTab('http://localhost:3000/');
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(7000);
await shot(cdp, 'docs/screenshots/dashboard.png');
console.log('dashboard.png diperbarui');

// Deep link membuka riwayat + playback; tutup drawer supaya panel terlihat penuh
await cdp.send('Page.navigate', { url: 'http://localhost:3000/?ship=525001001' });
await sleep(6000);
const hist = await evaluate(cdp, `(() => ({
  open: document.getElementById('historyPanel').classList.contains('open'),
  count: document.getElementById('historyCount')?.textContent || null,
}))()`);
console.log('panel riwayat:', JSON.stringify(hist));
await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
await sleep(500);
await shot(cdp, 'docs/screenshots/playback.png');
console.log('playback.png diperbarui');

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp.send('Page.navigate', { url: 'http://localhost:3000/' });
await sleep(4000);
await shot(cdp, 'docs/screenshots/mobile.png');
console.log('mobile.png diperbarui');

await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
cdp.close();
await closeTab(tab.id);
console.log('selesai');