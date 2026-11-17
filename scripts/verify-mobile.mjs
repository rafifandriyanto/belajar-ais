/** Verifikasi tampilan mobile 390px: tanpa overflow horizontal + screenshot. */
import { newTab, closeTab, connect, sleep, evaluate, shot } from './cdp.mjs';

const tab = await newTab('http://localhost:3000');
const cdp = await connect(tab.webSocketDebuggerUrl);
try {
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await sleep(3000);

  const r = await evaluate(cdp, `(() => {
    const doc = document.documentElement;
    const topbar = document.querySelector('.topbar');
    const tb = topbar.getBoundingClientRect();
    const btns = [...topbar.querySelectorAll('button')].map((b) => {
      const x = b.getBoundingClientRect();
      return { id: b.id, w: Math.round(x.width), right: Math.round(x.right) };
    });
    return {
      scrollW: doc.scrollWidth, innerW: window.innerWidth,
      overflow: doc.scrollWidth > window.innerWidth,
      topbarRight: Math.round(tb.right),
      palette: doc.dataset.palette,
      ships: document.querySelectorAll('.ship-row').length,
      btns,
    };
  })()`);
  console.log(JSON.stringify(r, null, 2));
  if (r.overflow) throw new Error('Overflow horizontal di 390px');
  if (r.btns.some((b) => b.right > 391)) throw new Error('Tombol topbar keluar layar: ' + JSON.stringify(r.btns));

  await shot(cdp, 'docs/screenshots/v21-mobile.png');
  console.log('OK: docs/screenshots/v21-mobile.png');
} finally {
  await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  cdp.close();
  await closeTab(tab.id);
}