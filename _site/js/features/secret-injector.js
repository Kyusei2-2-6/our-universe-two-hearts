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
