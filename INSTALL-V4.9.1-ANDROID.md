# Instalasi OUR UNIVERSE v4.9.1 melalui Termux

Paket ini sudah mencakup v4.9.0 beserta perbaikan multi-upload v4.9.1.

## 1. Backup repository lama

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
git status
git add -A
git commit -m "backup sebelum v4.9.1" || true
cd ~
cp -r OUR-UNIVERSE-TWO-HEARTS "OUR-UNIVERSE-BACKUP-$(date +%Y%m%d-%H%M)"
```

## 2. Ekstrak paket

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
unzip -o ~/storage/downloads/OUR-UNIVERSE-FULL-v4.9.1.zip -d ~/OUR-UNIVERSE-TWO-HEARTS
```

Jika nama unduhan memiliki `(1)`, sesuaikan nama file pada perintah `unzip`.

## 3. Periksa versi dan tes

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
node -p "require('./package.json').version"
npm test
npm run build
```

Versi harus menampilkan `4.9.1`.

## 4. Supabase

Tidak ada migration baru khusus v4.9.1. Bila migration v4.9.0 belum pernah dijalankan, buka Supabase SQL Editor lalu jalankan:

```text
RUN-THIS-IN-SUPABASE-V4.9.0.sql
```

## 5. Push ke GitHub

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
git add -A
git commit -m "fix: multi upload Android v4.9.1"
git push origin main
```

## 6. Bersihkan cache pada kedua HP

Buka halaman berikut satu kali setelah GitHub Pages selesai diperbarui:

```text
https://kyusei2-2-6.github.io/refresh-491.html
```

## 7. Cara memakai multi-upload

1. Tekan **Pilih foto**, **Pilih audio**, **Pilih video**, atau **Pilih dokumen**.
2. Pilih beberapa file sekaligus bila pemilih Android mendukungnya.
3. Bila HP hanya memberi satu file, tekan **Tambah lagi**. Pilihan lama tidak hilang.
4. Hapus file tertentu melalui tombol `×` pada preview.
5. Tekan **Bagikan ke semesta** setelah seluruh file masuk ke antrean.
