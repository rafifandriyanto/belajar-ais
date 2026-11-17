/**
 * scripts/cdp.mjs — helper CDP tanpa dependensi (Node >= 22 built-in WebSocket).
 * Dipakai script verifikasi visual: screenshot + evaluate di Chrome headless.
 * Chrome harus jalan: chrome --headless=new --remote-debugging-port=9222
 */
const BASE = 'http://127.0.0.1:9222';

export async function newTab(url = 'about:blank') {
  const res = await fetch(`${BASE}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return res.json();
}

export async function closeTab(id) {
  await fetch(`${BASE}/json/close/${id}`);
}

export function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: ok, reject: no } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? no(new Error(msg.error.message)) : ok(msg.result);
      }
    };
    ws.onerror = reject;
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((ok, no) => {
          const mid = ++id;
          pending.set(mid, { resolve: ok, reject: no });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      close: () => ws.close(),
    });
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval gagal');
  return r.result.value;
}

export async function shot(cdp, file) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}