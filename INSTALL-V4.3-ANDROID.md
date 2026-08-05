# OUR UNIVERSE v4.3 · Instalasi Android/Termux

## 1. Pasang patch ke proyek

```bash
cd ~/our-universe-v4.3-lightspeed-connect
chmod +x install.sh
./install.sh "$HOME/OUR-UNIVERSE-TWO-HEARTS"
```

Backup otomatis berada di `~/OUR-UNIVERSE-PATCH-BACKUPS`, bukan di dalam Git repository.

## 2. Jalankan migrasi Supabase

Buka Supabase Dashboard proyek, pilih **SQL Editor**, buat query baru, lalu salin seluruh isi:

```text
supabase/migrations/2026-08-05-v4-3-couple-connect.sql
```

Tekan **Run**. Setelah berhasil, jalankan isi `verify-v4-3-couple-connect.sql`. Hasil yang benar menampilkan tabel, function, realtime, dan push preference dalam keadaan tersedia/true.

Migrasi aman dijalankan ulang dan tidak menghapus data lama.

## 3. Deploy ulang Edge Function

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
npx supabase@latest login
npx supabase@latest functions deploy send-romantic-push --project-ref vqonhdalfdcutojzntdw
```

Secret VAPID lama tetap digunakan. Jangan mengunggah file `supabase/.notification-secrets.local.env`.

## 4. Tes lokal

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
npm test
npm run build
npm run serve
```

Buka `http://127.0.0.1:8080` di Chrome. Uji:

- Planet hanya memuat halaman awal dan memiliki tombol **Muat kenangan berikutnya**.
- Video tidak menghabiskan data sebelum dibuka.
- Couple Connect dapat mengirim chat, colek, hati, dan kangen antara dua akun.
- Popup dan vibrasi muncul di HP penerima ketika web aktif.
- Notifikasi masuk ketika PWA ditutup setelah notifikasi diaktifkan di kedua HP.
- Menu **Pengaturan > Tampilan > Penggunaan data media** bekerja.

## 5. Push ke GitHub

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
git status
git add -A
git commit -m "Add v4.3 Lightspeed and Couple Connect"
git pull --rebase origin main
git push origin main
```

Tunggu workflow **Validate** dan **Deploy GitHub Pages** hijau.

## 6. Pasang sebagai aplikasi Chrome

Setelah website online dibuka melalui HTTPS:

1. Login ke OUR UNIVERSE.
2. Tekan tombol **Pasang App** yang muncul.
3. Pilih **Instal**.
4. Buka ikon OUR UNIVERSE dari layar utama Android.

Jika prompt otomatis belum muncul, buka menu `⋮` Chrome lalu pilih **Instal aplikasi** atau **Tambahkan ke layar utama**.

## Catatan performa

Service worker hanya menyimpan shell aplikasi. Foto, video, audio, dokumen, dan respons Supabase tidak dimasukkan ke cache aplikasi secara massal. Media diminta bertahap sesuai tampilan dan tindakan pengguna.
