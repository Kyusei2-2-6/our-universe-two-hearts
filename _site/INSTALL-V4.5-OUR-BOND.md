# Instalasi OUR BOND v4.5.0

OUR BOND menambahkan satu panel terpadu berisi empat fitur. Tidak ada halaman baru dan tidak ada banyak tombol tambahan.

Fitur yang aktif:

1. Heartbeat Presence untuk membagikan suasana hati, intensitas emosi, status kehadiran, dan pulse romantis.
2. Memory Replay untuk memilih kembali kenangan lama tanpa menggandakan data.
3. Love Cinema untuk memutar foto, video, dan cerita sebagai film otomatis di dalam panel yang sama.
4. Secret Room untuk membuat kapsul pesan dengan waktu buka dan enkripsi AES-GCM opsional.

## Cara tercepat di Termux

Ekstrak ZIP patch, lalu jalankan installer dengan path folder proyek:

```bash
cd ~/storage/downloads/OUR-UNIVERSE-PATCH-v4.5.0
bash install-v4.5.0.sh ~/OUR-UNIVERSE-TWO-HEARTS
```

Installer akan:

- memeriksa folder proyek
- membuat backup file yang akan ditimpa
- menyalin seluruh file v4.5.0
- menjalankan `npm test`
- menjalankan `npm run build`

## Migrasi Supabase

Buka Supabase Dashboard, masuk ke SQL Editor, lalu jalankan seluruh isi file berikut:

```text
supabase/migrations/2026-08-06-v4-5-our-bond.sql
```

Setelah berhasil, jalankan file verifikasi:

```text
supabase/migrations/verify-v4-5-our-bond.sql
```

Hasil verifikasi harus menampilkan lima tabel:

- `bond_pulses`
- `bond_emotions`
- `bond_replays`
- `bond_capsules`
- `bond_capsule_secrets`

Semua tabel harus memiliki RLS aktif. Realtime hanya dipakai untuk metadata kolaboratif. Isi kapsul rahasia tidak dimasukkan ke publication Realtime.

## Uji lokal

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
npm test
npm run build
npm run serve
```

Buka alamat yang tampil di terminal. Login seperti biasa, lalu tekan tombol **Our Bond** di dock kanan.

## Push ke GitHub

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
git add .
git commit -m "feat: add Our Bond v4.5.0"
git push origin main
```

Jika PWA masih menampilkan versi lama, tutup aplikasi, buka lagi, lalu lakukan refresh satu kali. Service worker v4.5.0 memakai cache baru `our-universe-v4-5-0-our-bond`.
