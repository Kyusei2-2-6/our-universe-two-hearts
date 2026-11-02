#!/bin/bash

echo "🔧 Memperbaiki pemicu dan instance Supabase..."

# 1. Update js/core/supabase.js agar selalu menyimpan client ke window.supabaseApp
cat << 'JSEOF' >> js/core/supabase.js

// Ensure global reference for Secret Room & Cosmic Scanner
try {
    if (typeof supabase !== 'undefined') window.supabaseApp = supabase;
    if (typeof supabaseClient !== 'undefined') window.supabaseApp = supabaseClient;
} catch (e) {}
JSEOF

# 2. Update js/features/secret-room.js dengan penanganan dynamic import & global check
cat << 'JSEOF' > js/features/secret-room.js
export const SecretRoom = {
    PIN_HASH: "04a9d70038890252b4fa267252060eeef5b84c7fa43fa26fb5ae59817f7b1b31", // SHA256 "22612345"

    async getClient() {
        if (window.supabaseApp && typeof window.supabaseApp.from === 'function') return window.supabaseApp;
        if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
        if (window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
        
        // Dynamic import fallback dari core
        try {
            const coreSupabase = await import('../core/supabase.js');
            const client = coreSupabase.supabase || coreSupabase.supabaseClient || coreSupabase.default;
            if (client && typeof client.from === 'function') {
                window.supabaseApp = client;
                return client;
            }
        } catch (e) {}
        
        return null;
    },

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
                    <p style="font-size:0.8rem; color:#cbd5e1;">Masukkan Passcode Security</p>
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
            
            document.getElementById('secretPinInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.verifyPin();
            });
        }
        overlay.classList.add('active');
        document.getElementById('secretPinInput').focus();
    },

    async verifyPin() {
        const input = document.getElementById('secretPinInput').value.trim();
        const hashedInput = await this.hashPIN(input);

        if (hashedInput === this.PIN_HASH || input === "22612345") {
            const pinModal = document.getElementById('secretPinModal');
            if (pinModal) pinModal.classList.remove('active');
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
                        <h2 style="font-size:1.1rem; color:#00f3ff; margin:0;">🌌 COSMIC CONTROL CENTER</h2>
                        <button class="cosmic-btn-sci" id="btnCloseDashboard">Tutup</button>
                    </div>
                    <div id="secretDashboardContent" style="margin-top:20px;">
                        <p style="text-align:center; color:#94a3b8;">Connecting to Cosmic Database...</p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('btnCloseDashboard').onclick = () => modal.classList.remove('active');
        }

        modal.classList.add('active');
        await this.loadCapturedMoments();
    },

    async loadCapturedMoments() {
        const content = document.getElementById('secretDashboardContent');
        const client = await this.getClient();

        if (!client) {
            content.innerHTML = `<p style="color:#f87171; font-size:0.8rem; text-align:center;">Gagal menghubungkan ke database Supabase (Client Inactive).</p>`;
            return;
        }

        try {
            const { data: captures, error } = await client
                .from('cosmic_captures')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            let html = `
                <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; margin-bottom:16px;">
                    <div style="background:rgba(0,0,0,0.4); padding:10px; border-radius:10px; border:1px solid rgba(0,243,255,0.2);">
                        <div style="font-size:0.7rem; color:#94a3b8;">TOTAL FOTO</div>
                        <div style="font-size:1.3rem; color:#00f3ff; font-weight:bold;">${captures ? captures.length : 0}</div>
                    </div>
                    <div style="background:rgba(0,0,0,0.4); padding:10px; border-radius:10px; border:1px solid rgba(74,222,128,0.2);">
                        <div style="font-size:0.7rem; color:#94a3b8;">SISTEM SCANNER</div>
                        <div style="font-size:0.85rem; color:#4ade80; font-weight:bold; margin-top:4px;">ONLINE</div>
                    </div>
                </div>
                
                <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; margin-bottom:16px; font-size:0.75rem; color:#cbd5e1;">
                    <div style="color:#00f3ff; font-weight:bold; margin-bottom:4px;">💻 INFORMASI PERANGKAT</div>
                    <div>Browser: ${navigator.userAgent.substring(0, 45)}...</div>
                    <div>Resolusi: ${window.innerWidth} x ${window.innerHeight}</div>
                </div>

                <h4 style="color:#e2e8f0; margin-bottom:10px; font-size:0.9rem;">📷 CAPTURED MOMENTS</h4>
            `;

            if (!captures || captures.length === 0) {
                html += `<p style="font-size:0.8rem; color:#64748b; text-align:center; padding:15px 0;">Belum ada momen tersimpan dari Pemindai Galaksi.</p>`;
            } else {
                html += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap:10px;">`;
                for (const item of captures) {
                    if (item.image_path) {
                        const { data: pubUrl } = client.storage.from('cosmic-memories').getPublicUrl(item.image_path);
                        html += `
                            <div style="background:rgba(0,0,0,0.5); border-radius:10px; padding:6px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                                <img src="${pubUrl.publicUrl}" style="width:100%; height:90px; object-fit:cover; border-radius:6px;" />
                                <div style="font-size:0.6rem; color:#94a3b8; margin-top:4px;">${new Date(item.created_at).toLocaleDateString()}</div>
                                <button class="cosmic-btn-sci" style="padding:2px 6px; font-size:0.6rem; margin-top:4px; background:rgba(239,68,68,0.5);" onclick="window.deleteCosmicCapture('${item.id}', '${item.image_path}')">Hapus</button>
                            </div>
                        `;
                    }
                }
                html += `</div>`;
            }

            content.innerHTML = html;

            window.deleteCosmicCapture = async (id, path) => {
                if (confirm("Hapus foto ini dari Secret Room?")) {
                    await client.from('cosmic_captures').delete().eq('id', id);
                    await client.storage.from('cosmic-memories').remove([path]);
                    this.loadCapturedMoments();
                }
            };
        } catch (e) {
            content.innerHTML = `<p style="color:#f87171; font-size:0.8rem;">Gagal memuat data: ${e.message}</p>`;
        }
    }
};
JSEOF

# 3. Bump version di index.html untuk paksa refresh total
sed -i 's/secret-injector.js?v=5.0.2/secret-injector.js?v=5.0.3/g' index.html

# 4. Commit dan Push
git add .
git commit -m "Fix: Resolve Supabase client via async dynamic import fallback v5.0.3"
git push origin main

echo "✅ Selesai dipush!"
