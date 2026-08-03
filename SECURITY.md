# Security Policy

## Prinsip utama

- Jangan pernah memasukkan Supabase service role key ke repository, browser, GitHub Actions log, atau pesan Telegram.
- Project URL dan publishable key boleh digunakan oleh frontend hanya karena semua tabel dan Storage dilindungi RLS.
- Jalankan `supabase/schema.sql` secara utuh. Menghapus policy dapat membuka data privat.
- Aktifkan kata sandi akun yang panjang dan unik.
- Periksa daftar pengguna Supabase Auth. Hapus akun asing yang tidak dikenal.

## Model ancaman

Aplikasi menyembunyikan isi dari pengguna anonim dan pengguna terautentikasi yang bukan anggota universe. Ia tidak dirancang untuk melindungi isi dari salah satu dari dua anggota sah. Keduanya memiliki hak pengelolaan konten bersama.

## Surat berkunci

Enkripsi surat terjadi di browser menggunakan AES-GCM dengan key yang diturunkan dari password melalui PBKDF2-SHA256. Password tidak dikirim ke database. Tidak ada fitur pemulihan password surat.

## Time Capsule

Pembatasan tanggal diterapkan pada row `entry_secrets` dan objek Storage. Mengubah jam perangkat tidak membuka data karena policy menggunakan waktu database `now()`.

## Pelaporan masalah

Jangan membuka issue publik yang berisi URL project, token, email pribadi, isi database, atau signed URL. Cabut key yang terpapar dan rotasi kredensial melalui dashboard Supabase.
