import { repository } from '../core/repository.js';
import { signedUrl } from '../core/storage.js';
import { createEntryCard } from '../components/entry-card.js';
import { openComposer } from '../components/composer.js';
import { openModal } from '../components/modal.js';
import { openEntryDetail, deleteEntry, profileMap, worldHeader, emptyState } from './shared.js';

export async function renderGallery(container){
  container.innerHTML='';let currentEntries=[];
  container.append(worldHeader({eyebrow:'GALLERY',title:'Cahaya yang sempat kalian tangkap.',subtitle:'Lihat dalam grid, buka satu cerita, atau jalankan slideshow seluruh foto dan video.',actions:[{label:'▶ Slideshow',onClick:()=>openSlideshow(currentEntries)},{label:'＋ Tambah media',primary:true,onClick:()=>openComposer({type:'gallery',onSaved:load})}]}));
  const toolbar=document.createElement('div');toolbar.className='toolbar';toolbar.innerHTML='<input class="input" style="max-width:420px" type="search" placeholder="Cari judul atau lokasi…"><button class="button button--ghost" type="button" data-favorites>Favorit saja</button>';container.append(toolbar);
  const grid=document.createElement('div');grid.className='content-grid';container.append(grid);let favorites=false;let timer;
  toolbar.querySelector('input').oninput=()=>{clearTimeout(timer);timer=setTimeout(load,260);};toolbar.querySelector('[data-favorites]').onclick=event=>{favorites=!favorites;event.currentTarget.classList.toggle('button--primary',favorites);load();};
  async function load(){grid.innerHTML='<div class="skeleton" style="grid-column:1/-1;min-height:280px;border-radius:28px"></div>';try{currentEntries=await repository.listEntries({type:'gallery',query:toolbar.querySelector('input').value.trim(),favorite:favorites?true:undefined});grid.innerHTML='';if(!currentEntries.length){grid.append(emptyState('Galeri masih gelap','Unggah foto atau video pertama. Tidak ada konten contoh yang perlu dihapus.',()=>openComposer({type:'gallery',onSaved:load})));return;}const map=profileMap();for(const entry of currentEntries)grid.append(createEntryCard(entry,{profileMap:map,onOpen:item=>openEntryDetail(item,{onChanged:load}),onEdit:item=>openComposer({type:'gallery',entry:item,onSaved:load}),onDelete:item=>deleteEntry(item,load)}));}catch(error){grid.innerHTML='';grid.append(emptyState('Galeri gagal dimuat',error.message));}}
  await load();
}

async function openSlideshow(entries){
  const media=entries.flatMap(entry=>(entry.attachments||[]).filter(item=>['image','video'].includes(item.kind)).map(item=>({entry,attachment:item})));
  if(!media.length){const box=document.createElement('div');box.className='empty-state';box.textContent='Belum ada foto atau video untuk ditampilkan.';openModal({title:'Slideshow',content:box});return;}
  let index=0;let timer;const content=document.createElement('div');content.className='entry-detail';content.innerHTML='<div data-stage style="min-height:62vh;display:grid;place-items:center;background:#000;border-radius:22px;overflow:hidden"></div><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><button class="button button--ghost" data-prev>←</button><div style="text-align:center"><strong data-title></strong><br><small class="muted" data-count></small></div><button class="button button--ghost" data-next>→</button></div><button class="button button--ghost" type="button" data-auto>Mulai otomatis</button>';
  const modal=openModal({title:'Slideshow Semesta',content,onClose:()=>clearInterval(timer)});
  content.querySelector('[data-prev]').onclick=()=>show((index-1+media.length)%media.length);content.querySelector('[data-next]').onclick=()=>show((index+1)%media.length);content.querySelector('[data-auto]').onclick=event=>{if(timer){clearInterval(timer);timer=null;event.currentTarget.textContent='Mulai otomatis';}else{timer=setInterval(()=>show((index+1)%media.length),5000);event.currentTarget.textContent='Hentikan otomatis';}};
  async function show(next){index=next;const item=media[index];const stage=content.querySelector('[data-stage]');stage.innerHTML='<div class="skeleton" style="width:100%;height:62vh"></div>';try{const url=await signedUrl(item.attachment.file_path);stage.innerHTML='';if(item.attachment.kind==='video'){const video=document.createElement('video');video.src=url;video.controls=true;video.autoplay=true;video.playsInline=true;video.style.cssText='max-width:100%;max-height:68vh';stage.append(video);}else{const img=document.createElement('img');img.src=url;img.alt=item.entry.title;img.style.cssText='max-width:100%;max-height:68vh;object-fit:contain';stage.append(img);}content.querySelector('[data-title]').textContent=item.entry.title;content.querySelector('[data-count]').textContent=`${index+1} dari ${media.length}`;}catch(error){stage.textContent=error.message;}}
  show(0);return modal;
}
