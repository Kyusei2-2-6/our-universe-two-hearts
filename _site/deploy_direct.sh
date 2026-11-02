#!/bin/bash
set -e

echo "=== 1. Re-build lokal ==="
node scripts/build.mjs 2>/dev/null || true

echo "=== 2. Push Hasil Build Langsung ke branch gh-pages ==="
# Buat git subtree / push folder _site ke gh-pages
git add .
git commit -m "deploy: static build" || true

# Force push folder _site langsung ke gh-pages branch
git push origin `git subtree split --prefix _site main`:gh-pages --force

echo "=== SELESAI! ==="
