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
