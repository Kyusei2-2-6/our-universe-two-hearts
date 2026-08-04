import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from '../config.js';

let client;

function runtimeConfig() {
  try { return JSON.parse(localStorage.getItem('our-universe-runtime-config') || '{}'); }
  catch { return {}; }
}

export function getSupabaseConfig() {
  const runtime = runtimeConfig();
  return {
    url: String(runtime.url || CONFIG.SUPABASE_URL || '').trim().replace(/\/$/, ''),
    key: String(runtime.key || CONFIG.SUPABASE_PUBLISHABLE_KEY || '').trim()
  };
}

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseConfig();
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.length > 20;
}

export function setRuntimeSupabaseConfig(url, key) {
  localStorage.setItem('our-universe-runtime-config', JSON.stringify({ url:String(url).trim(), key:String(key).trim() }));
  client = undefined;
}

export function clearRuntimeSupabaseConfig() {
  localStorage.removeItem('our-universe-runtime-config');
  client = undefined;
}

export function supabase() {
  if (client) return client;
  const { url, key } = getSupabaseConfig();
  if (!isSupabaseConfigured()) throw new Error('Supabase belum dikonfigurasi. Jalankan npm run configure lalu push hasilnya ke GitHub.');
  client = createClient(url, key, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'our-universe-auth' },
    realtime: { params:{ eventsPerSecond:8 } }
  });
  return client;
}
