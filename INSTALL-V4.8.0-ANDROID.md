# Instalasi OUR UNIVERSE v4.8.0 melalui Android dan Termux

Panduan ini dibuat untuk file:

```text
OUR-UNIVERSE-FULL-v4.8.0.zip
```

## 1. Download ZIP

1. Tekan link file ZIP dari percakapan ChatGPT.
2. Pilih **Download** atau **Simpan**.
3. Pastikan file masuk ke folder **Download** Android.
4. Pastikan namanya `OUR-UNIVERSE-FULL-v4.8.0.zip`.
5. Bila Android menambahkan `(1)`, gunakan nama file yang benar saat menjalankan perintah `unzip`.

## 2. Izinkan Termux membaca penyimpanan Android

Jalankan satu kali:

```bash
termux-setup-storage
```

Tekan **Izinkan** ketika Android meminta izin. Jika folder `~/storage` sudah ada, jawab `y` hanya ketika Termux meminta membangun ulang shortcut. File di Download Android tidak akan dihapus.

## 3. Masuk ke repository

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
```

Periksa lokasi:

```bash
pwd
```

Hasilnya seharusnya mirip:

```text
/data/data/com.termux/files/home/OUR-UNIVERSE-TWO-HEARTS
```

## 4. Buat backup sebelum upgrade

```bash
cd ~
cp -a OUR-UNIVERSE-TWO-HEARTS "OUR-UNIVERSE-TWO-HEARTS-BACKUP-$(date +%Y%m%d-%H%M)"
cd ~/OUR-UNIVERSE-TWO-HEARTS
```

Backup ini penting untuk rollback cepat.

## 5. Ekstrak ZIP ke repository

```bash
unzip -o ~/storage/downloads/OUR-UNIVERSE-FULL-v4.8.0.zip -d .
```

Jika perintah `unzip` belum tersedia:

```bash
pkg update
pkg install unzip
```

Lalu ulangi perintah ekstrak.

## 6. Pastikan versi sudah benar

```bash
node -p "require('./package.json').version"
```

Hasil yang benar:

```text
4.8.0
```

## 7. Jalankan validasi

```bash
npm test
```

Hasil yang diharapkan diawali dengan:

```text
Validasi berhasil.
```

Kemudian build:

```bash
npm run build
```

Hasil yang diharapkan:

```text
Build selesai:
```

## 8. Lihat perubahan Git

```bash
git status
```

Pastikan tidak ada file pribadi atau `.env` yang ikut berubah secara tidak sengaja.

## 9. Commit dan push

```bash
git add .
git commit -m "feat: upgrade OUR UNIVERSE v4.8.0 cinematic polish"
git push origin main
```

Jika Git meminta identitas:

```bash
git config --global user.name "Nama Kamu"
git config --global user.email "emailkamu@example.com"
```

Setelah itu ulangi commit dan push.

## 10. Bersihkan cache PWA lama

Setelah hosting selesai memperbarui file, buka alamat berikut di browser Android:

```text
https://ALAMAT-WEBSITE-KAMU/refresh-480.html
```

Halaman tersebut akan:

- menghapus service worker lama
- menghapus cache lama
- mengarahkan kembali ke OUR UNIVERSE v4.8.0

Lakukan satu kali pada masing-masing HP pengguna.

## Testing setelah deployment

Periksa secara berurutan:

1. Login kedua akun masih berhasil.
2. Planet dan kenangan lama masih muncul.
3. Geser carousel planet.
4. Buat story atau kenangan baru.
5. Pastikan halaman tidak reload penuh setelah menyimpan.
6. Putar musik dan buka planet. Musik seharusnya tidak terputus karena refresh halaman.
7. Buka Couple Connect.
8. Buka peta, kalender, dan Our Bond.
9. Aktifkan music player dan periksa tombol floating otomatis naik.
10. Buka form lalu munculkan keyboard. Dock dan tombol floating seharusnya tidak menutupi keyboard.
11. Uji layar pendek dan rotasi landscape.
12. Uji mode PWA dari ikon aplikasi.

## Rollback cepat

Bila ada masalah serius:

```bash
cd ~
rm -rf OUR-UNIVERSE-TWO-HEARTS
cp -a OUR-UNIVERSE-TWO-HEARTS-BACKUP-YYYYMMDD-HHMM OUR-UNIVERSE-TWO-HEARTS
cd ~/OUR-UNIVERSE-TWO-HEARTS
npm test
npm run build
```

Ganti `YYYYMMDD-HHMM` dengan nama folder backup yang dibuat sebelumnya.

## Catatan database

v4.8.0 tidak memerlukan migration Supabase baru. Jangan menjalankan SQL tambahan untuk rilis ini.
