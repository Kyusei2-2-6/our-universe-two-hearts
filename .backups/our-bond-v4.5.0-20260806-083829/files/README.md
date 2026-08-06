# OUR UNIVERSE v4.5.0

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
## OUR BOND v4.5.0

OUR BOND adalah satu panel terpadu untuk Heartbeat Presence, Memory Replay, Love Cinema, dan Secret Room. Fitur ini tidak membuat route baru. Semua interaksi berada di panel yang sama agar UI mobile tetap rapi dan tidak menambah banyak tombol.

Database baru memakai tabel `bond_pulses`, `bond_emotions`, `bond_replays`, `bond_capsules`, dan `bond_capsule_secrets`. Semua akses dibatasi RLS. Isi kapsul rahasia hanya dapat dibaca setelah waktu buka. Password tambahan dienkripsi di browser memakai AES-GCM.

Lihat `INSTALL-V4.5-OUR-BOND.md` untuk pemasangan patch dan migrasi Supabase.

