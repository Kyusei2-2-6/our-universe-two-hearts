# Instalasi OUR UNIVERSE v4.8.1 melalui Android dan Termux

## 1. Download file

Download:

```text
OUR-UNIVERSE-FULL-v4.8.1.zip
```

Simpan ke folder **Download** Android. Pastikan file tidak berubah menjadi `.zip.zip`.

## 2. Berikan akses penyimpanan ke Termux

Jalankan sekali:

```bash
termux-setup-storage
```

Tekan **Izinkan** ketika Android meminta izin.

## 3. Masuk ke repository

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
```

Periksa posisi:

```bash
pwd
```

Hasilnya seharusnya berakhir dengan:

```text
OUR-UNIVERSE-TWO-HEARTS
```

## 4. Buat backup sebelum upgrade

```bash
cd ~
cp -a OUR-UNIVERSE-TWO-HEARTS "OUR-UNIVERSE-TWO-HEARTS-BACKUP-$(date +%Y%m%d-%H%M)"
```

Lalu kembali:

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
```

## 5. Ekstrak ZIP

```bash
unzip -o ~/storage/downloads/OUR-UNIVERSE-FULL-v4.8.1.zip -d .
```

Bila Android memberi nama `(1)`:

```bash
unzip -o ~/storage/downloads/OUR-UNIVERSE-FULL-v4.8.1\(1\).zip -d .
```

## 6. Pastikan versi

```bash
node -p "require('./package.json').version"
```

Hasil wajib:

```text
4.8.1
```

## 7. Validasi dan build

```bash
npm test
npm run build
```

Jangan lanjut ke push bila salah satu perintah gagal.

## 8. Periksa perubahan Git

```bash
git status
```

## 9. Commit dan push

```bash
git add .
git commit -m "feat: upgrade OUR UNIVERSE v4.8.1 living home"
git push origin main
```

## 10. Bersihkan cache di HP

Setelah hosting selesai memperbarui website, buka sekali:

```text
https://ALAMAT-WEBSITE-KAMU/refresh-481.html
```

Halaman tersebut akan:

- melepas service worker lama
- menghapus cache lama
- membuka ulang aplikasi dengan aset v4.8.1

Lakukan pada kedua HP yang memakai aplikasi.

## Pemeriksaan tampilan

Setelah login, beranda harus memperlihatkan:

- tulisan besar nama universe
- panel dua hati dan statistik
- portal Connect, Lokasi, Kalender, dan Our Bond
- judul Orbit Kenangan
- kartu planet besar dengan nomor dan orbit

Bila tampilan masih lama, pastikan `refresh-481.html` sudah dibuka dan versi pada `package.json` adalah `4.8.1`.

## Rollback

Cari nama backup:

```bash
cd ~
ls -d OUR-UNIVERSE-TWO-HEARTS-BACKUP-*
```

Hapus folder aktif hanya setelah memastikan backup tersedia:

```bash
rm -rf OUR-UNIVERSE-TWO-HEARTS
```

Kembalikan backup dengan mengganti `NAMA_BACKUP`:

```bash
cp -a NAMA_BACKUP OUR-UNIVERSE-TWO-HEARTS
```
