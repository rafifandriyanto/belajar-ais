/**
 * scripts/verify-palettes.mjs — screenshot 4 palet + cek kontras dim/panel.
 * Jalankan setelah Chrome headless CDP aktif di port 9222 dan server di 3000.
 */
import { newTab, closeTab, connect, sleep, evaluate, shot } from './cdp.mjs';

const tab = await newTab('http://localhost:3000/');
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(7000); // tunggu tile + data AIS live (real-time, bukan virtual time)

const contrast = (a, b) => {
  const lum = (hex) => {
    const c = hex.replace('#', '');
    const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((l1 + 0.05) / (l2 + 0.05)).toFixed(2);
};

const names = ['sonar', 'phosphor', 'amber', 'chart'];
for (let i = 0; i < 4; i++) {
  const name = await evaluate(cdp, `document.documentElement.dataset.palette`);
  const tokens = await evaluate(cdp, `(() => {
    const cs = getComputedStyle(document.documentElement);
    return { dim: cs.getPropertyValue('--text-dim').trim(), panel: cs.getPropertyValue('--panel').trim(),
             panel2: cs.getPropertyValue('--panel-2').trim(),
             faint: cs.getPropertyValue('--text-faint').trim(), accent: cs.getPropertyValue('--accent').trim(),
             inks: ['--ferry-ink', '--cargo-ink', '--tanker-ink', '--tug-ink', '--ok-ink', '--err-ink']
               .map((k) => cs.getPropertyValue(k).trim()) };
  })()`);
  const ratio = contrast(tokens.dim, tokens.panel);
  const ratioFaint = contrast(tokens.faint, tokens.panel);
  console.log(`${name}: dim/panel ${ratio}:1, faint/panel ${ratioFaint}:1, accent ${tokens.accent}`);
  if (Number(ratio) < 4.5) throw new Error(`kontras dim di bawah 4.5 (${name})`);
  // Teks berwarna (type-tag, conn-badge, form-err) harus >= 4.5 di panel & panel-2
  for (const ink of tokens.inks) {
    for (const bg of [tokens.panel, tokens.panel2]) {
      const r = Number(contrast(ink, bg));
      if (r < 4.5) throw new Error(`kontras ink ${ink} pada ${bg} = ${r} (${name})`);
    }
  }
  console.log(`  ink teks aman: ${tokens.inks.join(' ')}`);
  await shot(cdp, `docs/screenshots/v21-palette-${name}.png`);
  await evaluate(cdp, `document.getElementById('paletteBtn').click()`);
  await sleep(1500);
}
await closeTab(tab.id);
cdp.close();
console.log('selesai');