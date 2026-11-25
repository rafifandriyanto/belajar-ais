# Topbar grouping + console nav

## Intent

User merasa topbar "numpuk". Tidak ada informasi yang boleh dihapus, termasuk UTC. Perbaikan lewat grouping, bukan pengurangan data.

## Decisions

- Topbar cluster: `Armada <count> <age>` | `WIB` `UTC` | `Tampilan ▾` | auth | `SIM` `PLAYBACK` `LIVE`. Divider 1px antar cluster.
- `Kapal Tampil` + `Frame WIB … 0 dtk lalu` digabung jadi satu readout `Armada 10 3 dtk`. Umur disembunyikan saat <2 dtk.
- Jam WIB dan UTC tetap keduanya, tiap cluster diberi label. UTC tidak dihapus.
- Tombol tema + palet digabung jadi satu menu `Tampilan` berisi 4 palet (radio) + toggle tema peta. Fungsi tidak hilang.
- Nav segmented `PETA | ARMADA | RIWAYAT` diletakkan di header sidebar, bukan topbar. Aktif = `aria-current="page"` + garis bawah accent, bukan warna saja.
- Mobile ≤480: fleet stat dan WIB disembunyikan; UTC, SIM, LIVE, Tampilan, auth tetap.

## Non-goals

- Tidak mengganti palet/warna/token.
- Tidak memindahkan panel riwayat atau mengubah drawer.

## Constraints

- Topbar tanpa overflow horizontal di 320/390/768/1024/1440.
- Kontras ≥4.5:1, target sentuh 44px pada `pointer: coarse`.
- `scripts/verify-topbar.mjs` tetap lulus.

## Verification

CDP: struktur cluster, menu buka/tutup, nav aktif, semua lebar tanpa overflow; `npm test`; detector type.
