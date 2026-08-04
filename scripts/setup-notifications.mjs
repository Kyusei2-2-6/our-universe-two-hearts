import { generateKeyPairSync } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const configPath='js/config.js';
const envPath='supabase/.notification-secrets.local.env';
const gitignorePath='.gitignore';
const defaultOrigin='https://kyusei2-2-6.github.io/our-universe-two-hearts';
const rl=createInterface({input,output});

function parseEnv(source=''){
  return Object.fromEntries(source.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')).map(line=>{
    const index=line.indexOf('=');return index<0?[line,'']:[line.slice(0,index),line.slice(index+1)];
  }));
}

let existing={};
try{existing=parseEnv(await readFile(envPath,'utf8'));}catch{}
let publicKey=existing.VAPID_PUBLIC_KEY||'';
let privateKey=existing.VAPID_PRIVATE_KEY||'';
if(!publicKey||!privateKey){
  const {publicKey:pub,privateKey:priv}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const publicJwk=pub.export({format:'jwk'});
  const privateJwk=priv.export({format:'jwk'});
  publicKey=Buffer.concat([
    Buffer.from([4]),Buffer.from(publicJwk.x,'base64url'),Buffer.from(publicJwk.y,'base64url')
  ]).toString('base64url');
  privateKey=privateJwk.d;
}

const argumentEmail=String(process.argv[2]||'').trim();
const emailAnswer=argumentEmail||(await rl.question(`Email kontak VAPID${existing.VAPID_SUBJECT?` [${existing.VAPID_SUBJECT.replace(/^mailto:/,'')}]`:''}: `)).trim();
const email=emailAnswer||String(existing.VAPID_SUBJECT||'').replace(/^mailto:/,'');
if(!/^\S+@\S+\.\S+$/.test(email)){
  rl.close();throw new Error('Masukkan email kontak yang valid. Email ini hanya menjadi identitas teknis VAPID.');
}
const origin=String(process.argv[3]||existing.APP_ORIGIN||defaultOrigin).trim().replace(/\/$/,'');
if(!/^https:\/\//.test(origin)){
  rl.close();throw new Error('Alamat website harus menggunakan https://');
}
rl.close();

let config=await readFile(configPath,'utf8');
if(/VAPID_PUBLIC_KEY\s*:/.test(config)){
  config=config.replace(/VAPID_PUBLIC_KEY\s*:\s*['"][^'"]*['"]/,`VAPID_PUBLIC_KEY: '${publicKey}'`);
}else{
  config=config.replace(/ENABLE_PWA:\s*true/,`ENABLE_PWA: true,\n  VAPID_PUBLIC_KEY: '${publicKey}'`);
}
await writeFile(configPath,config);

await writeFile(envPath,[
  '# Jangan unggah file ini ke GitHub.',
  `VAPID_PUBLIC_KEY=${publicKey}`,
  `VAPID_PRIVATE_KEY=${privateKey}`,
  `VAPID_SUBJECT=mailto:${email}`,
  `APP_ORIGIN=${origin}`,
  ''
].join('\n'));
await chmod(envPath,0o600).catch(()=>{});

let gitignore='';try{gitignore=await readFile(gitignorePath,'utf8');}catch{}
if(!gitignore.includes('supabase/.notification-secrets.local.env')){
  gitignore+=`${gitignore.endsWith('\n')?'':'\n'}# Private Web Push keys\nsupabase/.notification-secrets.local.env\n`;
  await writeFile(gitignorePath,gitignore);
}

console.log('\nNotifikasi romantis berhasil dikonfigurasi.');
console.log('Public key dipasang ke js/config.js.');
console.log(`Private key disimpan hanya di ${envPath} dan diabaikan Git.`);
console.log('\nLangkah berikutnya:');
console.log('1. Jalankan migrasi supabase/migrations/2026-08-04-romantic-push.sql');
console.log('2. npx supabase@latest login');
console.log('3. npx supabase@latest secrets set --project-ref vqonhdalfdcutojzntdw --env-file supabase/.notification-secrets.local.env');
console.log('4. npx supabase@latest functions deploy send-romantic-push --project-ref vqonhdalfdcutojzntdw');
