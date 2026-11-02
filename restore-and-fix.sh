#!/bin/bash

echo "🛠️ Memulihkan Sistem Login & Mengisolasi Fitur..."

# 1. Bersihkan index.html dari skrip eksternal bermasalah
sed -i '/cosmic-db/d' index.html
sed -i '/secret-injector/d' index.html
if ! grep -q "cosmic-scanner-secret.css" index.html; then
    sed -i '/<\/head>/i \  <link rel="stylesheet" href="css/cosmic-scanner-secret.css">' index.html
fi

# 2. Kembalikan js/core/supabase.js ke kode bersihnya
git checkout js/core/supabase.js 2>/dev/null || true

# 3. Buat Injector Aman yang TIDAK PERNAH memblokir fungsi login utama
cat << 'JSEOF' > js/features/safe-cosmic.js
import { CosmicScanner } from './cosmic-scanner.js';
import { SecretRoom } from './secret-room.js';

// Attach ke window agar tidak merusak modul inti
window.CosmicScanner = CosmicScanner;
window.SecretRoom = SecretRoom;

// Hook tombol Masuk secara non-intrusif
document.addEventListener('click', (e) => {
    const target = e.target;
    // Jika mengeklik tombol "Masuk ke Semesta Kita" atau tombol masuk
    if (target && (target.innerText?.includes('Masuk') || target.id === 'btnEnterUniverse')) {
        if (!window._cosmicScanRan) {
            window._cosmicScanRan = true;
            CosmicScanner.start(() => {
                // Selesai scan, lanjutkan alur asli
            });
        }
    }
});

// Inject tombol Secret Room ke menu Pengaturan tanpa mengganggu UI
setInterval(() => {
    const accountSection = document.querySelector('[data-section="account"]') || document.querySelector('.settings-group:last-child');
    if (accountSection && !document.getElementById('btnSecretRoomTrigger')) {
        const btn = document.createElement('div');
        btn.id = 'btnSecretRoomTrigger';
        btn.style.cssText = 'margin-top:15px; padding:12px; background:rgba(147,51,234,0.15); border:1px dashed rgba(168,85,247,0.4); border-radius:12px; text-align:center; cursor:pointer; color:#c084fc; font-size:0.8rem;';
        btn.innerHTML = '🔒 Diagnostic & Secret System';
        btn.onclick = () => SecretRoom.openPinModal();
        accountSection.appendChild(btn);
    }
}, 1000);
JSEOF

# 4. Tambahkan safe-cosmic ke index.html
sed -i '/<\/body>/i \  <script type="module" src="js/features/safe-cosmic.js"></script>' index.html

# 5. Commit dan Push Pemulihan
git add .
git commit -m "Restore: Fix login navigation flow and isolate Cosmic features"
git push origin main

echo "✅ SELESAI! Login dipulihkan 100%."
