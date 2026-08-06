# OUR UNIVERSE v4.9.2 Rescue

Patch ini memperbaiki instalasi v4.9.0 yang terpasang sebagian atau melewati SQL migration.

## Perbaikan utama

- Relationship Journey tidak lagi terlihat seperti error besar saat schema belum aktif.
- Disediakan satu SQL Rescue yang dapat membuat tabel dasar apabila migration v4.7 terlewati.
- SQL tetap idempotent dan tidak menghapus data lama.
- Empat portal utama selalu terlihat dalam grid 2 x 2 pada Android.
- Cache service worker dinaikkan ke v4.9.2 agar CSS dan JavaScript lama tidak tercampur.
- Cosmic Identity, Relationship Clock, dan Journey tetap dipertahankan.

## Urutan pemasangan

1. Timpa repository dengan isi paket ini.
2. Jalankan `RUN-THIS-IN-SUPABASE-V4.9.2-RESCUE.sql` pada Supabase SQL Editor.
3. Commit dan push ke GitHub Pages.
4. Buka `refresh-492.html` satu kali dari alamat website.
