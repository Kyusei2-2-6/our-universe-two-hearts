# Audit OUR UNIVERSE v4.9.0

## Kondisi awal v4.8.1

- Profil hanya menyimpan nama tampilan, bio, foto, dan accent.
- Tanggal lahir dan informasi personal belum tersedia.
- Durasi hubungan sudah dapat dihitung di tab Stats, tetapi belum terlihat langsung di beranda.
- Tabel `couple_relationship_profiles` hanya memuat tanggal bertemu, tanggal mulai bersama, dan nama hari jadi.
- UI Relationship Stats lebih banyak menampilkan angka aktivitas daripada perjalanan hubungan.

## Keputusan implementasi

### Profil

Kolom personal ditambahkan ke tabel `profiles` agar identitas tetap melekat pada setiap pengguna. Policy `profiles_update_own` tetap menjadi pelindung utama sehingga pasangan tidak dapat mengubah identitas pengguna lain.

### Durasi hubungan

Kolom `connected_on` ditambahkan karena tanggal mulai terhubung tidak selalu sama dengan tanggal pertama bertemu atau tanggal resmi mulai berpacaran. Sistem tetap memakai fallback tanggal lama agar data v4.7.0 tidak kehilangan fungsi.

### Relationship Journey

Tabel lama diperluas, bukan diganti. Pendekatan ini menjaga ID universe, RLS, realtime, dan data tanggal lama. Tab internal tetap memakai ID `stats` supaya tautan `bondTab=stats` dari versi sebelumnya tidak rusak.

## Pemeriksaan keamanan

- migration tidak memakai `drop table`
- migration tidak memakai `delete`
- migration tidak mengubah policy RLS
- update fallback hanya menyentuh `connected_on` yang masih kosong
- profile update tetap difilter dengan `id = auth.uid()`
- relationship update tetap memakai `updated_by = auth.uid()` dan `is_universe_member(universe_id)`
- seluruh input teks dibatasi panjangnya di client dan database
- nilai profil ditampilkan melalui `textContent`
- tanggal lahir dan milestone masa depan ditolak di client

## Pemeriksaan kompatibilitas

- package version dinaikkan menjadi 4.9.0
- cache service worker memakai nama baru
- halaman refresh baru tersedia
- seluruh query asset memakai `v=4.9.0`
- build tetap memakai mekanisme lama
- file v4.8.1 tidak dihapus
- aplikasi tetap dapat membuka fitur lama setelah migration

## Hasil validasi lokal

Perintah wajib:

```bash
npm test
npm run build
```

Validasi memeriksa sintaks JavaScript, import lokal, referensi asset, keberadaan migration, token Cosmic Identity, token Relationship Journey, dan kolom database baru.
