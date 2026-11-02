# OUR UNIVERSE v4.7.0 · Cara Pasang Paling Gampang

Versi ini sudah berupa proyek penuh. Sistem lama tidak dihapus. Fitur baru berada di dalam panel **Our Bond** pada tab **Timeline** dan **Stats**.

## 1. Timpa proyek lama dari Termux

Pastikan file `OUR-UNIVERSE-FULL-v4.7.0.zip` sudah berada di folder Download, lalu jalankan:

```bash
cd ~
rm -rf OUR-UNIVERSE-V470-TEMP
mkdir -p OUR-UNIVERSE-V470-TEMP
unzip -o ~/storage/downloads/OUR-UNIVERSE-FULL-v4.7.0.zip -d ~/OUR-UNIVERSE-V470-TEMP
cp -a ~/OUR-UNIVERSE-V470-TEMP/OUR-UNIVERSE-TWO-HEARTS/. ~/OUR-UNIVERSE-TWO-HEARTS/
cd ~/OUR-UNIVERSE-TWO-HEARTS
npm test
npm run build
```

Perintah tersebut menimpa file aplikasi, tetapi tidak menghapus folder `.git` milik proyek lama.

## 2. Jalankan satu SQL di Supabase

Buka **Supabase Dashboard → SQL Editor → New query**. Salin seluruh isi file:

```text
RUN-THIS-IN-SUPABASE-V4.7.0.sql
```

Tekan **Run** satu kali. SQL aman dijalankan ulang dan tidak menghapus agenda atau kenangan lama.

## 3. Push ke hosting

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
git add .
git commit -m "feat: Love Timeline and Relationship Stats v4.7.0"
git push
```

Setelah deploy selesai, buka:

```text
https://alamat-web-kamu/refresh-470.html
```

Halaman tersebut membersihkan cache PWA lama lalu membuka versi terbaru.

## Fitur v4.7.0

- Tombol Simpan kalender memakai RPC baru dan tetap memiliki fallback untuk database v4.5.2
- Agenda dapat dipilih untuk muncul otomatis di Love Timeline
- Love Timeline database dengan tambah, ubah, dan hapus momen
- UI timeline galaxy dengan orbit, tahun perjalanan, filter, dan urutan waktu
- Relationship Stats berdasarkan data nyata yang tersimpan
- Tanggal mulai hubungan dan tanggal pertama bertemu dapat diatur bersama
- Statistik planet, cerita, foto, video, timeline, ketemuan, Heartbeat, pesan, dan komentar
- Animasi orbit responsif dengan dukungan reduced motion
- Cache PWA dinaikkan ke v4.7.0
