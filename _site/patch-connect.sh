#!/bin/bash

# 1. Update js/app.js untuk pemicu Cosmic Scanner pada tombol Masuk/Enter
if ! grep -q "CosmicScanner" js/app.js; then
cat << 'JSEOF' >> js/app.js

import { CosmicScanner } from './features/cosmic-scanner.js';
window.CosmicScanner = CosmicScanner;
JSEOF
fi

# 2. Update js/worlds/settings.js untuk menambahkan tombol Secret Room di bagian Akun & Data
if ! grep -q "SecretRoom" js/worlds/settings.js; then
cat << 'JSEOF' >> js/worlds/settings.js

import { SecretRoom } from '../features/secret-room.js';
window.openSecretRoomModal = () => SecretRoom.openPinModal();
JSEOF
fi

# 3. Pindah kembali ke main branch dan gabungkan perubahan
git checkout main
git merge update-1793613446 --no-edit

# 4. Commit patch koneksi ini
git add .
git commit -m "Fix: Connect Cosmic Scanner and Secret Room to app entry & settings UI"
git push origin main

echo "✅ Perubahan berhasil di-push ke main branch!"
