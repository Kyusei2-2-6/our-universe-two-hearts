import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=resolve('.');const ignored=new Set(['node_modules','_site','.git']);const errors=[];const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(ignored.has(entry.name))continue;const path=resolve(dir,entry.name);if(entry.isDirectory())await walk(path);else files.push(path);}}
await walk(root);
for(const file of files.filter(file=>extname(file)==='.js'||extname(file)==='.mjs')){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0)errors.push(`${file}: ${result.stderr}`);const source=await readFile(file,'utf8');for(const match of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)){let target=resolve(dirname(file),match[1]);if(!extname(target))target+='.js';try{await access(target);}catch{errors.push(`${file}: import tidak ditemukan ${match[1]}`);}}}
const index=await readFile(resolve('index.html'),'utf8');for(const match of index.matchAll(/(?:src|href)="([^"#]+)"/g)){const ref=match[1];if(/^(https?:|data:|mailto:)/.test(ref))continue;try{await access(resolve(ref));}catch{errors.push(`index.html: referensi tidak ditemukan ${ref}`);}}
for(const required of ['supabase/schema.sql','js/core/auth.js','js/core/repository.js','js/components/composer.js','studio/index.html','manifest.webmanifest','sw.js']){try{await access(resolve(required));}catch{errors.push(`File wajib tidak ditemukan: ${required}`);}}
const schema=await readFile(resolve('supabase/schema.sql'),'utf8');for(const token of ['enable row level security','app_config','create_universe','join_universe','update_partner_email','universe-files','entry_secrets'])if(!schema.toLowerCase().includes(token.toLowerCase()))errors.push(`schema.sql tidak memuat ${token}`);
if(errors.length){console.error(`Validasi gagal (${errors.length}):\n${errors.join('\n')}`);process.exit(1);}console.log(`Validasi berhasil. ${files.length} file diperiksa tanpa error sintaks atau referensi lokal.`);
