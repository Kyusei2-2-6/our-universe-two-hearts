# Architecture Notes

## Trust boundary

GitHub Pages hanya menyajikan aplikasi statis. Browser menggunakan access token Supabase milik pengguna yang sedang masuk. Semua pembacaan dan perubahan data melewati RLS. Publishable key bukan izin untuk melewati RLS.

## Two-member invariant

- `universe_members.user_id` bersifat unik, sehingga satu akun tidak masuk ke beberapa universe.
- Trigger `enforce_two_members` menolak insert anggota ketiga.
- RPC `join_universe` mengunci baris universe saat memeriksa jumlah anggota untuk mencegah race condition.
- `partner_email` dapat membatasi kode undangan pada email tertentu.
- `invite_closed_at` ditetapkan ketika anggota kedua bergabung.

## Unified content model

Semua konten utama memakai tabel `entries`. Perbedaan antarfitur ditentukan oleh kolom `type`, kolom umum, dan `metadata` JSONB. Lampiran menggunakan tabel `attachments`. Model ini membuat pencarian, activity log, komentar, reaksi, dan panel pengelolaan dapat digunakan secara konsisten.

## Locked content

- Metadata Time Capsule tetap terlihat agar countdown dapat ditampilkan.
- Isi rahasia berada di `entry_secrets` dan policy SELECT memeriksa `unlock_at`.
- Storage path memakai pola `universe_id/entry_id/file`.
- Policy Storage memeriksa entry dan waktu buka sebelum membuat signed URL.
- Surat dengan password menyimpan ciphertext AES-GCM, salt, IV, dan parameter PBKDF2. Password tidak dikirim atau disimpan.

## Realtime

Database changes dipublikasikan untuk tabel kolaboratif. Setiap klien berlangganan perubahan universe aktif dan memuat ulang bagian yang relevan. Presence menggunakan channel khusus per universe.

## Performance

Three.js profile dipilih sebelum renderer dibuat. Jumlah bintang, partikel galaksi, asteroid, nebula, pixel ratio, bloom, afterimage, dan target FPS mengikuti profil perangkat.
