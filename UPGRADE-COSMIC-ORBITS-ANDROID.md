# Upgrade Cosmic Orbits dari Android

Upgrade ini melanjutkan project dan database yang sudah digunakan. Akun, login, semesta, foto, video, musik, surat, komentar, serta file lama tidak dihapus.

## Urutan aman

1. Backup folder project sebelum menimpa file.
2. Jalankan migrasi database `supabase/migrations/2026-08-04-memory-orbits.sql`.
3. Jalankan `npm test` dan `npm run build`.
4. Commit dan push ke repository GitHub yang sama.

## Menjalankan migrasi melalui Termux

Masuk ke folder project:

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
```

Gunakan koneksi Supabase yang sama seperti instalasi awal:

```bash
psql "host=$PGHOST port=5432 dbname=postgres user=$PGUSER sslmode=require" \
  -W -v ON_ERROR_STOP=1 \
  -f supabase/migrations/2026-08-04-memory-orbits.sql
```

Masukkan Database Password Supabase saat diminta. Hasil akhir yang benar adalah `COMMIT`.

Verifikasi:

```bash
psql "host=$PGHOST port=5432 dbname=postgres user=$PGUSER sslmode=require" \
  -W -f supabase/migrations/verify-memory-orbits.sql
```

Hasil harus menunjukkan tabel `memory_periods`, kolom `entries.period_id`, dan empat policy period.

## Fungsi baru

- Tema ruang angkasa: Bima Sakti, Saturn Dream, Lunar Ocean, dan Rose Cosmos.
- Planet bergerak dengan orbit berlainan.
- Bulan pusat pada Galaxy Hub.
- Menu bergerak depan-belakang mengelilingi bulan dan dapat digeser.
- Border kartu mengalir seperti energi.
- Orbit Kenangan untuk mengelompokkan berbagai jenis konten berdasarkan periode.
- Popup perjalanan kenangan dengan transisi cerita.
- Thumbnail khusus untuk Music.
- Ambient sound tetap mati secara default, tetapi lagu yang dipilih pengguna tetap dapat diputar.

## Perilaku data lama

Semua entry lama memperoleh `period_id = null`. Data tersebut muncul di `Kenangan Tanpa Orbit`. Edit entry lalu pilih Orbit Kenangan untuk memindahkannya. Menghapus suatu Orbit tidak menghapus entry. Entry hanya kembali ke `Kenangan Tanpa Orbit`.
