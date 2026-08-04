import { readFile,writeFile,access,rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve('.');
const required=[
  'index.html','css/v4-universe.css','js/components/planet-deck.js','js/components/planet-composer.js',
  'js/components/story-composer.js','js/components/rebuild-gate.js','js/worlds/planet.js',
  'supabase/migrations/2026-08-04-dynamic-planets-v4.sql'
];
for(const file of required){try{await access(resolve(root,file));}catch{throw new Error(`File patch tidak lengkap: ${file}`);}}

const configPath=resolve(root,'js/config.js');
let config=await readFile(configPath,'utf8');
if(/sb_secret_/i.test(config))throw new Error('STOP: js/config.js masih mengandung Supabase Secret Key. Gunakan publishable key.');
if(!config.includes("'planet'")){
  const before=config;
  config=config.replace(/('home'\s*,)/,"$1'planet',");
  if(config===before)throw new Error('ROUTES di js/config.js tidak dapat diperbarui otomatis.');
}

const cardsStart=config.indexOf('export const WORLD_CARDS = Object.freeze([');
if(cardsStart!==-1){
  const cardsEnd=config.indexOf(']);',cardsStart);
  if(cardsEnd!==-1)config=config.slice(0,cardsStart)+'export const WORLD_CARDS = Object.freeze([]);'+config.slice(cardsEnd+3);
}

await writeFile(configPath,config);
await rm(resolve(root,'_site'),{recursive:true,force:true});
console.log('OUR UNIVERSE v4 berhasil dipasang.');
console.log('Konfigurasi Supabase, VAPID Public Key, login, dan notifikasi lama tetap dipertahankan.');
console.log('Langkah berikutnya: jalankan migrasi dynamic-planets-v4.sql, npm test, lalu npm run build.');
