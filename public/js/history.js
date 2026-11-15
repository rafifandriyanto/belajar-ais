/**
 * history.js — panel riwayat posisi (MongoDB) + playback track.
 * Klik kapal → fetch riwayat → gambar track → slider/play memutar ulang.
 */

import { escapeHtml, fmtTime } from './util.js';

const SPEEDS = [1, 4, 16];
// Speed gate AIS: di lalu lintas pelabuhan, SOG > 30 kn dianggap spike anomali.
const MAX_PLAUSIBLE_KN = 30;
const MAX_GAP_S = 120;

export function createHistory(map) {
  const panel = document.getElementById('historyPanel');
  const body = document.getElementById('historyBody');
  const msg = document.getElementById('historyMsg');
  const shipEl = document.getElementById('historyShip');
  const mmsiEl = document.getElementById('historyMmsi');
  const slider = document.getElementById('historySlider');
  const timeEl = document.getElementById('historyTime');
  const countEl = document.getElementById('historyCount');
  const playBtn = document.getElementById('historyPlay');
  const playIcon = document.getElementById('playIcon');
  const playLabel = document.getElementById('playLabel');
  const speedBtn = document.getElementById('historySpeed');
  const startEl = document.getElementById('historyStart');
  const endEl = document.getElementById('historyEnd');
  const readoutEl = document.getElementById('historyReadout');

  let points = [];
  let trackLine = null;
  let playMarker = null;
  let playing = false;
  let rafId = null;
  let lastFrame = 0;
  let playheadMs = 0; // posisi waktu playback (epoch ms)
  let speedIdx = 0;
  let openMmsi = null;

  const isOpen = () => panel.classList.contains('open');

  function showMsg(text) {
    body.style.display = 'none';
    msg.style.display = 'block';
    msg.textContent = text;
  }

  function clearLayers() {
    if (trackLine) { map.removeLayer(trackLine); trackLine = null; }
    if (playMarker) { map.removeLayer(playMarker); playMarker = null; }
  }

  function stopPlayback() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    playIcon.innerHTML = '<polygon points="6 3 20 12 6 21"/>';
    playLabel.textContent = 'PLAY';
  }

  /** Posisi interpolasi pada waktu t (epoch ms). */
  function positionAt(t) {
    if (t <= points[0].ts) return points[0];
    const last = points[points.length - 1];
    if (t >= last.ts) return last;
    // cari segmen (binary search)
    let lo = 0, hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid].ts <= t) lo = mid; else hi = mid;
    }
    const a = points[lo], b = points[hi];
    // Segmen gap: snap ke titik berikutnya, jangan interpolasi menembus gap
    const info = segmentInfo(lo);
    if (info && info.gap) return b;
    const f = (t - a.ts) / (b.ts - a.ts || 1);
    return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, ts: t };
  }

  /** Isi progres slider (aksen sampai posisi thumb). */
  function paintSlider() {
    const max = Number(slider.max) || 1;
    const pct = (Number(slider.value) / max) * 100;
    slider.style.background =
      `linear-gradient(to right, var(--accent) ${pct}%, var(--border) ${pct}%)`;
  }

  /** SOG (kn) & dt (s) antara dua titik berurutan. */
  function sogBetween(a, b) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    const dist = 2 * R * Math.asin(Math.sqrt(h));
    const dt = (b.ts - a.ts) / 1000;
    return { sog: dt > 0 ? (dist / dt) / 0.514444 : 0, dt };
  }

  /** SOG & heading dari segmen track di sekitar index i. */
  function segmentInfo(i) {
    const a = points[Math.max(0, Math.min(i, points.length - 2))];
    const b = points[Math.min(i + 1, points.length - 1)];
    if (!a || !b || a === b) return null;
    const { sog, dt } = sogBetween(a, b);
    const rad = Math.PI / 180;
    const dLon = (b.lon - a.lon) * rad;
    const y = Math.sin(dLon) * Math.cos(b.lat * rad);
    const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) -
      Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(dLon);
    const hdg = (Math.atan2(y, x) / rad + 360) % 360;
    // Gap data: lompatan waktu panjang atau kecepatan tak masuk akal
    const gap = dt > MAX_GAP_S || sog > MAX_PLAUSIBLE_KN;
    return { sog, hdg, gap };
  }

  function updateReadout(i) {
    const info = segmentInfo(i);
    if (!info) { readoutEl.textContent = ''; return; }
    readoutEl.innerHTML = info.gap
      ? 'SOG <b>—</b> · HDG <b>—</b> (gap data)'
      : `SOG <b>${info.sog.toFixed(1)} kn</b> · HDG <b>${String(Math.round(info.hdg)).padStart(3, '0')}°</b>`;
  }

  function seekIndex(i) {
    const p = points[i];
    if (!p) return;
    playheadMs = p.ts;
    playMarker.setLatLng([p.lat, p.lon]);
    timeEl.textContent = fmtTime(p.ts);
    slider.value = i;
    paintSlider();
    updateReadout(i);
  }

  function seekTime(t) {
    const p = positionAt(t);
    playheadMs = t;
    playMarker.setLatLng([p.lat, p.lon]);
    timeEl.textContent = fmtTime(t);
    // posisi slider ≈ index terdekat
    let idx = 0;
    while (idx < points.length - 1 && points[idx + 1].ts <= t) idx++;
    slider.value = idx;
    paintSlider();
    updateReadout(idx);
  }

  function frame(now) {
    if (!playing) return;
    const dt = now - lastFrame;
    lastFrame = now;
    playheadMs += dt * SPEEDS[speedIdx];
    const end = points[points.length - 1].ts;
    if (playheadMs >= end) {
      seekTime(end);
      stopPlayback();
      return;
    }
    seekTime(playheadMs);
    // Lewati gap waktu sekaligus supaya playback tidak "mati" di dalam gap
    const info = segmentInfo(Number(slider.value));
    if (info && info.gap) {
      playheadMs = points[Math.min(Number(slider.value) + 1, points.length - 1)].ts;
    }
    rafId = requestAnimationFrame(frame);
  }

  function startPlayback() {
    if (points.length < 2) return;
    if (playheadMs >= points[points.length - 1].ts) {
      playheadMs = points[0].ts; // ulangi dari awal
    }
    playing = true;
    lastFrame = performance.now();
    playIcon.innerHTML = '<rect x="5" y="4" width="4" height="16"/><rect x="15" y="4" width="4" height="16"/>';
    playLabel.textContent = 'JEDA';
    rafId = requestAnimationFrame(frame);
  }

  async function open(mmsi, name, opts = {}) {
    stopPlayback();
    clearLayers();
    openMmsi = mmsi;
    panel.classList.add('open');
    shipEl.textContent = name;
    mmsiEl.textContent = `MMSI ${mmsi}`;
    showMsg('Memuat riwayat...');

    try {
      const q = new URLSearchParams({ limit: '500' });
      // Default: 6 jam terakhir — riwayat lama tidak menyeret track ke ujung peta
      if (!opts.from && !opts.to) q.set('from', new Date(Date.now() - 6 * 3600e3).toISOString());
      if (opts.from) q.set('from', opts.from);
      if (opts.to) q.set('to', opts.to);
      const res = await fetch(`/api/ships/${mmsi}/history?${q}`);
      const json = await res.json();
      if (openMmsi !== mmsi) return; // sudah pindah kapal lain

      if (!res.ok) {
        showMsg(json.message || 'Riwayat tidak tersedia (MongoDB belum tersambung).');
        return;
      }
      const raw = (json.data || []).map((p) => ({
        lat: p.lat, lon: p.lon, ts: new Date(p.timestamp).getTime(),
      }));

      // Bersihkan feed: pecah per sesi kontinu (gap waktu), lalu speed-gate
      // tiap sesi — spike anomali dibuang, sesi tersisa digabung kembali.
      const sessions = [];
      let cur = [];
      for (const p of raw) {
        const prev = cur[cur.length - 1];
        if (prev && (p.ts - prev.ts) / 1000 > MAX_GAP_S) {
          sessions.push(cur);
          cur = [];
        }
        cur.push(p);
      }
      sessions.push(cur);
      points = [];
      let dropped = 0;
      for (const session of sessions) {
        const kept = [];
        for (const p of session) {
          const prev = kept[kept.length - 1];
          if (prev && sogBetween(prev, p).sog > MAX_PLAUSIBLE_KN) {
            dropped++;
            continue;
          }
          kept.push(p);
        }
        if (kept.length >= 2) points.push(...kept);
        else dropped += kept.length;
      }
      if (points.length < 2) {
        showMsg('Belum ada cukup riwayat — server menyimpan posisi tiap 10 detik, tunggu sebentar lalu klik lagi.');
        return;
      }

      msg.style.display = 'none';
      body.style.display = 'block';

      // Track digambar per segmen kontinu — gap data tidak ditarik garis lurus
      const segments = [];
      let seg = [[points[0].lat, points[0].lon]];
      for (let i = 0; i < points.length - 1; i++) {
        const info = segmentInfo(i);
        if (info && info.gap) {
          segments.push(seg);
          seg = [];
        }
        seg.push([points[i + 1].lat, points[i + 1].lon]);
      }
      segments.push(seg);
      trackLine = L.polyline(segments.filter((s) => s.length >= 2), {
        color: '#ff7a29', weight: 2, opacity: 0.85, dashArray: '6 4',
      }).addTo(map);
      playMarker = L.circleMarker([points[0].lat, points[0].lon], {
        radius: 5, color: '#ffffff', weight: 1.5,
        fillColor: '#ff7a29', fillOpacity: 1,
      }).addTo(map);

      slider.min = 0;
      slider.max = points.length - 1;
      countEl.textContent = dropped
        ? `${points.length} titik · ${dropped} anomali dibuang`
        : `${points.length} titik`;
      countEl.title = dropped
        ? 'Titik dengan kecepatan tak wajar (speed gate 30 kn) tidak dipakai untuk track/playback'
        : '';
      startEl.textContent = fmtTime(points[0].ts);
      endEl.textContent = fmtTime(points[points.length - 1].ts);
      seekIndex(0);
      map.fitBounds(trackLine.getBounds(), { padding: [60, 60] });
    } catch {
      showMsg('Gagal memuat riwayat — periksa koneksi server.');
    }
  }

  function close() {
    stopPlayback();
    clearLayers();
    points = [];
    openMmsi = null;
    readoutEl.textContent = '';
    panel.classList.remove('open');
  }

  // ─── Kontrol ────────────────────────────────────────────────────────────
  slider.addEventListener('input', () => {
    stopPlayback();
    seekIndex(Number(slider.value));
  });

  playBtn.addEventListener('click', () => {
    if (playing) stopPlayback();
    else startPlayback();
  });

  speedBtn.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    speedBtn.textContent = `${SPEEDS[speedIdx]}×`;
  });

  document.getElementById('historyClose').addEventListener('click', close);

  return { open, close, isOpen };
}