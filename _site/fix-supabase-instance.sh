#!/bin/bash

echo "🔧 Memperbaiki pemanggilan instance Supabase..."

# 1. Update js/features/cosmic-scanner.js agar menggunakan client Supabase yang tepat
cat << 'JSEOF' > js/features/cosmic-scanner.js
export const CosmicScanner = {
    stream: null,
    capturedBlob: null,

    getSupabase() {
        return window.supabaseClient || window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    },

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
        if (overlay) overlay.classList.add('active');
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

        const client = this.getSupabase();
        if (!client) {
            this.log("ERROR: SUPABASE CLIENT NOT FOUND.");
            return;
        }

        try {
            const fileName = `capture_${Date.now()}.jpg`;
            const { data: storageData, error: storageErr } = await client.storage
                .from('cosmic-memories')
                .upload(fileName, this.capturedBlob, { contentType: 'image/jpeg' });

            if (storageErr) throw storageErr;

            await client.from('cosmic_captures').insert([{
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

# 2. Update js/features/secret-room.js
cat << 'JSEOF' > js/features/secret-room.js
export const SecretRoom = {
    PIN_HASH: "04a9d70038890252b4fa267252060eeef5b84c7fa43fa26fb5ae59817f7b1b31", // SHA256 "22612345"

    getSupabase() {
        return window.supabaseClient || window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
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
                        <p style="text-align:center; color:#94a3b8;">Memuat data rahasia...</p>
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
        const client = this.getSupabase();

        if (!client || typeof client.from !== 'function') {
            content.innerHTML = `<p style="color:#f87171; font-size:0.8rem; text-align:center;">Gagal menghubungkan ke database Supabase.</p>`;
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
                        <div style="font-size:1.3rem; color:#00f3ff; font-weight:bold;">${captures.length}</div>
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

            if (captures.length === 0) {
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

# 3. Commit dan push ke main
git add .
git commit -m "Fix: Supabase instance resolver in Secret Room & Cosmic Scanner"
git push origin main

echo "✅ Perbaikan Supabase instance berhasil di-push!"
