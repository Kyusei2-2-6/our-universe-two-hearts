# OUR UNIVERSE v4.9.4 Replay + Cinema Runtime Fix

Patch ini khusus memperbaiki dua alat Our Bond yang masih gagal menampilkan hasil meskipun jejak pemutaran sudah tercatat.

## Perbaikan

- Memory Replay merender kartu kenangan sebelum menulis jejak ke database.
- Kegagalan pencatatan riwayat tidak lagi menghilangkan kartu kenangan.
- Love Cinema mengganti layar pembuka secara langsung dengan adegan pertama.
- Pencatatan riwayat Cinema berjalan setelah adegan pertama terlihat.
- Scene dan kartu diberi runtime visibility guard untuk Android.
- Media gagal dimuat akan memakai fallback tanpa mematikan seluruh fitur.
- Cache PWA dinaikkan ke v4.9.4.

Tidak diperlukan SQL baru apabila Heartbeat, Secret Room, Timeline, dan Journey sudah berjalan.
