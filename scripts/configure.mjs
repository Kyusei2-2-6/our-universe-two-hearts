import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const configFile=resolve('js/config.js');
const allowlistFile=resolve('supabase/allowlist.local.sql');
const rl=createInterface({input,output});
const sqlLiteral=value=>`'${String(value).replaceAll("'","''")}'`;
const normalizeEmail=value=>String(value).trim().toLowerCase();
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

try{
  const url=(await rl.question('Supabase Project URL: ')).trim().replace(/\/$/,'');
  const key=(await rl.question('Supabase publishable/anon key: ')).trim();
  const ownerEmail=normalizeEmail(await rl.question('Email akun kamu (penjaga pertama): '));
  const partnerEmail=normalizeEmail(await rl.question('Email akun pasangan (penjaga kedua): '));
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))throw new Error('Format Project URL tidak valid.');
  if(key.length<20)throw new Error('Publishable key terlalu pendek.');
  if(!validEmail(ownerEmail)||!validEmail(partnerEmail))throw new Error('Salah satu email tidak valid.');
  if(ownerEmail===partnerEmail)throw new Error('Email kedua akun harus berbeda.');

  await copyFile(configFile,`${configFile}.backup`);
  let source=await readFile(configFile,'utf8');
  source=source.replace(/SUPABASE_URL:\s*'[^']*'/,`SUPABASE_URL: ${JSON.stringify(url)}`);
  source=source.replace(/SUPABASE_PUBLISHABLE_KEY:\s*'[^']*'/,`SUPABASE_PUBLISHABLE_KEY: ${JSON.stringify(key)}`);
  await writeFile(configFile,source);

  const allowlist=`-- PRIVATE LOCAL SETUP FILE. Jangan commit file ini.\n`+
`update public.app_config\n`+
`set owner_email = ${sqlLiteral(ownerEmail)},\n`+
`    partner_email = ${sqlLiteral(partnerEmail)},\n`+
`    updated_at = now()\n`+
`where singleton = true;\n\n`+
`select owner_email,partner_email from public.app_config where singleton=true;\n`;
  await writeFile(allowlistFile,allowlist);

  output.write('\nKonfigurasi frontend tersimpan di js/config.js.\n');
  output.write('Allowlist privat dibuat di supabase/allowlist.local.sql dan otomatis diabaikan Git.\n');
  output.write('Jalankan isi file allowlist lokal itu di Supabase SQL Editor sebelum membuat akun.\n');
  output.write('Lanjutkan dengan: npm test && git add . && git commit -m "Configure Supabase" && git push\n');
}catch(error){output.write(`\nGagal: ${error.message}\n`);process.exitCode=1;}finally{rl.close();}
