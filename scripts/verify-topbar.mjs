/**
 * scripts/verify-topbar.mjs — regresi overflow topbar saat operator login
 * dan panel riwayat (PLAYBACK) aktif di layar sempit.
 *
 * Prasyarat: Chrome CDP 9222 + server 3000.
 * Usage: node scripts/verify-topbar.mjs [lebar] [username]
 */
import { newTab, closeTab, connect, sleep, evaluate } from './cdp.mjs';

const width = Number(process.argv[2] || 320);
const username = process.argv[3] || 'operator_satu';
const tab = await newTab('http://localhost:3000/');
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width, height: 844, deviceScaleFactor: 1, mobile: true,
});
await sleep(5000);
await evaluate(cdp, `(() => {
  const u = document.getElementById('authUser');
  u.hidden = false;
  u.textContent = ${JSON.stringify(username)};
  document.getElementById('authBtn').hidden = true;
  document.getElementById('logoutBtn').hidden = false;
  document.getElementById('playbackBadge').hidden = false;
})()`);
await sleep(300);
const result = await evaluate(cdp, `(() => {
  const d = document.documentElement, t = document.querySelector('.topbar');
  return {
    doc: [d.scrollWidth, d.clientWidth],
    topbar: [t.scrollWidth, t.clientWidth],
    authUser: getComputedStyle(document.getElementById('authUser')).display,
    playback: getComputedStyle(document.getElementById('playbackBadge')).display,
  };
})()`);
const ok = result.doc[0] === result.doc[1] && result.topbar[0] === result.topbar[1];
console.log(`${width}px ${username}: ${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(result)}`);
await closeTab(tab.id);
cdp.close();
if (!ok) process.exitCode = 1;
