# OUR UNIVERSE v4.8.1 · Living Home

Rilis ini memperbaiki v4.8.0 yang terlalu halus sehingga hampir tidak terlihat berbeda. v4.8.1 mengubah struktur dan komposisi beranda secara nyata tanpa mengganti arsitektur, database, Supabase, autentikasi, realtime, atau data lama.

## Perubahan yang langsung terlihat

- Judul beranda baru berukuran sinematik dengan identitas `THE LIVING GALAXY`.
- Topbar baru dengan sigil planet dan label `TWO HEARTS`.
- `Living Observatory` menampilkan dua pengguna, status presence, dan cahaya hubungan.
- Ringkasan data nyata berupa jumlah planet, kenangan, dan story aktif.
- Empat portal besar terintegrasi untuk Couple Connect, Lokasi, Kalender, dan Our Bond.
- Launcher floating lama tetap dipertahankan pada halaman dalam, tetapi disembunyikan di beranda agar tidak ramai.
- Story aktif tampil seperti jalur konstelasi.
- Bagian `Orbit Kenangan` menampilkan nama planet aktif dan urutan planet.
- Planet card dibuat ulang menjadi fokus sinematik dengan orbit, nomor planet, status aktif, sphere lebih besar, dan CTA baru.
- Tata letak telah diuji pada lebar 360 px, 412 px, dan desktop 1440 px.

## Data yang digunakan

Semua angka berasal dari data nyata hasil `repository.listPlanets()`:

- jumlah planet dihitung dari daftar planet pengguna
- jumlah kenangan dijumlahkan dari `entry_count`
- jumlah story aktif dijumlahkan dari `active_story_count`

Nama dan status dua hati berasal dari `state.members`, `state.profile`, dan Supabase Presence yang sudah ada.

Tidak ada data dummy dan tidak ada migration SQL baru.

## File baru

- `css/v4.8.1-living-home.css`
- `js/features/living-home.js`
- `refresh-481.html`
- `INSTALL-V4.8.1-ANDROID.md`
- `PATCH-V4.8.1-LIVING-HOME.md`

## File yang diperbarui

- `index.html`
- `js/app.js`
- `js/components/planet-deck.js`
- `js/features/cinematic-polish.js`
- `css/v4.8-cinematic-polish.css`
- `sw.js`
- `manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `README.md`
- `tests/validate.mjs`

## Keamanan dan kompatibilitas

- tabel Supabase tidak diubah
- RLS tidak diubah
- Storage tidak diubah
- autentikasi tidak diubah
- filter `universe_id` tidak diubah
- fitur lama tidak dihapus
- launcher lama tetap aktif sebagai mekanisme fitur
- route lama tetap dipertahankan
- service worker memakai cache baru `our-universe-v4-8-1-living-home`

## Hasil validasi

Rilis final wajib lulus:

```bash
npm test
npm run build
```

Setelah deployment, buka `refresh-481.html` sekali pada setiap HP agar service worker dan cache lama benar-benar dibersihkan.
