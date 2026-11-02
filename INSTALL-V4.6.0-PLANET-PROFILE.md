# Instalasi OUR UNIVERSE v4.6.0

Versi ini hanya mengubah lapisan tampilan planet dan tidak membutuhkan SQL baru.

Setelah patch dipasang:

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
npm test
npm run build
git add .
git commit -m "feat: redesign planets as profile galleries v4.6.0"
git push origin main
```

Sesudah deployment selesai, buka `refresh-460.html` satu kali untuk membersihkan cache PWA lama.
