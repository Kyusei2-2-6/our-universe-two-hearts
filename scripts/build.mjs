import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

const root=resolve('.');const out=resolve('_site');
const excluded=new Set(['.git','node_modules','_site','tests','scripts','supabase','.github','.backups','.our-universe-backups','package-lock.json']);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const entry of await readdir(root,{withFileTypes:true})){
  if(excluded.has(entry.name))continue;
  await cp(resolve(root,entry.name),resolve(out,entry.name),{recursive:true});
}
console.log('Build selesai:',out);
