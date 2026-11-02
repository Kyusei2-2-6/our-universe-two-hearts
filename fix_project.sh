#!/bin/bash
set -e

echo "=== 1. Membersihkan Berkas Patch & Backup ==="
rm -f refresh-4*.html
rm -rf .backups/
echo "Pembersihan selesai."

echo "=== 2. Menjalankan Validasi Baseline ==="
if [ -f "scripts/validate.mjs" ]; then
    node scripts/validate.mjs
else
    echo "Warning: scripts/validate.mjs tidak ditemukan, melewati langkah validasi."
fi

echo "=== 3. Menjalankan Skrip Standalone ==="
if [ -f "fix-pure-standalone.sh" ]; then
    bash fix-pure-standalone.sh
else
    echo "Warning: fix-pure-standalone.sh tidak ditemukan."
fi

echo "=== PROSES SELESAI ==="
