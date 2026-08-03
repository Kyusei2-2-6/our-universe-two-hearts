const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}
function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function deriveKey(password, salt, iterations = 250000) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations, hash:'SHA-256' }, material,
    { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']
  );
}
export async function encryptPayload(payload, password) {
  if (!password || password.length < 4) throw new Error('Kata sandi minimal 4 karakter.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 250000;
  const key = await deriveKey(password, salt, iterations);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, plaintext));
  return { version:1, algorithm:'AES-GCM', kdf:'PBKDF2-SHA256', iterations, salt:toBase64(salt), iv:toBase64(iv), data:toBase64(encrypted) };
}
export async function decryptPayload(bundle, password) {
  try {
    const salt = fromBase64(bundle.salt);
    const iv = fromBase64(bundle.iv);
    const key = await deriveKey(password, salt, bundle.iterations || 250000);
    const decrypted = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, fromBase64(bundle.data));
    return JSON.parse(decoder.decode(decrypted));
  } catch {
    throw new Error('Kata sandi tidak cocok atau isi surat rusak.');
  }
}
