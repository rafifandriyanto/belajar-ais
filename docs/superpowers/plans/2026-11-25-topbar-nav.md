# Topbar Grouping + Console Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Kelompokkan topbar tanpa menghapus info, gabungkan kontrol tema/palet jadi menu Tampilan, tambah nav segmented di sidebar.

**Architecture:** Perubahan terbatas pada `index.html`, `console.css`, dan wiring `main.js`. Nav baru memanggil panel yang sudah ada.

**Tech Stack:** Vanilla HTML/CSS/JS, Leaflet, CDP via `scripts/cdp.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-25-topbar-nav-design.md`

## Global Constraints

- UTC tidak dihapus, tetap terlihat di topbar semua lebar.
- `scripts/verify-topbar.mjs` PASS di 320/390/768/1024/1440.
- Teks ≥12px; target 44px pada pointer coarse.
- Tanpa dependensi baru.

## Review Focus

1. Menu Tampilan tidak bisa ditutup dengan Esc/klik luar.
2. Nav RIWAYAT dibuka tanpa kapal terpilih → pesan, bukan error.
3. Mobile 320 dengan user login + PLAYBACK masih overflow.
4. Staleness indicator hilang saat `updateStat` dihapus.
5. WIB/UTC keduanya tampil dengan label jelas.

---

### Task 1: Struktur HTML + CSS

- [ ] **Step 1**: Ganti dua stat dengan `#fleetStat` (`totalShips`, `dataAge`), tambah divider, `wibStat`, `utcStat`.
- [ ] **Step 2**: Ganti `#toggleMapTheme` + `#paletteBtn` dengan `#displayBtn` + `#displayMenu` (4 radio palet + item tema).
- [ ] **Step 3**: Tambah `<nav class="view-nav">` di sidebar setelah head.
- [ ] **Step 4**: CSS divider, menu, nav tab, mobile rule. Verifikasi tidak ada referensi ke elemen lama di HTML.

### Task 2: Wiring JS

- [ ] **Step 1**: Hapus referensi `lastUpdated`, `updateStat`, `themeLabel`, `themeBtn`, `paletteBtn`.
- [ ] **Step 2**: `paintStaleness` pakai `fleetStat`; umur disembunyikan <2 dtk.
- [ ] **Step 3**: Jam WIB pakai `fmtClock`, UTC tetap ISO slice.
- [ ] **Step 4**: Menu Tampilan: buat/tutup, `aria-expanded`, radio palet, toggle tema, close on outside/Esc.
- [ ] **Step 5**: Nav tab: `aria-current`, fokus search / buka riwayat / fokus peta.

### Task 3: Verifikasi

- [ ] **Step 1**: `node scripts/verify-topbar.mjs` 320/390/768/1024/1440.
- [ ] **Step 2**: CDP buka menu, pilih palet, toggle tema, klik nav; cek state.
- [ ] **Step 3**: `npm test`; detector type; screenshot 1440 + 390.
