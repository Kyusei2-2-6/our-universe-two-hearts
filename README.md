# OUR UNIVERSE · TWO HEARTS

OUR UNIVERSE adalah web app romantis privat untuk **tepat dua orang**. Aplikasi dimulai tanpa foto, kenangan, surat, lagu, atau data contoh. Dua anggota yang sah dapat mengisi dan mengelola semesta yang sama langsung melalui HP.

## Isi utama

- Intro deep-space, bentangan Bima Sakti, planet bergerak, perjalanan kamera, bintang, asteroid, bloom lembut, dan easter egg.
- Galaxy Hub dengan bulan pusat serta menu 3D yang berorbit dari depan ke belakang dan dapat digeser.
- Login Supabase Auth dengan allowlist yang hanya menerima dua email yang telah ditentukan.
- Universe Studio yang ramah layar sentuh.
- Orbit Kenangan yang menggabungkan foto, video, musik, notes, surat, dan file dalam perjalanan berdasarkan periode.
- Memory dengan banyak lampiran sekaligus.
- Foto, video, musik, voice note, PDF, TXT, dokumen, ZIP, dan file lain.
- Letters dengan enkripsi kata sandi berbasis Web Crypto.
- Time Capsule dengan isi dan media yang ditolak oleh RLS sebelum tanggal buka.
- Wish dengan progres dan status.
- Notes, Timeline, Search, Activity Log, komentar, reaksi, favorit, dan Presence realtime.
- Private Supabase Storage dengan signed URL.
- PWA, Service Worker, GitHub Pages workflow, dan mode performa adaptif.

## Arsitektur

```text
GitHub Pages
├── HTML, CSS, JavaScript modules
├── Three.js, GSAP, WebGL, Canvas, Web Audio
├── PWA shell
└── Universe Studio

Supabase
├── Auth: dua akun pengguna
├── PostgreSQL: seluruh metadata
├── Row Level Security: hanya anggota semesta
├── Private Storage: seluruh media dan file
└── Realtime: perubahan dan presence
```

Aplikasi tidak menggunakan service role key di browser. Hanya Project URL dan publishable key yang dimasukkan ke `js/config.js`. Keamanan isi bergantung pada RLS di `supabase/schema.sql`.

## Mulai cepat

1. Buat proyek baru di Supabase.
2. Buka SQL Editor, tempel seluruh `supabase/schema.sql`, lalu jalankan sekali.
3. Di Termux, masuk ke folder proyek dan jalankan:

```bash
pkg install nodejs git gh -y
npm run configure
npm test
```

4. Masukkan Project URL, **publishable key**, email akun pertama, dan email akun pasangan.
5. Salin isi `supabase/allowlist.local.sql` yang dihasilkan ke Supabase SQL Editor, lalu jalankan. File privat ini otomatis diabaikan Git.
6. Commit dan push ke GitHub:

```bash
git add .
git commit -m "Configure collaborative Our Universe"
git push
```

7. Pada repository GitHub, pilih `Settings → Pages → GitHub Actions`.
8. Masukkan URL GitHub Pages ke pengaturan URL Auth Supabase.
9. Akun dengan email penjaga pertama dibuat lebih dahulu dan memilih **Buat semesta baru**.
10. Salin kode undangan.
11. Akun pasangan dibuat dengan email kedua, lalu memilih **Gabung dengan pasangan**.

Panduan Android lengkap ada di [SETUP-ANDROID.md](SETUP-ANDROID.md).

## Perintah proyek

```bash
npm run configure  # menulis URL dan key Supabase ke js/config.js
npm test           # validasi sintaks, import, file, dan schema
npm run build      # membuat folder _site untuk deployment
npm run serve      # preview lokal pada port 8080
```

## Universe Studio

Universe Studio dapat dibuka dari kartu Galaxy Hub, tombol `＋` mengambang, atau alamat:

```text
https://USERNAME.github.io/NAMA-REPO/studio/
```

Kedua anggota mempunyai hak yang sama untuk menambah, mengedit, dan menghapus isi bersama. Komentar dan reaksi tetap tercatat berdasarkan akun yang membuatnya.

## Jenis konten

| Jenis | Kegunaan |
|---|---|
| Orbit Kenangan | Folder periode berbentuk dunia kecil dengan popup perjalanan sinematik |
| Memory | Cerita lengkap dengan tanggal, tempat, mood, cuaca, tag, dan lampiran |
| Gallery | Foto dan video |
| Letter | Surat biasa atau surat terenkripsi dengan kata sandi tambahan |
| Note | Notepad bersama, daftar, dan rencana |
| Wish | Impian dengan progres dan status |
| Music | Lagu, rekaman, voice note, dan thumbnail cover khusus |
| Timeline | Tonggak perjalanan hubungan |
| Time Capsule | Pesan dan file yang tidak bisa dibaca sebelum waktu buka |
| File | PDF, teks, dokumen, arsip, dan file lainnya |

## Mode performa

- **Sinematik penuh**: partikel maksimal, bloom, afterimage, dan 60 FPS target.
- **Seimbang**: bloom aktif dengan jumlah partikel lebih rendah.
- **Hemat daya**: partikel dan resolusi WebGL dikurangi.
- **Otomatis**: memilih berdasarkan memori, jumlah core, layar, dan preferensi reduced motion.

Pengaturan performa hanya berlaku pada perangkat masing-masing. Jadi satu orang dapat memakai mode sinematik dan pasangannya memakai mode hemat tanpa mengubah perangkat lain.

## Privasi

- Bucket media bersifat private.
- Data tabel tidak dapat dibaca oleh pengguna anonim.
- RLS memeriksa keanggotaan universe pada setiap operasi.
- Trigger Auth hanya menerima dua email dalam allowlist lokal dan menolak akun ketiga.
- Akun penjaga pertama harus dibuat lebih dahulu.
- Satu akun hanya dapat menjadi anggota satu universe.
- Instalasi ini hanya dapat memiliki satu universe dengan maksimal dua anggota.
- Time Capsule memakai kebijakan database dan kebijakan Storage berdasarkan waktu buka.
- Letter berkata sandi dienkripsi di browser dengan AES-GCM dan PBKDF2-SHA256.

Kata sandi surat tidak disimpan. Jika kedua orang melupakannya, isi terenkripsi tersebut tidak dapat dipulihkan.

## Batas unggahan

Konfigurasi awal membatasi satu file hingga 80 MB pada aplikasi dan bucket. Ubah `MAX_UPLOAD_MB` di `js/config.js` dan `file_size_limit` pada bucket bila paket Supabase yang digunakan mendukung ukuran lebih besar.

## Struktur penting

```text
index.html
css/
js/
  components/
  core/
  universe/
  worlds/
studio/
supabase/
  schema.sql
  verify.sql
scripts/
tests/
.github/workflows/
```

## Tidak ada data contoh

Repository ini sengaja tidak memiliki folder data JSON berisi kenangan palsu. Database akan tetap kosong sampai salah satu dari dua anggota membuat konten pertama.

## Upgrade dari versi Two Hearts sebelumnya

Gunakan panduan [UPGRADE-COSMIC-ORBITS-ANDROID.md](UPGRADE-COSMIC-ORBITS-ANDROID.md). Migrasi bersifat aditif dan tidak menghapus akun atau data lama.
