# Instalasi OUR UNIVERSE v4.9.0 melalui Android dan Termux

Rilis ini menambahkan Cosmic Identity, informasi ulang tahun, penghitung lama hubungan di beranda, dan Relationship Journey. Data lama tidak dihapus.

## 1. Download arsip

Simpan file berikut ke folder **Download** Android:

```text
OUR-UNIVERSE-FULL-v4.9.0.zip
```

## 2. Berikan izin penyimpanan ke Termux

Jalankan sekali:

```bash
termux-setup-storage
```

Tekan **Izinkan** saat Android meminta akses.

## 3. Pastikan repository bersih

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
git status
```

Simpan atau commit perubahan penting sebelum melanjutkan.

## 4. Buat backup penuh

```bash
cd ~
cp -a OUR-UNIVERSE-TWO-HEARTS "OUR-UNIVERSE-TWO-HEARTS-BACKUP-$(date +%Y%m%d-%H%M)"
cd ~/OUR-UNIVERSE-TWO-HEARTS
```

Backup ini mempertahankan folder `.git`, konfigurasi, dan seluruh data lokal repository.

## 5. Ekstrak v4.9.0 ke repository

```bash
unzip -o ~/storage/downloads/OUR-UNIVERSE-FULL-v4.9.0.zip -d ~/OUR-UNIVERSE-TWO-HEARTS
```

Bila Android menambahkan `(1)` pada nama file:

```bash
unzip -o ~/storage/downloads/OUR-UNIVERSE-FULL-v4.9.0\(1\).zip -d ~/OUR-UNIVERSE-TWO-HEARTS
```

## 6. Periksa versi dan validasi

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
node -p "require('./package.json').version"
npm test
npm run build
```

Versi wajib menampilkan:

```text
4.9.0
```

Jangan push bila `npm test` atau `npm run build` gagal.

## 7. Jalankan migration Supabase v4.9.0

Buka **Supabase Dashboard → SQL Editor → New query**. Salin seluruh isi file:

```text
RUN-THIS-IN-SUPABASE-V4.9.0.sql
```

Tekan **Run** satu kali. Migration aman dijalankan ulang dan tidak menghapus data lama.

Untuk memeriksa kolom baru, jalankan:

```text
supabase/migrations/verify-v4-9-cosmic-identity-journey.sql
```

Hasil verifikasi harus menampilkan kolom profil dan Relationship Journey.

## 8. Commit dan push

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
git status
git add .
git commit -m "feat: upgrade OUR UNIVERSE v4.9.0 cosmic identity journey"
git push origin main
```

## 9. Bersihkan cache pada kedua HP

Setelah GitHub Pages selesai memperbarui situs, buka:

```text
https://kyusei2-2-6.github.io/our-universe-two-hearts/refresh-490.html
```

Lakukan pada kedua HP. Halaman ini melepas service worker lama, membersihkan cache PWA, lalu membuka aset v4.9.0.

## 10. Pemeriksaan setelah login

Pastikan semua bagian berikut tampil dan dapat disimpan:

- beranda menampilkan jumlah hari kalian terhubung
- tombol penghitung membuka tab Journey di Our Bond
- profil menampilkan Cosmic Identity dan informasi ulang tahun
- Edit Cosmic Identity dapat menyimpan nama panggilan, tanggal lahir, kota, love language, hal favorit, quote, bio, dan foto
- Relationship Journey dapat menyimpan tanggal terhubung, komunikasi pertama, pertemuan pertama, kencan pertama, mulai bersama, nama hari jadi, dan cerita hubungan
- data pasangan terlihat hanya di semesta privat kalian

## Rollback

Cari backup:

```bash
cd ~
ls -d OUR-UNIVERSE-TWO-HEARTS-BACKUP-*
```

Kembalikan backup dengan mengganti `NAMA_BACKUP`:

```bash
mv OUR-UNIVERSE-TWO-HEARTS "OUR-UNIVERSE-TWO-HEARTS-v4.9.0-FAILED-$(date +%Y%m%d-%H%M)"
cp -a NAMA_BACKUP OUR-UNIVERSE-TWO-HEARTS
```

Migration hanya menambah kolom. Kolom baru boleh dibiarkan saat rollback karena versi lama akan mengabaikannya.
