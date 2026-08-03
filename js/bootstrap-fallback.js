(() => {
  const timeout = window.setTimeout(() => {
    if (document.documentElement.dataset.ourUniverseBooted === 'true') return;
    const intro = document.getElementById('intro');
    const quote = document.getElementById('intro-quote');
    const enter = document.getElementById('enter-universe');
    if (intro) intro.hidden = false;
    if (quote) {
      quote.style.opacity = '1';
      quote.textContent = 'Semesta belum berhasil memuat mesin bintangnya.';
    }
    if (enter) {
      enter.style.opacity = '1';
      enter.disabled = false;
      enter.innerHTML = '<span>Muat ulang semesta</span><span aria-hidden="true">↻</span>';
      enter.onclick = () => location.reload();
    }
    const kicker = document.getElementById('intro-kicker');
    if (kicker) {
      kicker.style.opacity = '1';
      kicker.textContent = navigator.onLine ? 'KONEKSI MODUL GAGAL' : 'PERANGKAT SEDANG OFFLINE';
    }
  }, 15000);
  window.addEventListener('our-universe:booted', () => window.clearTimeout(timeout), { once:true });
})();
