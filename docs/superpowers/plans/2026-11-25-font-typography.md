# Font & Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti IBM Plex Sans/Mono dengan Fira Sans/Fira Code dan naikkan lantai teks fungsional ke 12px tanpa merusak hierarchy, kontras, atau layout.

**Architecture:** Satu stylesheet token (`public/css/console.css`) menguasai peran font; satu tag Google Fonts di `public/index.html`; tidak ada perubahan JS atau struktur komponen. Peran data memakai mono dengan ligature mati dan tabular numerals.

**Tech Stack:** Vanilla CSS, Google Fonts CDN, Google Chrome headless via `scripts/cdp.mjs` untuk verifikasi visual.

**Spec:** `docs/superpowers/specs/2026-11-25-font-typography-design.md`

## Global Constraints

- Font UI: `'Fira Sans', system-ui, sans-serif`; font data: `'Fira Code', ui-monospace, monospace`.
- Dilarang Inter (spec anti-slop `2026-11-17`, baris 62).
- Semua teks fungsional ≥12px; atribusi Leaflet 12px + inset 4px 6px.
- Kontras ≥4.5:1 terhadap panel semua palet.
- Tanpa dependensi npm atau build step.
- Topbar tanpa overflow horizontal di 320/390/768/1024/1440px.

## Review Focus

1. Font gagal load — fallback system-ui tetap terbaca, tidak invisible text.
2. Ligature Fira Code mengubah `--:--:--` atau koordinat — ligature dimatikan, tabular numerals aktif.
3. Teks 12px menaikkan lebar topbar/sidebar — cek overflow di lima lebar.
4. Hierarchy hilang karena semua 12px — nama/jam/angka tetap 13px, judul 14px.
5. Atribusi Leaflet masih 10px — ganti ke 12px, bukan 11px.

---

### Task 1: Font source dan token

**Files:**
- Modify: `public/index.html:10-12`
- Modify: `public/css/console.css:38-39`

**Interfaces:**
- Consumes: Google Fonts CSS2 API.
- Produces: `--font-ui`, `--font-mono` dipakai seluruh stylesheet.

- [ ] **Step 1: Ganti URL Google Fonts di `index.html`**

Ganti link `IBM+Plex+Mono...IBM+Plex+Sans` dengan:
`https://fonts.googleapis.com/css2?family=Fira+Code:wght@400..700&family=Fira+Sans:wght@300..700&display=swap`
Pertahankan `preconnect` ke fonts.googleapis.com dan fonts.gstatic.com.

- [ ] **Step 2: Ganti token font di `console.css`**

`--font-ui: 'Fira Sans', system-ui, sans-serif;`
`--font-mono: 'Fira Code', ui-monospace, monospace;`

- [ ] **Step 3: Matikan ligature dan aktifkan tabular numerals**

Tambah di `body`: `font-variant-ligatures: none; font-optical-sizing: auto;`
Tambah di `.mono`: `font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1;`
Peran lain sudah memakai `font-variant-numeric: tabular-nums`, yang sudah menghasilkan
fitur OpenType `tnum`; tidak perlu `font-feature-settings` ganda.

- [ ] **Step 4: Verifikasi sumber**

Run: `Select-String -Path public/index.html -Pattern 'IBM Plex|Fira'` dan `git diff -- public/index.html public/css/console.css`
Expected: tidak ada `IBM Plex`; kedua token Fira hadir.

### Task 2: Skala tipografi 12px

**Files:**
- Modify: `public/css/console.css` (semua deklarasi 11px, `.leaflet-control-attribution`)

**Interfaces:**
- Consumes: token dari Task 1.
- Produces: teks fungsional ≥12px dan hierarchy tiga tingkat.

- [ ] **Step 1: Naikkan 11px → 12px**

Ganti semua `font-size: 11px` dan shorthand `11px/1.4` menjadi `12px` di `console.css`.

- [ ] **Step 2: Pertahankan hierarchy**

`.ship-name`, `.detail-title`, `.history-time`, `.history-ship`, `.brand-title`, `.stat-value` tetap atau naik ke 13–14px sesuai peran.

- [ ] **Step 3: Atribusi Leaflet**

Ganti `font-size: 10px !important` menjadi `12px !important` dan tambah `padding: 4px 6px !important`.

- [ ] **Step 4: Verifikasi detector type**

Run: `impeccable.cmd detect --json --scope type public/index.html`
Expected: exit 0 atau findings yang ada dapat dijelaskan (bukan `tiny-text`).

### Task 3: Dokumentasi dan verifikasi render

**Files:**
- Modify: `README.md`
- Test: CDP headless `scripts/cdp.mjs`

**Interfaces:**
- Consumes: Task 1 + Task 2.

- [ ] **Step 1: Update README**

Baris tipografi: Fira Sans + Fira Code.

- [ ] **Step 2: Jalankan test suite**

Run: `npm test`
Expected: 43/43 pass.

- [ ] **Step 3: Cek font termuat dan hierarchy di browser**

CDP: `document.fonts.check('500 12px "Fira Sans"')`, `document.fonts.check('500 12px "Fira Code"')`, `getComputedStyle(document.querySelector('.ship-name')).fontFamily`, `document.fonts.ready`.
Expected: true, true, Fira Sans, tidak ada fallback aktif.

- [ ] **Step 4: Cek overflow dan screenshot**

CDP pada 1440px dan 390px: `document.documentElement.scrollWidth === clientWidth`, `.topbar.scrollWidth === clientWidth`; simpan screenshot ke temp.

- [ ] **Step 5: Detector akhir + polish**

Run: `impeccable.cmd detect --json public/index.html`
Expected: `tiny-text` hilang; advisory `--` masih false positive.
