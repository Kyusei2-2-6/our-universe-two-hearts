-- Allowlist email tidak disimpan di repository agar alamat kalian tidak bocor.
-- Jalankan `npm run configure` untuk membuat:
-- supabase/allowlist.local.sql
--
-- Setelah itu, salin isi file lokal tersebut ke Supabase SQL Editor dan jalankan
-- sebelum akun pertama dibuat.
select 'Jalankan npm run configure untuk menghasilkan allowlist privat.' as petunjuk;
