import { repository } from '../core/repository.js';
import { audioEngine } from '../core/audio-engine.js';
import { signedUrl } from '../core/storage.js';
import { createEntryCard } from '../components/entry-card.js';
import { openComposer } from '../components/composer.js';
import { toast } from '../components/toast.js';
import { openEntryDetail, deleteEntry, profileMap, worldHeader, emptyState } from './shared.js';

export async function renderMusic(container){
  container.innerHTML='';container.append(worldHeader({eyebrow:'MUSIC',title:'Lagu yang mengorbit di antara kalian.',subtitle:'Putar musik dengan crossfade, simpan rekaman, dan tuliskan mengapa sebuah lagu menjadi bagian dari hubungan kalian.',actions:[{label:'＋ Tambah musik',primary:true,onClick:()=>openComposer({type:'music',onSaved:load})}]}));
  const player=document.createElement('section');player.className='world-panel glass-panel player';player.innerHTML='<div class="album-art" style="display:grid;place-items:center;font-size:2rem;background:radial-gradient(circle,var(--accent),#11152f)">♫</div><div><p class="eyebrow">NOW PLAYING</p><h3 style="margin:.2rem 0" data-title>Belum ada lagu diputar</h3><p class="muted" style="margin:0" data-subtitle>Pilih lagu dari koleksi kalian.</p></div><button class="button button--ghost" type="button" data-toggle disabled>▶</button>';container.append(player);
  const grid=document.createElement('div');grid.className='content-grid';grid.style.marginTop='18px';container.append(grid);let currentEntry=null;
  player.querySelector('[data-toggle]').onclick=()=>{const playing=audioEngine.toggleTrack();player.querySelector('[data-toggle]').textContent=playing?'Ⅱ':'▶';};
  async function play(entry){const audio=entry.attachments?.find(item=>item.kind==='audio');if(!audio){toast('Tambahkan file audio pada item ini terlebih dahulu.');return;}try{const src=await signedUrl(audio.file_path);await audioEngine.playTrack({src,title:entry.title,id:entry.id},2.5);currentEntry=entry;player.querySelector('[data-title]').textContent=entry.title;player.querySelector('[data-subtitle]').textContent=entry.body||audio.file_name;player.querySelector('[data-toggle]').disabled=false;player.querySelector('[data-toggle]').textContent='Ⅱ';await setPlayerCover(entry);}catch(error){toast(error.message,{type:'error'});}}

  async function setPlayerCover(entry){
    const host=player.querySelector('.album-art');const thumbnail=entry.attachments?.find(item=>item.kind==='image'&&item.metadata?.role==='thumbnail')||entry.attachments?.find(item=>item.kind==='image');
    host.style.backgroundImage='';host.textContent='♫';
    if(!thumbnail)return;
    try{host.style.backgroundImage=`url("${await signedUrl(thumbnail.file_path)}")`;host.textContent='';}catch{}
  }
  async function load(){grid.innerHTML='<div class="skeleton" style="grid-column:1/-1;min-height:260px;border-radius:28px"></div>';try{const entries=await repository.listEntries({type:'music'});grid.innerHTML='';if(!entries.length){grid.append(emptyState('Belum ada lagu di semesta ini','Tambahkan lagu pertama, rekaman suara, atau musik yang selalu mengingatkan kalian satu sama lain.',()=>openComposer({type:'music',onSaved:load})));return;}const map=profileMap();for(const entry of entries){const wrap=document.createElement('div');wrap.style.cssText='grid-column:span 4;position:relative';const card=createEntryCard(entry,{profileMap:map,onOpen:item=>openEntryDetail(item,{onChanged:load}),onEdit:item=>openComposer({type:'music',entry:item,onSaved:load}),onDelete:item=>deleteEntry(item,load)});card.style.gridColumn='auto';const playButton=document.createElement('button');playButton.type='button';playButton.className='button button--primary';playButton.style.cssText='position:absolute;left:14px;top:14px;z-index:4;min-height:40px;padding:.6rem .9rem';playButton.textContent='▶ Putar';playButton.onclick=event=>{event.stopPropagation();play(entry);};wrap.append(card,playButton);grid.append(wrap);}}catch(error){grid.innerHTML='';grid.append(emptyState('Koleksi musik gagal dimuat',error.message));}}
  await load();
}
