#!/bin/bash

echo "🚀 Menyuntikkan UI Secret Room & Cosmic Scanner..."

# 1. Pastikan tombol Secret Room tersuntik ke elemen HTML Akun & Data
cat << 'JSEOF' > js/features/secret-injector.js
import { SecretRoom } from './secret-room.js';
import { CosmicScanner } from './cosmic-scanner.js';

window.SecretRoom = SecretRoom;
window.CosmicScanner = CosmicScanner;

document.addEventListener('DOMContentLoaded', () => {
    // Inject Secret Room Button into Settings
    const injectBtn = () => {
        const accountSection = document.querySelector('[data-section="account"]') || document.querySelector('.settings-group:last-child');
        if (accountSection && !document.getElementById('btnSecretRoomTrigger')) {
            const btn = document.createElement('div');
            btn.id = 'btnSecretRoomTrigger';
            btn.style.cssText = 'margin-top:15px; padding:12px; background:rgba(147,51,234,0.15); border:1px dashed rgba(168,85,247,0.4); border-radius:12px; text-align:center; cursor:pointer; color:#c084fc; font-size:0.8rem;';
            btn.innerHTML = '🔒 Diagnostic & Secret System';
            btn.onclick = () => SecretRoom.openPinModal();
            accountSection.appendChild(btn);
        }
    };
    setInterval(injectBtn, 1000);
});
JSEOF

# 2. Tambahkan script injector ke index.html
if ! grep -q "secret-injector.js" index.html; then
    sed -i '/<\/body>/i \  <script type="module" src="js/features/secret-injector.js"></script>' index.html
fi

# 3. Paksa Sync & Push ke Main Branch
git checkout main
git add .
git commit -m "Fix: Force inject Secret Room and Cosmic Scanner triggers"
git pull origin main --rebase
git push origin main

echo "✅ SUCCESS! Semua kode telah terdorong ke GitHub main branch."
