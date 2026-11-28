/** detail.js — Panel detail kapal: particulars, voyage, aksi favorit/follow/riwayat/edit. */
import { escapeHtml, fmtClock, fmtCoord, fmtNm } from './util.js';
import { typeIcon } from './fleet.js';
const typeColor = (t) => ({ ferry:'bg-sky-500/20 text-sky-300', cargo:'bg-amber-500/20 text-amber-300', tanker:'bg-rose-500/20 text-rose-300', tug:'bg-emerald-500/20 text-emerald-300' }[t] || 'bg-slate-500/20 text-slate-300');

export function createDetail(mainEl, { favorites, canEdit, getDyn, onHistory, onEdit, onDelete, onFollow, onError, onClose }) {
  const el = document.createElement('aside');
  el.className = 'detail-drawer';
  el.id = 'detailDrawer';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-labelledby', 'detailTitle');
  el.hidden = true;

  // Scrim hanya tampil saat drawer menjadi bottom sheet (<1024px, via CSS).
  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'drawer-scrim';
  scrim.tabIndex = -1;
  scrim.setAttribute('aria-hidden', 'true');
  scrim.addEventListener('click', close);

  mainEl.appendChild(scrim);
  mainEl.appendChild(el);

  let current = null;
  let voyageAt = 0;
  let deleteArmed = false;
  let invoker = null;

  const row = (label, value) => `<div class="flex items-center justify-between gap-3"><span class="text-slate-400">${label}</span><span class="text-right font-medium">${value}</span></div>`;

  function render() {
    if (!current) return;
    const s = current;
    const v = s.voyage;
    const editable = canEdit(s);
    deleteArmed = false;
    el.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 id="detailTitle" class="truncate text-base font-semibold" tabindex="-1">${escapeHtml(s.name)}</h2>
        <button class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100" data-el="close" aria-label="Tutup detail kapal">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <span class="mx-4 mt-3 inline-flex w-fit items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold uppercase ${typeColor(s.type)}">${typeIcon(s.type)} ${escapeHtml(s.type)}</span>
      <div class="space-y-1 px-4 py-3 text-sm">
        ${row('MMSI', escapeHtml(s.mmsi))}
        ${s.imo ? row('IMO', escapeHtml(s.imo)) : ''}
        ${s.callSign ? row('Call sign', escapeHtml(s.callSign)) : ''}
        ${s.flag ? row('Bendera', escapeHtml(s.flag)) : ''}
        ${s.lengthM ? row('Panjang / lebar', [s.lengthM, s.beamM].map((x) => (Number.isFinite(Number(x)) ? `${Number(x).toFixed(1)} m` : '--')).join(' / ')) : ''}
      </div>
      <div class="border-t border-slate-800 px-4 py-3" data-el="live"></div>
      <div class="space-y-1 px-4 py-3 text-sm">
        ${v ? row('Destination', escapeHtml(v.destination || '-')) : ''}
        ${v ? row('ETA', `<span data-el="eta">${fmtClock(v.etaIso).slice(0, 5)} WIB</span>`) : ''}
        ${v ? row('Sisa jarak', `<span data-el="nm">${fmtNm(v.remainingM)} nm</span>`) : ''}
      </div>
      <div class="flex flex-wrap gap-2 border-t border-slate-800 px-4 py-3">
        <button class="rounded border border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800" data-el="fav" aria-pressed="${favorites.has(s.mmsi)}">${favorites.has(s.mmsi) ? '★ FAVORIT' : '☆ FAVORIT'}</button>
        <button class="rounded border border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800" data-el="follow" aria-pressed="${favorites.isFollow(s.mmsi)}">${favorites.isFollow(s.mmsi) ? 'FOLLOW ON' : 'FOLLOW'}</button>
        <button class="rounded border border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800" data-el="hist">RIWAYAT</button>
        ${editable ? '<button class="rounded border border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800" data-el="edit">EDIT</button>' : ''}
        ${editable ? '<button class="rounded border border-rose-700 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/40" data-el="del">HAPUS</button>' : ''}
      </div>
      <p class="px-4 py-2 text-xs text-slate-500">Data simulasi — bukan feed AIS nyata.</p>`;
    el.querySelector('[data-el="close"]').addEventListener('click', close);
    el.querySelector('[data-el="fav"]').addEventListener('click', () => { favorites.toggle(s.mmsi); rerender('fav'); });
    el.querySelector('[data-el="follow"]').addEventListener('click', () => { onFollow(s.mmsi); rerender('follow'); });
    el.querySelector('[data-el="hist"]').addEventListener('click', () => onHistory(s.mmsi));
    el.querySelector('[data-el="edit"]')?.addEventListener('click', () => onEdit(s));
    el.querySelector('[data-el="del"]')?.addEventListener('click', (e) => {
      if (!deleteArmed) { deleteArmed = true; e.currentTarget.textContent = 'YAKIN HAPUS?'; return; }
      onDelete(s.mmsi);
    });
    paintLive();
  }

  /** Render ulang tanpa membuang fokus keyboard pada tombol yang baru diklik. */
  function rerender(focusKey) {
    render();
    if (focusKey) el.querySelector(`[data-el="${focusKey}"]`)?.focus();
  }

  function paintLive(dyn) {
    const live = el.querySelector('[data-el="live"]');
    if (!live || !current) return;
    const d = dyn || current.dyn;
    if (!d) return;
    live.innerHTML = row('Kecepatan', `${Number(d.speed).toFixed(1)} kn`) + row('Heading', `${d.heading}°`) + row('Posisi', `${fmtCoord(d.lat)}, ${fmtCoord(d.lon)}`) + row('Status', d.status === 'moored' ? 'MOORED' : 'UNDERWAY');
  }

  async function open(mmsi) {
    invoker = document.activeElement;
    let r = null;
    try {
      r = await fetch(`/api/ships/${mmsi}`);
    } catch {
      r = null;
    }
    if (!r || !r.ok) {
      onError?.('Detail kapal tidak bisa dimuat. Periksa koneksi lalu klik kapal lagi.');
      return false;
    }
    current = (await r.json()).data;
    current.dyn = getDyn ? getDyn(mmsi) : null;
    voyageAt = Date.now();
    el.hidden = false;
    scrim.classList.add('visible');
    render();
    // Fokus ke judul: screen reader langsung mendengar kapal mana yang terbuka.
    el.querySelector('#detailTitle')?.focus();
    return true;
  }

  function close() {
    const wasOpen = !el.hidden;
    el.hidden = true;
    scrim.classList.remove('visible');
    current = null;
    if (invoker && document.contains(invoker)) invoker.focus();
    invoker = null;
    if (wasOpen) onClose?.();
  }

  function refresh(ships) {
    if (!current || el.hidden) return;
    const d = ships.find((x) => x.mmsi === current.mmsi);
    if (!d) { close(); return; }
    current.dyn = d;
    paintLive(d);
    if (Date.now() - voyageAt > 10000) {
      voyageAt = Date.now();
      fetch(`/api/ships/${current.mmsi}`).then((r) => (r.ok ? r.json() : null)).then((j) => {
        if (j && current && j.data.mmsi === current.mmsi) {
          current.voyage = j.data.voyage;
          const eta = el.querySelector('[data-el="eta"]');
          const nm = el.querySelector('[data-el="nm"]');
          if (eta && current.voyage) eta.textContent = `${fmtClock(current.voyage.etaIso).slice(0, 5)} WIB`;
          if (nm && current.voyage) nm.textContent = `${fmtNm(current.voyage.remainingM)} nm`;
        }
      }).catch(() => {});
    }
  }
  return { open, close, refresh, rerender: render, isOpen: (mmsi) => !el.hidden && (!mmsi || current?.mmsi === mmsi) };
}
