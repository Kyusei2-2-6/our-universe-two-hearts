#!/bin/bash
TOKEN="$1"
BRANCH_NAME="update-$(date +%s)"
COMMIT_MSG="${2:-Auto update via Termux}"

if [ -z "$TOKEN" ]; then
  echo "Error: Masukkan GitHub Token kamu!"
  echo "Penggunaan: ./pr-update.sh KODE_TOKEN 'Pesan commit'"
  exit 1
fi

# Set remote URL dengan token
git remote set-url origin https://${TOKEN}@github.com/Kyusei2-2-6/our-universe-two-hearts.git

# Buat branch baru, commit, dan push
git checkout -b "$BRANCH_NAME"
git add .
git commit -m "$COMMIT_MSG"
git push origin "$BRANCH_NAME"

# Buat Pull Request via GitHub API
curl -X POST -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/Kyusei2-2-6/our-universe-two-hearts/pulls \
  -d "{\"title\":\"${COMMIT_MSG}\",\"head\":\"${BRANCH_NAME}\",\"base\":\"main\"}"

# Kembali ke main branch
git checkout main

echo -e "\n\n✅ Pull Request berhasil dibuat!"
