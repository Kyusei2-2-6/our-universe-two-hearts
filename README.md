# OUR UNIVERSE v4.9.2

OUR UNIVERSE adalah semesta digital privat untuk tepat dua orang. Versi 4 tidak memakai menu Gallery, Music, Notes, atau Files sebagai planet bawaan. Semesta dimulai kosong dan kedua pengguna menciptakan planet sendiri.

## Konsep utama

- Planet koleksi dibuat, diberi nama, diurutkan, dan diisi oleh dua pengguna
- Carousel planet 3D memiliki satu fokus besar dan jarak sentuh yang nyaman
- Matahari dan planet tata surya hanya menjadi background tema
- Composer bergaya story mendeteksi foto, video, audio, dan dokumen
- Satu entry disimpan di database lama yang aman, lalu dihubungkan ke planet melalui `planet_entries`
- Story dapat permanen, story 24 jam, atau keduanya
- Semua jenis entry dibuka dengan cinematic memory viewer
- Push notification lama tetap digunakan

## Model data v4

- `planets`
- `planet_entries`
- `stories`
- `story_views`

Tabel akun, profile, universe membership, entry, attachment, notification subscription, dan Storage tetap digunakan.

## Keamanan reset

`reset_universe_v4` hanya dapat dipanggil oleh member dengan role `owner` dan membutuhkan kalimat konfirmasi persis. Reset mempertahankan:

- `auth.users`
- `profiles`
- `universes`
- `universe_members`
- `push_subscriptions`
- `notification_preferences`

Lihat `UPGRADE-V4-ANDROID.md` untuk pemasangan dari Termux.
## OUR BOND v4.5.0

OUR BOND adalah satu panel terpadu untuk Heartbeat Presence, Memory Replay, Love Cinema, dan Secret Room. Fitur ini tidak membuat route baru. Semua interaksi berada di panel yang sama agar UI mobile tetap rapi dan tidak menambah banyak tombol.

Database baru memakai tabel `bond_pulses`, `bond_emotions`, `bond_replays`, `bond_capsules`, dan `bond_capsule_secrets`. Semua akses dibatasi RLS. Isi kapsul rahasia hanya dapat dibaca setelah waktu buka. Password tambahan dienkripsi di browser memakai AES-GCM.

Lihat `INSTALL-V4.5-OUR-BOND.md` untuk pemasangan patch dan migrasi Supabase.



## Love Timeline dan Relationship Stats v4.7.0

Panel Our Bond sekarang memiliki tab Timeline dan Stats. Love Timeline menggabungkan momen manual dengan agenda kalender yang dipilih melalui opsi “Masukkan ke Love Timeline”. Relationship Stats menghitung data nyata dari planet, cerita, media, agenda, timeline, Heartbeat, pesan, dan komentar tanpa menilai kualitas hubungan.

Jalankan `RUN-THIS-IN-SUPABASE-V4.7.0.sql` melalui Supabase SQL Editor. Panduan termudah tersedia di `INSTALL-V4.7.0-EASY.md`.


## Cinematic Polish v4.8.0

v4.8.0 memperhalus pengalaman tanpa mengganti arsitektur, database, autentikasi, atau fitur lama. Lapisan baru berada di `css/v4.8-cinematic-polish.css` dan `js/features/cinematic-polish.js` agar mudah diuji serta di-rollback.

Peningkatan utama:

- atmosfer galaxy hidup yang menyesuaikan waktu perangkat
- Galaxy Signal yang memakai presence nyata untuk menunjukkan satu atau dua hati sedang hadir
- tampilan intro, beranda, planet, story, kartu, modal, kalender, peta, Our Bond, dan autentikasi yang lebih premium
- tata letak mobile terpusat untuk dock utama, music player, Couple Connect, peta, kalender, dan Our Bond
- floating controls otomatis naik saat music player aktif
- floating controls menghilang sementara ketika keyboard Android terbuka
- animasi dihentikan ketika tab tidak terlihat dan dipangkas pada Economy Mode atau reduced motion
- refresh tampilan bertarget setelah penyimpanan, dengan reload penuh hanya sebagai fallback jika refresh gagal
- cache PWA baru dan halaman `refresh-480.html`

Versi ini tidak memerlukan migration SQL baru. Data lama dan RLS Supabase tetap digunakan.

Panduan pemasangan Android dan Termux tersedia di `INSTALL-V4.8.1-ANDROID.md`.


## Living Home v4.8.1

v4.8.1 memperbaiki beranda yang sebelumnya terlalu mirip dengan versi lama. Rilis ini menambahkan Living Observatory, statistik berbasis data nyata, empat portal fitur, header Living Galaxy, dan desain ulang planet focus. Seluruh fitur lama, database, RLS, dan data pengguna tetap dipertahankan.

Tidak ada migration SQL baru. Panduan Android tersedia di `INSTALL-V4.8.1-ANDROID.md`. Setelah deployment, buka `refresh-481.html` sekali pada setiap HP.


## Cosmic Identity dan Relationship Journey v4.9.2

v4.9.2 membuat hubungan dan identitas kedua pengguna terasa lebih personal tanpa mengubah arsitektur utama. Beranda kini menampilkan jumlah hari kalian telah terhubung. Profil memuat tanggal lahir, hitung mundur ulang tahun, nama panggilan, kota, love language, hal favorit, dan kalimat pribadi. Tab Journey di Our Bond menyusun tanggal komunikasi pertama, pertemuan pertama, kencan pertama, mulai bersama, jejak aplikasi, hari jadi berikutnya, dan cerita hubungan.

Rilis ini membutuhkan migration tambahan yang aman dan tidak menghapus data:

```text
RUN-THIS-IN-SUPABASE-V4.9.0.sql
```

Panduan Android dan Termux tersedia di `INSTALL-V4.9.0-ANDROID.md`. Setelah deployment, buka `refresh-490.html` sekali pada kedua HP.
