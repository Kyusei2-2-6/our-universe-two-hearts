#!/bin/bash
set -e

echo "=== 1. Re-build Projek ==="
node scripts/build.mjs

echo "=== 2. Menyiapkan Folder Deploy Temporary ==="
TMP_DIR=$(mktemp -d)
cp -r _site/* "$TMP_DIR"/

echo "=== 3. Pindah dan Push ke Branch gh-pages ==="
git checkout --orphan gh-pages 2>/dev/null || git checkout gh-pages
git rm -rf . > /dev/null 2>&1 || true

cp -r "$TMP_DIR"/* .
rm -rf "$TMP_DIR"

git add .
git commit -m "deploy: force publish gh-pages"
git push origin gh-pages --force

echo "=== 4. Kembali ke Branch Main ==="
git checkout main

echo "=== DEPLOY KE BRANCH GH-PAGES SUKSES! ==="
