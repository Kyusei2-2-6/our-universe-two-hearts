#!/bin/bash

echo "🚀 Starting Feature Installation: Cosmic Scanner & Secret Room..."

# 1. Buat File CSS Baru: css/cosmic-scanner-secret.css
cat << 'CSSEOF' > css/cosmic-scanner-secret.css
/* Cosmic Scanner & Secret Room Styles (v5.0.0) */
.cosmic-scanner-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(5, 4, 18, 0.95);
    backdrop-filter: blur(15px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #00f3ff;
    font-family: 'Courier New', Courier, monospace;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.4s ease;
}

.cosmic-scanner-overlay.active {
    opacity: 1;
    pointer-events: all;
}

.scanner-box {
    position: relative;
    width: 320px;
    height: 320px;
    border: 2px solid rgba(0, 243, 255, 0.3);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 0 30px rgba(0, 243, 255, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 35, 0.6);
}

.scanner-laser {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, transparent, #00f3ff, #ff00ea, transparent);
    box-shadow: 0 0 15px #00f3ff;
    animation: scanAnimation 2s infinite ease-in-out;
    z-index: 10;
}

@keyframes scanAnimation {
    0% { top: 0%; }
    50% { top: 98%; }
    100% { top: 0%; }
}

.scanner-video-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
}

.scanner-terminal-log {
    margin-top: 20px;
    width: 320px;
    height: 90px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(0, 243, 255, 0.2);
    border-radius: 10px;
    padding: 10px;
    font-size: 0.75rem;
    color: #a5f3fc;
    overflow-y: auto;
}

.scanner-controls {
    margin-top: 15px;
    display: flex;
    gap: 10px;
    z-index: 20;
}

.cosmic-btn-sci {
    background: linear-gradient(135deg, rgba(147, 51, 234, 0.4), rgba(59, 130, 246, 0.4));
    border: 1px solid rgba(192, 132, 252, 0.5);
    color: #fff;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.3s ease;
}

.cosmic-btn-sci:hover {
    background: rgba(147, 51, 234, 0.7);
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);
}

/* Secret Room Modal & Control Center */
.secret-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(8, 6, 24, 0.92);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}

.secret-modal-overlay.active {
    opacity: 1;
    pointer-events: all;
}

.secret-center-card {
    width: 90%;
    max-width: 600px;
    max-height: 85vh;
    background: rgba(19, 16, 48, 0.85);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 20px;
    padding: 24px;
    color: #f3e8ff;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.secret-pin-input {
    letter-spacing: 6px;
    font-size: 1.5rem;
    text-align: center;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(168, 85, 247, 0.4);
    color: #00f3ff;
    padding: 10px;
    border-radius: 10px;
    width: 100%;
    margin: 15px 0;
}
CSSEOF

# 2. Buat File JS Baru: js/features/cosmic-scanner.js
cat << 'JSEOF' > js/features/cosmic-scanner.js
import { supabase } from '../core/supabase.js';

export const CosmicScanner = {
    stream: null,
    capturedBlob: null,

    async initUI() {
        if (document.getElementById('cosmicScannerOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'cosmicScannerOverlay';
        overlay.className = 'cosmic-scanner-overlay';
        overlay.innerHTML = `
            <div class="scanner-box">
                <div class="scanner-laser" id="scannerLaser"></div>
                <video id="scannerVideo" class="scanner-video-preview" autoplay playsinline muted style="display:none;"></video>
                <img id="scannerCapturedPhoto" class="scanner-video-preview" style="display:none;" />
                <div id="scannerFallbackIcon" style="text-align:center; color:#00f3ff;">
                    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"></path>
                    </svg>
                    <p style="font-size:0.7rem; margin-top:8px;">SCANNING CORE</p>
                </div>
            </div>
            <div class="scanner-terminal-log" id="scannerTerminalLog">
                <div>[SYSTEM] INITIALIZING COSMIC SCANNER v5.0...</div>
            </div>
            <div class="scanner-controls" id="scannerControls">
                <button class="cosmic-btn-sci" id="btnEnableCamera">📷 Aktifkan Kamera</button>
                <button class="cosmic-btn-sci" id="btnSkipScan">🚀 Masuk Ke Universe</button>
            </div>
        `;
        document.body.appendChild(overlay);

        this.bindEvents();
    },

    log(msg) {
        const logBox = document.getElementById('scannerTerminalLog');
        if (logBox) {
            const entry = document.createElement('div');
            entry.textContent = `> ${msg}`;
            logBox.appendChild(entry);
            logBox.scrollTop = logBox.scrollHeight;
        }
    },

    bindEvents() {
        document.getElementById('btnEnableCamera')?.addEventListener('click', () => this.requestCamera());
        document.getElementById('btnSkipScan')?.addEventListener('click', () => this.finishScan());
    },

    async start(onCompleteCallback) {
        this.onComplete = onCompleteCallback;
        await this.initUI();
        const overlay = document.getElementById('cosmicScannerOverlay');
        overlay.classList.add('active');
        this.log("READY FOR SCANNING...");
    },

    async requestCamera() {
        try {
            this.log("REQUESTING CAMERA CONSENT...");
            this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            const video = document.getElementById('scannerVideo');
            const fallback = document.getElementById('scannerFallbackIcon');
            
            video.srcObject = this.stream;
            video.style.display = 'block';
            fallback.style.display = 'none';

            this.log("CAMERA ACCESS GRANTED.");
            
            // Re-render controls for capture
            const controls = document.getElementById('scannerControls');
            controls.innerHTML = `
                <button class="cosmic-btn-sci" id="btnTakeSnap">📸 Ambil Foto</button>
                <button class="cosmic-btn-sci" id="btnSkipScan">Batal / Lanjut</button>
            `;
            document.getElementById('btnTakeSnap').onclick = () => this.takeSnapshot();
            document.getElementById('btnSkipScan').onclick = () => this.finishScan();

        } catch (err) {
            this.log("CAMERA DENIED / NOT AVAILABLE.");
            this.log("CONTINUING WITH SYSTEM TRANSITION...");
            setTimeout(() => this.finishScan(), 1200);
        }
    },

    takeSnapshot() {
        const video = document.getElementById('scannerVideo');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
            this.capturedBlob = blob;
            const img = document.getElementById('scannerCapturedPhoto');
            img.src = URL.createObjectURL(blob);
            img.style.display = 'block';
            video.style.display = 'none';

            this.log("PHOTO CAPTURED. SIMPAN KE SECRET ROOM?");

            const controls = document.getElementById('scannerControls');
            controls.innerHTML = `
                <button class="cosmic-btn-sci" id="btnSavePhoto">💾 Simpan Foto</button>
                <button class="cosmic-btn-sci" id="btnRetakePhoto">🔄 Ulangi</button>
                <button class="cosmic-btn-sci" id="btnSkipScan">Abaikan & Masuk</button>
            `;

            document.getElementById('btnSavePhoto').onclick = () => this.uploadCapturedPhoto();
            document.getElementById('btnRetakePhoto').onclick = () => this.requestCamera();
            document.getElementById('btnSkipScan').onclick = () => this.finishScan();
        }, 'image/jpeg', 0.75);
    },

    async uploadCapturedPhoto() {
        if (!this.capturedBlob) return;
        this.log("UPLOADING TO COSMIC MEMORIES...");

        try {
            const fileName = `capture_${Date.now()}.jpg`;
            const { data: storageData, error: storageErr } = await supabase.storage
                .from('cosmic-memories')
                .upload(fileName, this.capturedBlob, { contentType: 'image/jpeg' });

            if (storageErr) throw storageErr;

            await supabase.from('cosmic_captures').insert([{
                image_path: storageData.path,
                capture_status: 'saved',
                consent_status: true,
                device_info: {
                    userAgent: navigator.userAgent,
                    screen: `${window.innerWidth}x${window.innerHeight}`
                }
            }]);

            this.log("FOTO BERHASIL DISIMPAN!");
        } catch (e) {
            this.log("UPLOAD FAILED: " + e.message);
        } finally {
            setTimeout(() => this.finishScan(), 1000);
        }
    },

    finishScan() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        const overlay = document.getElementById('cosmicScannerOverlay');
        if (overlay) overlay.classList.remove('active');

        if (typeof this.onComplete === 'function') {
            this.onComplete();
        }
    }
};
JSEOF

# 3. Buat File JS Baru: js/features/secret-room.js
cat << 'JSEOF' > js/features/secret-room.js
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
JSEOF

# 4. Modifikasi index.html untuk Menambahkan CSS Baru
if ! grep -q "cosmic-scanner-secret.css" index.html; then
    sed -i '/<\/head>/i \  <link rel="stylesheet" href="css/cosmic-scanner-secret.css">' index.html
    echo "✅ Added cosmic-scanner-secret.css to index.html"
fi

echo "✨ All core files generated successfully."
