#!/bin/bash
set -e

echo "=== 1. Memastikan Hasil Build Terbaru ==="
node scripts/build.mjs

echo "=== 2. Menyinkronkan Berkas Build ke Root (Fix Dynamic Import Path) ==="
cp -r _site/* .

echo "=== 3. Menjalankan HTTP Local Server di Port 8080 ==="
echo "Buka browser kamu dan akses: http://localhost:8080"
echo "----------------------------------------------------"

# Menggunakan npx serve atau python http.server
if command -v npx &> /dev/null; then
    npx serve -l 8080 .
elif command -v python3 &> /dev/null; then
    python3 -m http.server 8080
else
    echo "Pasang python atau nodejs untuk jalanin server lokal."
fi
