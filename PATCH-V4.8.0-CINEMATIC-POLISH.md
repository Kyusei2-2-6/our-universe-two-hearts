# OUR UNIVERSE v4.8.0 · Cinematic Polish

## Tujuan

Rilis ini memperhalus keseluruhan pengalaman OUR UNIVERSE agar lebih cinematic, romantis, premium, dan nyaman di Android. Seluruh perubahan dibangun di atas repository lama. Tidak ada fitur lama, tabel, policy, atau data pengguna yang dihapus.

## Fitur baru

### Living Atmosphere

- cahaya bulan kosmik yang berubah lembut berdasarkan waktu perangkat
- aurora violet dan rose yang ringan
- debu bintang dan shooting star dengan interval panjang
- intensitas semesta meningkat ketika kedua pengguna aktif
- animasi berhenti saat tab berada di background
- Economy Mode dan reduced motion mendapatkan versi yang lebih ringan

### Galaxy Signal

Beranda sekarang mempunyai status emosional yang menggunakan presence nyata:

- dua pengguna aktif: `Dua hati sedang hadir`
- satu pengguna aktif: `Satu hati sedang menjaga semesta`
- tidak ada yang aktif: pesan romantis berdasarkan pagi, siang, senja, atau malam

Fitur ini tidak menyimpan data baru dan tidak menampilkan detail last seen.

### Android Viewport Awareness

- mendeteksi tinggi `visualViewport`
- dock, player, Couple Connect, peta, kalender, dan Our Bond disembunyikan sementara saat keyboard terbuka
- modal menyesuaikan tinggi keyboard
- safe area Android tetap dihormati

### Targeted View Refresh

Sebelumnya beberapa penyimpanan memicu `location.reload()`. Sekarang aplikasi mencoba memperbarui halaman atau context yang relevan tanpa memutus musik, modal, dan pengalaman pengguna. Reload penuh hanya dipakai sebagai fallback jika refresh bertarget gagal.

## Area visual yang ditingkatkan

- intro sinematik
- topbar dan presence avatar
- headline dan subtitle semesta
- planet carousel
- story rail
- tombol dan feedback sentuhan
- memory cards
- modal dan form
- kalender dan agenda
- peta pasangan
- Our Bond
- music player
- navigation dock
- Couple Connect dan floating utility controls
- auth dan onboarding
- toast dan loading state

## File baru

- `css/v4.8-cinematic-polish.css`
- `js/features/cinematic-polish.js`
- `refresh-480.html`
- `INSTALL-V4.8.0-ANDROID.md`
- `PATCH-V4.8.0-CINEMATIC-POLISH.md`

## File diperbarui

- `index.html`
- `js/app.js`
- `sw.js`
- `manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `tests/validate.mjs`
- `README.md`

## Database

Tidak ada migration SQL baru. Schema, RLS, private Storage, signed URL, autentikasi, realtime, dan `universe_id` tidak diubah.

## Validasi

Rilis harus lulus:

```bash
npm test
npm run build
```

Gunakan `refresh-480.html` sekali setelah deployment untuk membersihkan cache PWA versi sebelumnya.
