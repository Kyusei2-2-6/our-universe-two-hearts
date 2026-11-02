# OUR UNIVERSE v4.9.0 · Cosmic Identity + Relationship Journey

## Perubahan utama

### 1. Penghitung hubungan di beranda

Beranda sekarang menampilkan jumlah hari dua pengguna telah terhubung. Detail di bawahnya menunjukkan durasi dalam tahun, bulan, dan hari beserta tanggal awal. Tombol tersebut membuka Relationship Journey di dalam Our Bond.

Tanggal dasar menggunakan urutan berikut:

1. `connected_on`
2. `started_on`
3. `first_met_on`

Data lama otomatis memakai tanggal hubungan yang sudah tersedia sehingga penghitung tidak perlu diisi ulang.

### 2. Cosmic Identity pada profil

Profil pribadi dan profil pasangan kini memuat:

- nama panggilan
- tanggal lahir dan hitung mundur ulang tahun
- asal atau kota
- love language
- hal favorit
- kalimat pribadi
- bio dan foto profil
- jumlah planet dan isi yang dibagikan

RLS lama tetap digunakan. Pengguna hanya dapat memperbarui profilnya sendiri. Profil pasangan hanya dapat dilihat oleh anggota universe yang sama.

### 3. Relationship Journey

Tab Stats di Our Bond berubah nama menjadi Journey tanpa mengganti ID internalnya. Bagian ini menampilkan:

- jumlah hari terhubung
- durasi dalam tahun, bulan, dan hari
- hitung mundur hari jadi berikutnya
- milestone komunikasi pertama
- milestone pertemuan pertama
- milestone kencan pertama
- tanggal mulai bersama
- jejak pertama di aplikasi
- tanggal universe dibuat
- cerita singkat hubungan
- statistik data nyata dari fitur lama

### 4. Migration aman

Migration `2026-08-06-v4-9-cosmic-identity-journey.sql` hanya menambahkan kolom. Tidak ada tabel, entry, attachment, profil, kalender, pesan, atau data Our Bond yang dihapus.

## File baru

- `css/v4.9-cosmic-identity-journey.css`
- `RUN-THIS-IN-SUPABASE-V4.9.0.sql`
- `supabase/migrations/2026-08-06-v4-9-cosmic-identity-journey.sql`
- `supabase/migrations/verify-v4-9-cosmic-identity-journey.sql`
- `refresh-490.html`
- `INSTALL-V4.9.0-ANDROID.md`
- `PATCH-V4.9.0-COSMIC-IDENTITY-JOURNEY.md`
- `AUDIT-V4.9.0-COSMIC-IDENTITY-JOURNEY.md`

## File utama yang diperbarui

- `index.html`
- `js/components/profile-menu.js`
- `js/core/auth.js`
- `js/features/living-home.js`
- `js/features/our-bond.js`
- `js/features/relationship-stats.js`
- `css/v4.8.1-living-home.css`
- `supabase/schema.sql`
- `sw.js`
- `package.json`
- `package-lock.json`
- `tests/validate.mjs`

## Kompatibilitas

- autentikasi tidak diganti
- dua anggota per universe tetap dipertahankan
- RLS profil tetap membatasi update ke pemilik profil
- RLS Relationship Journey tetap membatasi akses ke anggota universe
- tabel dan fitur v4.8.1 tetap digunakan
- route lama tidak dihapus
- tab internal `stats` tetap dipertahankan agar tautan lama tetap bekerja
- data lama tidak diubah selain pengisian fallback `connected_on` dari tanggal hubungan yang sudah ada
