# Instalasi OUR UNIVERSE v4.9.2 Rescue di Termux

Patch ini ditujukan untuk repository yang saat ini sudah berada di v4.9.0. Semua data Supabase dan fitur lama dipertahankan.

## 1. Backup repository

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
BACKUP=~/OUR-UNIVERSE-BACKUP-$(date +%Y%m%d-%H%M%S)
cp -a . "$BACKUP"
echo "Backup: $BACKUP"
```

## 2. Pasang patch

Pastikan file `OUR-UNIVERSE-PATCH-v4.9.2-RESCUE.zip` berada di folder Download Android.

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
unzip -o ~/storage/downloads/OUR-UNIVERSE-PATCH-v4.9.2-RESCUE.zip -d .
npm test
node -p "require('./package.json').version"
```

Versi yang tampil harus `4.9.2` dan validasi harus berhasil.

## 3. Aktifkan database

Buka Supabase Dashboard, pilih SQL Editor, lalu jalankan seluruh isi:

`RUN-THIS-IN-SUPABASE-V4.9.2-RESCUE.sql`

Hasil verifikasi terakhir harus menampilkan tiga nilai `true`.

## 4. Push ke GitHub

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
git add .
git commit -m "fix: rescue relationship journey v4.9.2"
git push origin main
```

## 5. Bersihkan cache satu kali

Buka halaman berikut dari browser:

`https://kyusei2-2-6.github.io/refresh-492.html`

Setelah dialihkan ke beranda, Relationship Journey tidak lagi menampilkan peringatan migration. Empat portal utama juga akan terlihat dalam susunan 2 x 2 pada Android.
