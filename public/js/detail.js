/** detail.js — Drawer kanan: particulars, voyage, aksi favorit/follow/riwayat/edit. */
import { escapeHtml, fmtCoord, fmtNm } from './util.js';

export function createDetail(mainEl, { favorites, canEdit, getDyn, onHistory, onEdit, onDelete, onFollow }) {
  const el = document.createElement('aside');
  el.className = 'detail-drawer';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Detail kapal');
  el.hidden = true;
  mainEl.appendChild(el);
  let current = null;
  let voyageAt = 0;
  let deleteArmed = false;
  let invoker = null;

  const row = (label, value) => `<div class="popup-row"><span class="popup-row-label">${label}</span><span class="popup-row-value">${value}</span></div>`;

  function render() {
    if (!current) return;
    const s = current;
    const v = s.voyage;
    const editable = canEdit(s);
    deleteArmed = false;
    el.innerHTML = `
      <div class="detail-head">
        <span class="detail-title">${escapeHtml(s.name)}</span>
        <button class="icon-btn" data-el="close" aria-label="Tutup detail">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <span class="popup-type ${escapeHtml(s.type)}">${escapeHtml(s.type)}</span>
      <div class="popup-divider"></div>
      ${row('MMSI', escapeHtml(s.mmsi))}
      ${s.imo ? row('IMO', escapeHtml(s.imo)) : ''}
      ${s.callSign ? row('Call sign', escapeHtml(s.callSign)) : ''}
      ${s.flag ? row('Bendera', escapeHtml(s.flag)) : ''}
      ${s.lengthM ? row('Panjang / lebar', [s.lengthM, s.beamM].map((x) => (Number.isFinite(Number(x)) ? `${Number(x).toFixed(1)} m` : '--')).join(' / ')) : ''}
      <div class="popup-divider"></div>
      <div class="detail-live" data-el="live"></div>
      <div class="popup-divider"></div>
      ${v ? row('Destination', escapeHtml(v.destination || '-')) : ''}
      ${v ? row('ETA', `<span data-el="eta">${new Date(v.etaIso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>`) : ''}
      ${v ? row('Sisa jarak', `<span data-el="nm">${fmtNm(v.remainingM)} nm</span>`) : ''}
      <div class="detail-actions">
        <button class="btn" data-el="fav" aria-pressed="${favorites.has(s.mmsi)}">${favorites.has(s.mmsi) ? '★ FAVORIT' : '☆ FAVORIT'}</button>
        <button class="btn" data-el="follow" aria-pressed="${favorites.isFollow(s.mmsi)}">${favorites.isFollow(s.mmsi) ? 'FOLLOW ON' : 'FOLLOW'}</button>
        <button class="btn" data-el="hist">RIWAYAT</button>
        ${editable ? '<button class="btn" data-el="edit">EDIT</button>' : ''}
        ${editable ? '<button class="btn danger" data-el="del">HAPUS</button>' : ''}
      </div>`;
    el.querySelector('[data-el="close"]').addEventListener('click', close);
    el.querySelector('[data-el="fav"]').addEventListener('click', () => { favorites.toggle(s.mmsi); render(); });
    el.querySelector('[data-el="follow"]').addEventListener('click', () => { onFollow(s.mmsi); render(); });
    el.querySelector('[data-el="hist"]').addEventListener('click', () => onHistory(s.mmsi));
    el.querySelector('[data-el="edit"]')?.addEventListener('click', () => onEdit(s));
    el.querySelector('[data-el="del"]')?.addEventListener('click', (e) => {
      if (!deleteArmed) { deleteArmed = true; e.currentTarget.textContent = 'YAKIN? KLIK LAGI'; return; }
      onDelete(s.mmsi);
    });
    paintLive();
  }

  function paintLive(dyn) {
    const live = el.querySelector('[data-el="live"]');
    if (!live || !current) return;
    const d = dyn || current.dyn;
    if (!d) return;
    live.innerHTML = row('Kecepatan', `${Number(d.speed).toFixed(1)} kn`) + row('Heading', `${d.heading}°`) + row('Posisi', `${fmtCoord(d.lat)}, ${fmtCoord(d.lon)}`) + row('Status', d.status === 'moored' ? 'MOORED' : 'UNDERWAY');
  }

  async function open(mmsi) {
    const r = await fetch(`/api/ships/${mmsi}`);
    if (!r.ok) return false;
    invoker = document.activeElement;
    current = (await r.json()).data;
    current.dyn = getDyn ? getDyn(mmsi) : null;
    voyageAt = Date.now();
    el.hidden = false;
    render();
    el.querySelector('[data-el="close"]').focus();
    return true;
  }
  function close() {
    el.hidden = true;
    current = null;
    if (invoker && document.contains(invoker)) invoker.focus();
    invoker = null;
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
          if (eta && current.voyage) eta.textContent = new Date(current.voyage.etaIso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          if (nm && current.voyage) nm.textContent = `${fmtNm(current.voyage.remainingM)} nm`;
        }
      }).catch(() => {});
    }
  }
  return { open, close, refresh, rerender: render, isOpen: () => !el.hidden };
}