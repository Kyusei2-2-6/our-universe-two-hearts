import { supabase } from '../core/supabase.js';

export const SecretRoom = {
    // Default Security PIN (SHA-256 Check)
    PIN_HASH: "04a9d70038890252b4fa267252060eeef5b84c7fa43fa26fb5ae59817f7b1b31", // SHA256 dari "22612345"

    async hashPIN(pin) {
        const msgBuffer = new TextEncoder().encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    openPinModal() {
        let overlay = document.getElementById('secretPinModal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'secretPinModal';
            overlay.className = 'secret-modal-overlay';
            overlay.innerHTML = `
                <div class="secret-center-card" style="max-width:380px; text-align:center;">
                    <h3 style="color:#00f3ff; margin-bottom:8px;">🔒 SECRET ROOM</h3>
                    <p style="font-size:0.8rem; color:#cbd5e1;">Masukkan 8-digit Passcode Security</p>
                    <input type="password" id="secretPinInput" class="secret-pin-input" maxlength="8" placeholder="••••••••" />
                    <div style="display:flex; gap:10px; justify-content:center; margin-top:10px;">
                        <button class="cosmic-btn-sci" id="btnVerifyPin">Buka Akses</button>
                        <button class="cosmic-btn-sci" id="btnClosePinModal">Batal</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('btnClosePinModal').onclick = () => overlay.classList.remove('active');
            document.getElementById('btnVerifyPin').onclick = () => this.verifyPin();
        }
        overlay.classList.add('active');
    },

    async verifyPin() {
        const input = document.getElementById('secretPinInput').value;
        const hashedInput = await this.hashPIN(input);

        if (hashedInput === this.PIN_HASH || input === "22612345") {
            document.getElementById('secretPinModal').classList.remove('active');
            this.renderDashboard();
        } else {
            alert("Passcode Salah! Akses ditolak.");
        }
    },

    async renderDashboard() {
        let modal = document.getElementById('secretDashboardModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'secretDashboardModal';
            modal.className = 'secret-modal-overlay';
            modal.innerHTML = `
                <div class="secret-center-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(168,85,247,0.3); padding-bottom:12px;">
                        <h2 style="font-size:1.2rem; color:#00f3ff;">🌌 COSMIC CONTROL CENTER</h2>
                        <button class="cosmic-btn-sci" id="btnCloseDashboard">Tutup</button>
                    </div>
                    <div id="secretDashboardContent" style="margin-top:20px;">
                        <p style="text-align:center; color:#94a3b8;">Memuat data rahasia...</p>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            document.getElementById('btnCloseDashboard').onclick = () => modal.classList.remove('active');
        }

        modal.classList.add('active');
        await this.loadCapturedMoments();
    },

    async loadCapturedMoments() {
        const content = document.getElementById('secretDashboardContent');
        try {
            const { data: captures, error } = await supabase
                .from('cosmic_captures')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            let html = `
                <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; margin-bottom:20px;">
                    <div style="background:rgba(0,0,0,0.3); padding:12px; border-radius:10px;">
                        <div style="font-size:0.75rem; color:#94a3b8;">TOTAL CAPTURES</div>
                        <div style="font-size:1.4rem; color:#00f3ff; font-weight:bold;">${captures.length}</div>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); padding:12px; border-radius:10px;">
                        <div style="font-size:0.75rem; color:#94a3b8;">SYSTEM STATUS</div>
                        <div style="font-size:0.9rem; color:#4ade80;">ONLINE (SECURE)</div>
                    </div>
                </div>
                <h4 style="color:#e2e8f0; margin-bottom:10px;">📷 Captured Moments Gallery</h4>
            `;

            if (captures.length === 0) {
                html += `<p style="font-size:0.85rem; color:#64748b; text-align:center;">Belum ada foto momen yang tersimpan.</p>`;
            } else {
                html += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:10px;">`;
                for (const item of captures) {
                    if (item.image_path) {
                        const { data: pubUrl } = supabase.storage.from('cosmic-memories').getPublicUrl(item.image_path);
                        html += `
                            <div style="background:rgba(0,0,0,0.4); border-radius:10px; padding:8px; text-align:center;">
                                <img src="${pubUrl.publicUrl}" style="width:100%; height:100px; object-fit:cover; border-radius:6px;" />
                                <div style="font-size:0.65rem; color:#94a3b8; margin-top:4px;">${new Date(item.created_at).toLocaleDateString()}</div>
                                <button class="cosmic-btn-sci" style="padding:2px 8px; font-size:0.65rem; margin-top:4px; background:rgba(239,68,68,0.4);" onclick="window.deleteCosmicCapture('${item.id}', '${item.image_path}')">Hapus</button>
                            </div>
                        `;
                    }
                }
                html += `</div>`;
            }

            content.innerHTML = html;

            window.deleteCosmicCapture = async (id, path) => {
                if (confirm("Hapus foto ini secara permanen?")) {
                    await supabase.from('cosmic_captures').delete().eq('id', id);
                    await supabase.storage.from('cosmic-memories').remove([path]);
                    this.loadCapturedMoments();
                }
            };
        } catch (e) {
            content.innerHTML = `<p style="color:#f87171;">Gagal memuat data: ${e.message}</p>`;
        }
    }
};
