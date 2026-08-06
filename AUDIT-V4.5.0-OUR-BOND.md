# Audit Integrasi OUR BOND v4.5.0

## Struktur yang dipertahankan

- `js/app.js` tetap menjadi boot utama aplikasi.
- Fitur pasangan yang tidak membutuhkan route memakai modul mandiri di `js/features`.
- Map dan kalender berbagi `#couple-life-dock`.
- State pengguna, universe, anggota, dan presence tetap berasal dari `js/core/state.js`.
- Akses database tetap melalui `js/core/supabase.js` dan dilindungi RLS.
- Entry dan attachment lama tetap menjadi sumber Memory Replay dan Love Cinema.

## Keputusan integrasi

OUR BOND dibuat sebagai satu launcher tambahan di dock yang sudah ada. Launcher membuka satu panel dengan empat tab. Tidak ada perubahan pada router, struktur planet, composer, media viewer, Couple Connect, map, kalender, atau music player.

File `js/features/our-bond.js` hanya bertugas mengelola konteks, panel, tab, dan satu channel Realtime. Logika fitur dipisah ke empat modul agar tidak menjadi satu file besar dan mudah dirawat.

## Dampak layout mobile

- Tidak ada tombol fitur yang ditempel satu per satu ke layar.
- Hanya ada satu tombol Our Bond.
- Empat fitur berada di tab horizontal dalam panel penuh pada layar kecil.
- Dock tetap vertikal di kanan dan mengikuti posisi aman yang sudah dipakai map serta kalender.
- Saat membuka kenangan lengkap, panel Our Bond ditutup lebih dulu agar modal tidak bertumpuk.

## Dampak data

- Memory Replay dan Love Cinema tidak menggandakan entry atau attachment.
- Replay hanya menyimpan ID entry, mode, pengguna yang memulai, waktu, dan reaksi.
- Secret Room memisahkan metadata kapsul dari isi rahasia.
- Isi kapsul tidak masuk channel Realtime.
- Seluruh tabel baru memakai policy berbasis `public.is_universe_member`.
