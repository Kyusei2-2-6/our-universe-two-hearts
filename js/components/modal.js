import { qs } from '../core/utils.js';

export function openModal({ title = '', content, className = '', onClose, origin = null, dismissible = true } = {}) {
  const root = qs('#modal-root');
  const backdrop = document.createElement('div');
  let closing = false;
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="modal glass-panel ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal__header"><h2 id="modal-title"></h2><button class="icon-button" type="button" data-close aria-label="Tutup">×</button></header><div class="modal__content"></div></section>`;
  backdrop.querySelector('#modal-title').textContent = title;
  const panel = backdrop.querySelector('.modal');
  const container = backdrop.querySelector('.modal__content');
  if (content instanceof Node) container.append(content); else container.textContent = String(content ?? '');

  const onKey = event => { if (dismissible && event.key === 'Escape') close(); };
  const close = () => {
    if (closing) return;
    closing = true;
    removeEventListener('keydown', onKey);
    const panelAnimation = panel.animate([
      { opacity:1, transform:'translate3d(0,0,0) scale(1)', filter:'blur(0px)' },
      { opacity:0, transform:'translate3d(0,18px,0) scale(.975)', filter:'blur(5px)' }
    ], { duration:220, easing:'cubic-bezier(.4,0,1,1)', fill:'forwards' });
    const backdropAnimation = backdrop.animate([{ opacity:1 }, { opacity:0 }], { duration:240, fill:'forwards' });
    Promise.allSettled([panelAnimation.finished, backdropAnimation.finished]).finally(() => {
      backdrop.remove();
      if (!root.children.length) {
        document.body.classList.remove('no-scroll');
        document.body.dataset.modalOpen = 'false';
      }
      onClose?.();
    });
  };

  backdrop.addEventListener('click', event => { if (!dismissible) return; if (event.target === backdrop || event.target.closest('[data-close]')) close(); });
  addEventListener('keydown', onKey);
  if(!dismissible)backdrop.querySelector('[data-close]')?.remove();
  root.append(backdrop);
  document.body.classList.add('no-scroll');
  document.body.dataset.modalOpen = 'true';

  requestAnimationFrame(() => {
    backdrop.animate([{ opacity:0 }, { opacity:1 }], { duration:260, easing:'ease-out', fill:'both' });
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
    setTimeout(() => backdrop.querySelector('[data-close]')?.focus({preventScroll:true}), 420);
  });

  return { close, element:backdrop };
}
