# Supabase v4.4 Setup

Setelah patch aplikasi terpasang, buka Supabase Dashboard lalu masuk ke SQL Editor.

Salin seluruh isi file berikut dan jalankan satu kali:

`supabase/migrations/2026-08-05-v4-4-couple-map-calendar.sql`

Migrasi membuat:

- `couple_locations`
- `couple_calendar_events`
- RLS khusus anggota semesta
- Supabase Realtime untuk kedua tabel
- masa aktif lokasi sekitar 2 menit

Untuk verifikasi, jalankan:

`supabase/migrations/verify-v4-4-couple-map-calendar.sql`

Hasil verifikasi harus menampilkan kedua tabel dan keduanya harus tercantum pada publication `supabase_realtime`.

## Izin lokasi Android

Saat ikon peta dibuka dan tombol Bagikan lokasiku diaktifkan, browser akan meminta izin lokasi. Pilih Izinkan saat menggunakan aplikasi.

Website harus dibuka melalui HTTPS. Lokasi browser biasanya tidak berfungsi pada alamat HTTP biasa.
