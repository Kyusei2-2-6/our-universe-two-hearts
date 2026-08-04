# OUR UNIVERSE v4

OUR UNIVERSE adalah semesta digital privat untuk tepat dua orang. Versi 4 tidak memakai menu Gallery, Music, Notes, atau Files sebagai planet bawaan. Semesta dimulai kosong dan kedua pengguna menciptakan planet sendiri.

## Konsep utama

- Planet koleksi dibuat, diberi nama, diurutkan, dan diisi oleh dua pengguna
- Carousel planet 3D memiliki satu fokus besar dan jarak sentuh yang nyaman
- Matahari dan planet tata surya hanya menjadi background tema
- Composer bergaya story mendeteksi foto, video, audio, dan dokumen
- Satu entry disimpan di database lama yang aman, lalu dihubungkan ke planet melalui `planet_entries`
- Story dapat permanen, story 24 jam, atau keduanya
- Semua jenis entry dibuka dengan cinematic memory viewer
- Push notification lama tetap digunakan

## Model data v4

- `planets`
- `planet_entries`
- `stories`
- `story_views`

Tabel akun, profile, universe membership, entry, attachment, notification subscription, dan Storage tetap digunakan.

## Keamanan reset

`reset_universe_v4` hanya dapat dipanggil oleh member dengan role `owner` dan membutuhkan kalimat konfirmasi persis. Reset mempertahankan:

- `auth.users`
- `profiles`
- `universes`
- `universe_members`
- `push_subscriptions`
- `notification_preferences`

Lihat `UPGRADE-V4-ANDROID.md` untuk pemasangan dari Termux.
