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
