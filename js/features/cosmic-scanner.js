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
