# Romantic Push Notifications · Android

Fitur ini mengirim Web Push hanya ke perangkat pasangan. Masing-masing pengguna harus mengaktifkan notifikasi satu kali dari halaman Settings.

## 1. Pasang migrasi database

```bash
psql "host=$PGHOST port=5432 dbname=postgres user=$PGUSER sslmode=require" -W -v ON_ERROR_STOP=1 -f supabase/migrations/2026-08-04-romantic-push.sql
```

## 2. Buat kunci Web Push

```bash
npm run setup:notifications
```

Masukkan email teknis. Alamat GitHub Pages proyek ini sudah digunakan otomatis. Script menyimpan private key ke `supabase/.notification-secrets.local.env`. File ini sudah diabaikan Git dan tidak boleh dikirim ke siapa pun.

## 3. Login dan deploy Edge Function

```bash
npx supabase@latest login
```

```bash
npx supabase@latest secrets set --project-ref vqonhdalfdcutojzntdw --env-file supabase/.notification-secrets.local.env
```

```bash
npx supabase@latest functions deploy send-romantic-push --project-ref vqonhdalfdcutojzntdw
```

## 4. Validasi dan push website

```bash
npm test
npm run build
git add .
git commit -m "Add romantic push notifications"
git push
```

Pastikan `supabase/.notification-secrets.local.env` tidak terlihat di `git status`.

## 5. Aktifkan pada dua HP

Pada masing-masing HP:

1. Login ke OUR UNIVERSE.
2. Buka **Settings**.
3. Buka panel **Notifikasi romantis**.
4. Tekan **Aktifkan notifikasi**.
5. Pilih **Izinkan** pada Chrome.
6. Tekan **Tes notifikasi**.

## Batasan suara browser

Saat web atau PWA sedang aktif, OUR UNIVERSE memainkan `romantic-chime.wav`. Saat web tertutup, Android menggunakan suara sistem karena Web Push tidak dapat memaksa file suara khusus dari service worker. Suara khusus ketika aplikasi benar-benar tertutup memerlukan APK Android dan notification channel native.
