# Instalasi v4.9.4 di Termux

```bash
cd ~/OUR-UNIVERSE-TWO-HEARTS
PATCH="/storage/emulated/0/Download/OUR-UNIVERSE-PATCH-v4.9.4-REPLAY-CINEMA-FIX.zip"
unzip -o "$PATCH" -d ~/OUR-UNIVERSE-TWO-HEARTS
npm test
node -p "require('./package.json').version"
```

Versi harus `4.9.4`. Setelah itu commit dan push, tunggu GitHub Pages, lalu buka `refresh-494.html` sekali pada setiap HP.
