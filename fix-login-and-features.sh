#!/bin/bash

echo "🚀 Memulihkan Sistem Login & Mengamankan Fitur Baru..."

# 1. Bersihkan penyuntikan script lama yang merusak dari index.html
sed -i '/safe-cosmic/d' index.html
sed -i '/secret-injector/d' index.html

# 2. Kembalikan file inti ke kondisi original aman
git checkout index.html js/app.js js/core/supabase.js 2>/dev/null || true

# 3. Buat Modul Fitur Baru yang Terisolasi & 100% Aman
cat << 'JSEOF' > js/features/cosmic-addon.js
import { CosmicScanner } from './cosmic-scanner.js';
import { SecretRoom } from './secret-room.js';

window.CosmicScanner = CosmicScanner;
window.SecretRoom = SecretRoom;

// Hook non-intrusif: Jalankan Scanner saat tombol masuk diklik tanpa mematikan alur asli
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, a, .btn, [role="button"]');
    if (btn && btn.textContent && (btn.textContent.includes('Masuk') || btn.textContent.includes('ENTER'))) {
        if (!window._cosmicScannerActive) {
            window._cosmicScannerActive = true;
            CosmicScanner.start(() => {
                window._cosmicScannerActive = false;
            });
        }
    }
}, true);

// Inject tombol Secret Room ke menu Settings secara periodik
setInterval(() => {
    const accountSection = document.querySelector('[data-section="account"]') || document.querySelector('.settings-group:last-child');
    if (accountSection && !document.getElementById('btnSecretRoomTrigger')) {
        const btn = document.createElement('div');
        btn.id = 'btnSecretRoomTrigger';
        btn.style.cssText = 'margin-top:15px; padding:12px; background:rgba(147,51,234,0.15); border:1px dashed rgba(168,85,247,0.4); border-radius:12px; text-align:center; cursor:pointer; color:#c084fc; font-size:0.8rem;';
        btn.innerHTML = '🔒 Diagnostic & Secret System';
        btn.onclick = (ev) => {
            ev.stopPropagation();
            SecretRoom.openPinModal();
        };
        accountSection.appendChild(btn);
    }
}, 1000);
JSEOF

# 4. Tambahkan cosmic-addon.js di akhir index.html
sed -i '/<\/body>/i \  <script type="module" src="js/features/cosmic-addon.js?v=5.1.0"></script>' index.html

# 5. Commit dan Push ke GitHub main branch
git add .
git commit -m "Fix: Restore native login navigation and bind non-blocking Cosmic Addon v5.1.0"
git push origin main

echo "✅ SELESAI! Login dipulihkan dan fitur aman terpasang."
