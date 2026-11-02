# OUR UNIVERSE v4.9.1 · Multi-upload Android

## Masalah yang diperbaiki

Pada beberapa pemilih file Android, pengguna hanya dapat mengambil satu audio atau foto pada satu kali pemilihan. Composer versi sebelumnya juga mengganti pilihan lama ketika tombol pemilih ditekan kembali. Akibatnya, penambahan banyak media harus dilakukan melalui unggahan terpisah.

## Perubahan

- Foto, video, audio, dan dokumen tetap meminta mode pemilihan banyak file.
- File yang dipilih berikutnya ditambahkan ke antrean, bukan mengganti pilihan sebelumnya.
- Tombol **Tambah lagi** membuka kembali jenis pemilih file terakhir.
- Tombol **Hapus semua** membersihkan antrean tanpa menutup draft.
- Setiap preview memiliki tombol hapus satu per satu.
- Nomor urut dan jumlah file ditampilkan dengan jelas.
- File duplikat dari pemilihan yang sama tidak ditambahkan dua kali.
- Object URL preview dibersihkan saat preview berubah atau composer ditutup agar penggunaan memori lebih aman.
- Proses unggah tetap berurutan dan menampilkan progres file ke-n dari total file.

## Database

Tidak ada perubahan database. Tetap jalankan migration v4.9.0 bila Cosmic Identity dan Relationship Journey belum dipasang.
