import { CONFIG } from '../config.js';
import { supabase } from './supabase.js';

const signedCache = new Map();

export function detectFileKind(fileOrMime = '') {
  const mime = typeof fileOrMime === 'string' ? fileOrMime : fileOrMime.type;
  const name = typeof fileOrMime === 'string' ? '' : fileOrMime.name.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(name)) return 'text';
  if (/\.(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)$/i.test(name)) return 'document';
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'archive';
  return 'other';
}

export function safeFileName(name = 'file') {
  const parts = String(name).normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (parts || 'file').slice(-140);
}

export function validateFile(file) {
  if (!(file instanceof Blob)) throw new Error('File tidak valid.');
  const max = CONFIG.MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > max) throw new Error(`${file.name || 'File'} lebih besar dari batas ${CONFIG.MAX_UPLOAD_MB} MB.`);
  return true;
}

export async function uploadEntryFile({ universeId, entryId, file, onProgress }) {
  validateFile(file);
  const extName = safeFileName(file.name || `recording-${Date.now()}.webm`);
  const path = `${universeId}/${entryId}/${crypto.randomUUID()}-${extName}`;
  onProgress?.(12);
  const { data, error } = await supabase().storage.from(CONFIG.STORAGE_BUCKET).upload(path, file, {
    cacheControl:'3600', upsert:false, contentType:file.type || 'application/octet-stream'
  });
  if (error) throw error;
  onProgress?.(88);
  return { path:data.path, kind:detectFileKind(file), name:file.name || extName, mime_type:file.type || 'application/octet-stream', size_bytes:file.size };
}

export async function uploadAvatar({ universeId, userId, file }) {
  validateFile(file);
  if (!file.type.startsWith('image/')) throw new Error('Avatar harus berupa gambar.');
  const path = `${universeId}/profiles/${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { data, error } = await supabase().storage.from(CONFIG.STORAGE_BUCKET).upload(path, file, {
    cacheControl:'3600', upsert:false, contentType:file.type
  });
  if (error) throw error;
  return data.path;
}

export async function signedUrl(path, { download = false, force = false } = {}) {
  if (!path) return null;
  const cacheKey = `${path}|${download ? 'download' : 'view'}`;
  const cached = signedCache.get(cacheKey);
  if (!force && cached && cached.expiresAt > Date.now() + 60000) return cached.url;
  const { data, error } = await supabase().storage.from(CONFIG.STORAGE_BUCKET).createSignedUrl(path, CONFIG.SIGNED_URL_TTL_SECONDS, download ? { download:true } : undefined);
  if (error) throw error;
  signedCache.set(cacheKey, { url:data.signedUrl, expiresAt:Date.now() + CONFIG.SIGNED_URL_TTL_SECONDS * 1000 });
  return data.signedUrl;
}

export async function removeFiles(paths = []) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return;
  const { error } = await supabase().storage.from(CONFIG.STORAGE_BUCKET).remove(unique);
  if (error) throw error;
  unique.forEach(path => {
    for (const key of signedCache.keys()) if (key.startsWith(`${path}|`)) signedCache.delete(key);
  });
}
