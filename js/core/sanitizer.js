const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'data:', 'blob:']);
export function sanitizeText(value, maxLength = 5000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, maxLength);
}
export function sanitizeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, location.href);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return '';
    return url.href;
  } catch {
    return '';
  }
}
export function safeHTML(strings, ...values) {
  const escape = (value) => sanitizeText(value).replace(/[&<>'"]/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[char]);
  return strings.reduce((html, part, index) => html + part + (index < values.length ? escape(values[index]) : ''), '');
}
export function validateUpload(file) {
  const allowed = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/wav','audio/ogg'];
  if (!allowed.includes(file.type)) throw new Error(`Tipe berkas ${file.type || 'tidak dikenal'} tidak diizinkan.`);
  if (file.size > 25 * 1024 * 1024) throw new Error('Ukuran berkas maksimum 25 MB untuk unggahan langsung.');
  return true;
}
