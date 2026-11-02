export const CONFIG = Object.freeze({
  SUPABASE_URL: "https://vqonhdalfdcutojzntdw.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable__Z2-7MzjiKtfQeQDoL0psg_EYLP1bWB",
  STORAGE_BUCKET: 'universe-files',
  APP_NAME: 'Our Universe',
  INTRO_QUOTE: 'Di alam semesta yang begitu luas, aku tetap menemukanmu.',
  MAX_UPLOAD_MB: 80,
  SIGNED_URL_TTL_SECONDS: 3600,
  DEFAULT_PERFORMANCE: 'auto',
  ENABLE_PWA: true,
  VAPID_PUBLIC_KEY: 'BLTzXQ6RpsF-Hxee2nMcI6sipLU0jrwAd6cMDIiMCC5PsZQeekMC_aw-IALQmPhIqgh1KkX3xj7cJeuxfqzD-Pg'
});

export const ROUTES = new Set([
  'home','planet','memories','gallery','letters','notes','wishes','music','timeline',
  'sky-tonight','time-capsules','files','search','activity','settings','studio','about-us'
]);

export const WORLD_CARDS = Object.freeze([]);

export const ENTRY_TYPES = Object.freeze({
  memory: { label:'Memory', plural:'Memories', icon:'✦', route:'memories', hint:'Cerita kenangan dengan foto, video, suara, atau file.' },
  gallery: { label:'Gallery', plural:'Gallery', icon:'◫', route:'gallery', hint:'Foto dan video yang ingin disimpan.' },
  letter: { label:'Letter', plural:'Letters', icon:'✉', route:'letters', hint:'Surat biasa atau surat dengan kata sandi.' },
  note: { label:'Note', plural:'Notes', icon:'▤', route:'notes', hint:'Catatan, daftar, rencana, atau tulisan bebas.' },
  wish: { label:'Wish', plural:'Wishes', icon:'♡', route:'wishes', hint:'Impian dan target yang ingin kalian capai.' },
  music: { label:'Music', plural:'Music', icon:'♫', route:'music', hint:'Lagu, rekaman, dan alasan lagu itu berarti.' },
  timeline: { label:'Timeline', plural:'Timeline', icon:'⌁', route:'timeline', hint:'Tonggak perjalanan hubungan kalian.' },
  capsule: { label:'Time Capsule', plural:'Time Capsules', icon:'◉', route:'time-capsules', hint:'Pesan dan file yang terkunci sampai tanggal tertentu.' },
  file: { label:'File', plural:'Files', icon:'⌑', route:'files', hint:'PDF, dokumen, arsip, dan berkas lainnya.' }
});

export const FILE_KIND = Object.freeze({
  image:'image', video:'video', audio:'audio', pdf:'pdf', text:'text', document:'document', archive:'archive', other:'other'
});
