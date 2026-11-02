#!/bin/bash
set -e

echo "=== 1. Pindah ke Branch gh-pages ==="
git checkout gh-pages

echo "=== 2. Hapus Service Worker & Bikin SW Kosong (Unregister Force) ==="
# Mengganti sw.js dengan instruksi unregister paksa
cat << 'SW_EOF' > sw.js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
SW_EOF

echo "=== 3. Inject Reset Script ke index.html ==="
# Menambahkan script pembersih cache otomatis saat halaman dimuat
sed -i '/<head>/a <script>if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(r=>{for(let reg of r)reg.unregister();});caches.keys().then(k=>k.forEach(n=>caches.delete(n)));}</script>' index.html

echo "=== 4. Push Ulang ke gh-pages ==="
git add .
git commit -m "fix(sw): force unregister service worker and nuke all caches"
git push origin gh-pages --force

echo "=== 5. Kembali ke Branch Main ==="
git checkout main

echo "=== SELESAI! ==="
