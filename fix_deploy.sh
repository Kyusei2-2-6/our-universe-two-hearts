#!/bin/bash
set -e

echo "=== 1. Menyelaraskan Struktur Build untuk Deploy ==="
# Jalankan build mjs resmi proyek
node scripts/build.mjs

echo "=== 2. Memperbaiki Import Path & Service Worker ==="
# Salin semua isi hasil build dari _site ke root repositori
cp -rn _site/* . 2>/dev/null || cp -r _site/* .

# Update versi Service Worker agar browser pasanganmu otomatis melakukan hard refresh
BUILD_TIME=$(date +%s)
if [ -f "sw.js" ]; then
    sed -i "s/const CACHE_NAME = .*/const CACHE_NAME = \"our-universe-v4.9.5-${BUILD_TIME}\";/" sw.js
fi

echo "=== 3. Commit & Push Perbaikan ke Git ==="
git add .
git commit -m "fix: resolve dynamic module import error and update SW cache"
git push origin main || git push origin master

echo "=== SELESAI! Silakan cek status deployment di Netlify/Vercel/GitHub Pages ==="
