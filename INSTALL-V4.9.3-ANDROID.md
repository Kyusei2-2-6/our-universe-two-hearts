# Instalasi OUR UNIVERSE v4.9.3 di Android

## 1. Pasang patch

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
unzip -o /storage/emulated/0/Download/OUR-UNIVERSE-PATCH-v4.9.3-BOND-FIX.zip -d .
node -p "require('./package.json').version"
npm test
```

Versi harus `4.9.3` dan validasi harus berhasil.

## 2. Jalankan SQL

Buka Supabase > SQL Editor. Salin seluruh isi `RUN-THIS-IN-SUPABASE-V4.9.3-ALL-IN-ONE.sql`, tekan Run, lalu pastikan tujuh nilai verifikasi bernilai `true`.

## 3. Push

```bash
git add .
git commit -m "fix: repair Our Bond runtime v4.9.3"
git push origin main
```

## 4. Bersihkan cache

Setelah GitHub Pages selesai deploy, buka sekali:

```text
https://kyusei2-2-6.github.io/refresh-493.html
```
