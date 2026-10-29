import { qs } from '../core/utils.js';

// Daftar modal yang sedang terbuka. Yang paling akhir = paling atas.
const stack = [];
let escapeBound = false;
const lightMotion = () => matchMedia('(max-width: 820px), (pointer: coarse), (prefers-reduced-motion: reduce)').matches;

// Satu pendengar Escape untuk semua modal: hanya modal paling atas yang bereaksi.
function handleEscape(event) {
  if (event.key !== 'Escape') return;
  const top = stack[stack.length - 1];
  if (top?.dismissible) top.requestClose();
}

export function openModal({ title = '', content, className = '', onClose, origin = null, dismissible = true, confirmClose = null } = {}) {
  const root = qs('#modal-root');
  const backdrop = document.createElement('div');
  let closing = false;
  let finished = false;
  let downOnBackdrop = false;
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="modal glass-panel ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal__header"><h2 id="modal-title"></h2><button class="icon-button" type="button" data-close aria-label="Tutup">×</button></header><div class="modal__content"></div></section>`;
  backdrop.querySelector('#modal-title').textContent = title;
  const panel = backdrop.querySelector('.modal');
  const container = backdrop.querySelector('.modal__content');
  if (content instanceof Node) container.append(content); else container.textContent = String(content ?? '');

  const entry = { dismissible, requestClose: () => requestClose(), close: () => close() };

  const finish = () => {
    if (finished) return;
    finished = true;
    backdrop.remove();
    if (!root.children.length) {
      document.body.classList.remove('no-scroll');
      document.body.dataset.modalOpen = 'false';
    }
    onClose?.();
  };

  // Menutup langsung, tanpa bertanya.
  const close = () => {
    if (closing) return;
    closing = true;
    const index = stack.indexOf(entry);
    if (index >= 0) stack.splice(index, 1);
    const light = lightMotion();
    const panelAnimation = panel.animate(light
      ? [{ opacity:1, transform:'translate3d(0,0,0)' }, { opacity:0, transform:'translate3d(0,14px,0)' }]
      : [{ opacity:1, transform:'translate3d(0,0,0) scale(1)', filter:'blur(0px)' }, { opacity:0, transform:'translate3d(0,18px,0) scale(.975)', filter:'blur(5px)' }],
      { duration: light ? 160 : 220, easing:'cubic-bezier(.4,0,1,1)', fill:'forwards' });
    const backdropAnimation = backdrop.animate([{ opacity:1 }, { opacity:0 }], { duration: light ? 170 : 240, fill:'forwards' });
    Promise.allSettled([panelAnimation.finished, backdropAnimation.finished]).then(finish);
    // Cadangan: lapisan gelap tidak boleh tertinggal walau animasi tidak pernah selesai (mis. tab tersembunyi).
    setTimeout(finish, 600);
  };

  // Menutup dengan menanyakan dulu jika ada draft yang belum disimpan.
  const requestClose = () => {
    if (closing) return;
    let message = null;
    try { message = typeof confirmClose === 'function' ? confirmClose() : null; } catch { message = null; }
    if (message && !window.confirm(String(message))) return;
    close();
  };

  // Klik di luar hanya menutup jika sentuhan juga DIMULAI di luar (seret seleksi teks tidak menutup modal).
  backdrop.addEventListener('pointerdown', event => { downOnBackdrop = event.target === backdrop; }, true);
  backdrop.addEventListener('click', event => {
    if (!dismissible) return;
    const hitClose = event.target.closest('[data-close]');
    if (hitClose || (event.target === backdrop && downOnBackdrop)) requestClose();
  });
  if (!escapeBound) { addEventListener('keydown', handleEscape); escapeBound = true; }
  if (!dismissible) backdrop.querySelector('[data-close]')?.remove();
  stack.push(entry);
  root.append(backdrop);
  document.body.classList.add('no-scroll');
  document.body.dataset.modalOpen = 'true';

  requestAnimationFrame(() => {
    if (closing) return;
    const light = lightMotion();
    backdrop.animate([{ opacity:0 }, { opacity:1 }], { duration: light ? 180 : 260, easing:'ease-out', fill:'both' });
    if (light) {
      panel.animate([{ opacity:0, transform:'translate3d(0,22px,0)' }, { opacity:1, transform:'translate3d(0,0,0)' }], { duration:280, easing:'cubic-bezier(.16,1,.3,1)', fill:'both' });
    } else {
      const panelRect = panel.getBoundingClientRect();
      const originRect = origin?.isConnected ? origin.getBoundingClientRect() : null;
      let fromTransform = 'translate3d(0,26px,0) scale(.94)';
      let transformOrigin = '50% 50%';
      if (originRect && originRect.width > 0 && originRect.height > 0) {
        const dx = originRect.left + originRect.width / 2 - (panelRect.left + panelRect.width / 2);
        const dy = originRect.top + originRect.height / 2 - (panelRect.top + panelRect.height / 2);
        const scale = Math.max(.08, Math.min(.78, Math.min(originRect.width / panelRect.width, originRect.height / panelRect.height)));
        fromTransform = `translate3d(${dx}px,${dy}px,0) scale(${scale})`;
        transformOrigin = `${originRect.left + originRect.width / 2 - panelRect.left}px ${originRect.top + originRect.height / 2 - panelRect.top}px`;
      }
      panel.style.transformOrigin = transformOrigin;
      panel.animate([
        { opacity:0, transform:fromTransform, filter:'blur(12px)' },
        { opacity:1, transform:'translate3d(0,0,0) scale(1)', filter:'blur(0px)' }
      ], { duration:520, easing:'cubic-bezier(.16,1,.3,1)', fill:'both' });
    }
    // Fokus ke tombol tutup HANYA jika belum ada kolom isian yang aktif (jangan mencuri fokus dari textarea).
    setTimeout(() => {
      if (closing) return;
      const active = document.activeElement;
      if (active && active !== document.body && panel.contains(active)) return;
      (panel.querySelector('[autofocus]') || backdrop.querySelector('[data-close]'))?.focus({ preventScroll:true });
    }, 420);
  });

  return { close, requestClose, element:backdrop };
}
