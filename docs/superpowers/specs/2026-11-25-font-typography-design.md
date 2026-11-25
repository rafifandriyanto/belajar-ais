# Font & Typography — AIS VTS Console

## Intent

User minta font lebih baik. Audit sebelumnya juga menemukan `tiny-text` ×3 dan
atribusi Leaflet 10px. Tujuan: satu sistem tipografi yang lebih teknis, tetap
cocok untuk konsol VTS gelap, dan lulus lantai ukuran fungsional.

## Goals

- UI: **Fira Sans**. Data/mono: **Fira Code**.
- Ligature mono dimatikan; tabular numerals aktif.
- Lantai teks fungsional 12px; atribusi peta 12px + inset.
- Hierarchy tetap jelas: label 12, nama/values 13, judul 14, brand 13.
- Fallback system-ui; `display=swap`; tanpa font lokal tambahan.

## Non-goals

- Tidak mengganti palet, warna, layout, atau komponen.
- Tidak memakai Inter (anti-slop spec `2026-11-17`, baris 62).
- Tidak menambah dependensi npm atau build step.

## Constraints

- Google Fonts CDN sudah dipakai; tinggal ganti URL.
- `IBM Plex Sans` / `IBM Plex Mono` tercantum di spec lama — doc ini mengoverride
  hanya untuk families, bukan aturan kontras/radius/spacing.
- Semua teks ≥4.5:1 terhadap panel (terverifikasi sebelumnya).
- Topbar harus tetap muat di 320/390px.

## Approaches

| Opsi | Trade-off | Keputusan |
|---|---|---|
| Fira Sans + Fira Code | Koheren satu keluarga, paling cocok untuk dashboard/data, ligature perlu dimatikan | **Dipilih** |
| JetBrains Mono + IBM Plex Sans | Perubahan kecil, tapi hampir identik dengan kondisi sekarang | Ditolak: tidak menjawab "lebih baik" |
| Inter | Sangat legibel, tapi masuk daftar larangan anti-slop proyek | Ditolak |

## Decisions

- Token: `--font-ui: 'Fira Sans', system-ui, sans-serif`; `--font-mono: 'Fira Code', ui-monospace, monospace`.
- `font-variant-ligatures: none` di `body`; `font-feature-settings: 'tnum' 1` untuk peran angka.
- `font-optical-sizing: auto`.
- Naikkan deklarasi 11px → 12px di `public/css/console.css`; peran utama (nama kapal, jam, nilai) 13px.
- Atribusi Leaflet: 10px → 12px, padding 4px 6px.
- Perbarui `README.md` baris tipografi.

## Builder note

Perubahan kecil. Tidak ada builder check terpisah. Verifikasi: detector `--scope type`,
`npm test`, dan render CDP di 1440px + 390px dengan `document.fonts.check`.
