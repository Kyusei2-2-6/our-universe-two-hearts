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
## Our Bond v4.5.0

Our Bond memakai satu orchestrator `js/features/our-bond.js` dan empat modul yang dimuat sebagai tab dalam panel yang sama. Modul tidak mendaftarkan route dan tidak mengubah struktur planet.

- `heartbeat-engine.js` membaca presence yang sudah ada dan menyimpan pulse serta emotion melalui RLS.
- `memory-replay.js` memilih entry lama di sisi klien dan hanya menyimpan jejak replay. Konten tidak digandakan.
- `love-cinema.js` menyusun media dari attachment yang sudah ada dan memakai signed URL Storage.
- `secret-room.js` memisahkan metadata kapsul dan isi rahasia ke dua tabel. Policy isi rahasia memeriksa `unlock_at` sebelum SELECT diizinkan.

Realtime hanya diaktifkan untuk `bond_pulses`, `bond_emotions`, `bond_replays`, dan `bond_capsules`. Tabel `bond_capsule_secrets` sengaja tidak dimasukkan ke publication Realtime.

