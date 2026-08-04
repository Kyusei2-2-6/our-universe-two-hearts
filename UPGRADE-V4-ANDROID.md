# OUR UNIVERSE v4 — Android Upgrade

Upgrade ini tidak membuat project Supabase, akun, repository GitHub, atau konfigurasi notifikasi baru.

## Yang dipertahankan

- Dua akun dan hubungan pasangan
- Login serta profil
- URL dan Publishable Key Supabase di `js/config.js`
- VAPID Public Key di `js/config.js`
- Supabase Secrets dan Edge Function `send-romantic-push`
- GitHub repository, GitHub Pages, domain, dan PWA
- Subscription notifikasi pada masing-masing HP

## Yang berubah

- Menu planet bawaan dihapus
- Semesta dimulai dengan 0 planet buatan pengguna
- Planet koleksi dibuat dan diberi nama oleh kalian
- Planet memakai carousel 3D lebar seperti recent apps
- Tema `Solar System Journey` menampilkan Matahari sampai Neptunus sebagai background
- Sistem level dihapus dari UI
- Tombol tambah memakai composer seperti story
- Jenis file dideteksi otomatis dan planet tujuan direkomendasikan
- Isi lama dapat dihapus permanen melalui reset owner sekali pakai

## Instalasi

Ekstrak ZIP patch ke project aktif, kemudian jalankan:

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
node scripts/apply-v4-baseline.mjs
```

Pasang migrasi database:

```bash
psql "host=$PGHOST port=5432 dbname=postgres user=$PGUSER sslmode=require" \
-W -v ON_ERROR_STOP=1 \
-f supabase/migrations/2026-08-04-dynamic-planets-v4.sql
```

Verifikasi:

```bash
psql "host=$PGHOST port=5432 dbname=postgres user=$PGUSER sslmode=require" \
-W -f supabase/migrations/verify-dynamic-planets-v4.sql
```

Tes dan build:

```bash
npm test
npm run build
```

Commit:

```bash
git add .
git commit -m "Rebuild OUR UNIVERSE with dynamic planets"
git push
```

Setelah deployment hijau, login memakai akun yang sama. Akun owner akan melihat layar pembangunan ulang sekali pakai. Ketik:

```text
HAPUS DAN BANGUN ULANG
```

Aplikasi menghapus media dan metadata lama, tetapi mempertahankan akun, profil, membership, Supabase, GitHub, dan notifikasi.
