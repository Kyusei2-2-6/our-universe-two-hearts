# Panduan Instalasi dari Android

Panduan ini menganggap repository GitHub bernama `our-universe` dan username GitHub adalah `Kyusei2-2-6`. Sesuaikan jika nama repository berubah.

## A. Buat backend Supabase

1. Buka dashboard Supabase melalui browser Android.
2. Buat project baru dan simpan password database di tempat aman.
3. Setelah project aktif, buka **SQL Editor**.
4. Buka file `supabase/schema.sql` dari folder proyek.
5. Salin seluruh isinya ke SQL Editor dan tekan **Run**.
6. Jangan membuat akun terlebih dahulu. Sistem Auth akan menolak pendaftaran sampai allowlist dua email dipasang.
7. Buka **Project Settings → API** atau halaman Connect.
8. Salin:
   - Project URL
   - Publishable key atau anon key
9. Jangan menyalin service role key.

## B. Atur Auth URL

Di Supabase buka **Authentication → URL Configuration**.

Gunakan alamat GitHub Pages sebagai Site URL, misalnya:

```text
https://kyusei2-2-6.github.io/our-universe/
```

Tambahkan juga alamat yang sama pada Redirect URLs. Saat preview lokal, tambahkan:

```text
http://localhost:8080/**
```

Konfirmasi email dapat dibiarkan aktif. Untuk penggunaan pribadi yang lebih sederhana, konfirmasi email dapat dimatikan melalui pengaturan provider Email, tetapi kedua akun tetap harus memiliki kata sandi kuat.

## C. Ekstrak proyek ke Termux

Simpan ZIP di folder Download, kemudian:

```bash
termux-setup-storage
pkg update -y
pkg install nodejs git gh unzip -y
cd ~
unzip ~/storage/downloads/OUR-UNIVERSE-TWO-HEARTS.zip
cd OUR-UNIVERSE-TWO-HEARTS
```

Folder proyek sebaiknya berada di `~`, bukan langsung di `/storage/emulated/0`, agar Git tidak memunculkan masalah dubious ownership.

## D. Masukkan konfigurasi Supabase

```bash
npm run configure
```

Tempel Project URL, publishable key, email akun kamu, dan email akun pasangan. Perintah ini membuat `supabase/allowlist.local.sql`. File tersebut tidak akan ikut ke GitHub.

Buka file lokalnya dari Termux:

```bash
cat supabase/allowlist.local.sql
```

Salin seluruh SQL yang tampil, jalankan melalui Supabase SQL Editor, lalu validasi:

```bash
npm test
```

Hasil yang diharapkan:

```text
Validasi berhasil.
```

## E. Preview dari HP

```bash
npm run serve
```

Buka browser:

```text
http://127.0.0.1:8080
```

Tekan `CTRL + C` di Termux untuk menghentikan server.

## F. Push ke GitHub

Jika repository belum dibuat:

```bash
git init
git branch -M main
git add .
git commit -m "Launch Our Universe for two hearts"
gh repo create our-universe --public --source=. --remote=origin --push
```

Jika repository lama sudah ada dan ingin menggantinya dengan versi baru, buat backup terlebih dahulu. Setelah isi folder repository lokal diganti dengan proyek ini:

```bash
git add -A
git commit -m "Rebuild Our Universe as collaborative two-person app"
git push
```

## G. Aktifkan GitHub Pages

1. Buka repository di browser.
2. Pilih **Settings**.
3. Pilih **Pages**.
4. Pada Source, pilih **GitHub Actions**.
5. Buka tab **Actions** dan tunggu workflow `Deploy GitHub Pages` hijau.

## H. Buat dua akun

### Orang pertama

1. Buka website.
2. Selesaikan intro.
3. Pilih **Buat akun** dengan email penjaga pertama yang dimasukkan saat `npm run configure`.
4. Setelah masuk, pilih **Buat semesta baru**.
5. Isi nama semesta dan email pasangan.
6. Buka menu profil dan salin kode undangan.

### Orang kedua

1. Buka website yang sama.
2. Pilih **Buat akun** menggunakan email pasangan yang dimasukkan saat `npm run configure`.
3. Setelah masuk, pilih **Gabung dengan pasangan**.
4. Masukkan kode undangan.

Database menolak semua email di luar allowlist dan menolak akun ketiga, bahkan jika seseorang mengetahui alamat website.

## I. Menambah kenangan

Tekan tombol `＋ Tambahkan` di kanan bawah. Pilih jenis konten, isi judul dan cerita, lalu pilih beberapa file sekaligus. Voice note dapat direkam langsung jika browser memberi izin mikrofon.

Tidak perlu membuka Termux, JSON, atau GitHub lagi untuk mengisi konten sehari-hari.

## J. Memperbarui kode aplikasi

Termux hanya diperlukan ketika memperbarui program, bukan ketika menambah kenangan:

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
git add -A
git commit -m "Update application"
git push
```
