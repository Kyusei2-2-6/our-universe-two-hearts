import { sanitizeText } from '../core/sanitizer.js';

export function toast(message, { duration = 3200, type = 'info' } = {}) {
  const root = document.querySelector('#toast-root');
  if (!root) return;
  const element = document.createElement('div');
  element.className = `toast toast--${type}`;
  element.textContent = sanitizeText(message, 500);
  root.append(element);
  setTimeout(() => {
    element.animate([{ opacity:1, transform:'translateY(0)' }, { opacity:0, transform:'translateY(12px)' }], { duration:260, fill:'forwards' })
      .finished.finally(() => element.remove());
  }, duration);
}
