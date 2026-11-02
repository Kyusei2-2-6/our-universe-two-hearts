export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
export const uid = (prefix = 'id') => `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
export const formatDate = (value, options = {}) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long', ...options
}).format(new Date(value));
export const formatDateTime = (value) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long', timeStyle: 'short'
}).format(new Date(value));
export const daysBetween = (a, b) => Math.ceil((new Date(b) - new Date(a)) / 86400000);
export const debounce = (fn, delay = 180) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
export const throttle = (fn, interval = 100) => {
  let last = 0;
  return (...args) => {
    const now = performance.now();
    if (now - last >= interval) {
      last = now;
      fn(...args);
    }
  };
};
export const deepClone = (value) => structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
export const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const normalizeText = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const matchesQuery = (record, query) => normalizeText(JSON.stringify(record)).includes(normalizeText(query));
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement('a'), { href: url, download: filename });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});
export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;
export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const setDocumentTitle = (title) => { document.title = title ? `${title} · Our Universe` : 'Our Universe'; };

export const formatBytes = (bytes = 0) => {
  const units = ['B','KB','MB','GB'];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value < 10 && unit ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};
export const relativeTime = (value) => {
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('id-ID',{numeric:'auto'});
  if (abs < 60000) return rtf.format(Math.round(diff/1000),'second');
  if (abs < 3600000) return rtf.format(Math.round(diff/60000),'minute');
  if (abs < 86400000) return rtf.format(Math.round(diff/3600000),'hour');
  if (abs < 2592000000) return rtf.format(Math.round(diff/86400000),'day');
  return rtf.format(Math.round(diff/2592000000),'month');
};
export const initials = (name = '') => String(name).trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase()).join('') || '♡';
export const parseTags = (value = '') => [...new Set(String(value).split(',').map(tag => tag.trim()).filter(Boolean))].slice(0,30);
export const truncate = (value = '', length = 180) => String(value).length > length ? `${String(value).slice(0,length-1)}…` : String(value);
export const element = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key,value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(),value);
    else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) if (child != null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
};
