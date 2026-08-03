import { qs } from '../core/utils.js';

export function openModal({ title = '', content, className = '', onClose } = {}) {
  const root = qs('#modal-root');
  const backdrop = document.createElement('div');
  let closing = false;
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="modal glass-panel ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal__header"><h2 id="modal-title"></h2><button class="icon-button" type="button" data-close aria-label="Tutup">×</button></header><div class="modal__content"></div></section>`;
  backdrop.querySelector('#modal-title').textContent = title;
  const container = backdrop.querySelector('.modal__content');
  if (content instanceof Node) container.append(content); else container.textContent = String(content ?? '');
  const onKey = event => { if (event.key === 'Escape') close(); };
  const close = () => {
    if (closing) return;
    closing = true;
    removeEventListener('keydown', onKey);
    backdrop.animate([{ opacity:1 }, { opacity:0 }], { duration:180, fill:'forwards' }).finished.finally(() => {
      backdrop.remove();
      if (!root.children.length) {
        document.body.classList.remove('no-scroll');
        document.body.dataset.modalOpen = 'false';
      }
      onClose?.();
    });
  };
  backdrop.addEventListener('click', event => { if (event.target === backdrop || event.target.closest('[data-close]')) close(); });
  addEventListener('keydown', onKey);
  root.append(backdrop);
  document.body.classList.add('no-scroll');
  document.body.dataset.modalOpen = 'true';
  requestAnimationFrame(() => backdrop.querySelector('[data-close]')?.focus());
  return { close, element:backdrop };
}
