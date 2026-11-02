import { repository } from '../core/repository.js';
import { createEntryCard } from '../components/entry-card.js';
import { openComposer } from '../components/composer.js';
import { openEntryDetail, deleteEntry, profileMap, worldHeader, emptyState } from './shared.js';

export async function renderSearch(container){
  container.innerHTML='';container.append(worldHeader({eyebrow:'SEARCH',title:'Cari seluruh semesta.',subtitle:'Temukan kenangan, surat, catatan, lagu, wish, kapsul, timeline, dan file dari satu tempat.'}));
  const panel=document.createElement('section');panel.className='world-panel glass-panel';panel.innerHTML='<div class="field"><label>Kata kunci</label><input class="input" type="search" autofocus placeholder="Judul, isi, lokasi…"></div><div class="filter-bar" style="margin-top:14px"></div>';container.append(panel);
  const results=document.createElement('div');results.className='content-grid';container.append(results);let activeType='';let timer;
  const types=[['','Semua'],['memory','Memories'],['gallery','Gallery'],['letter','Letters'],['note','Notes'],['wish','Wish'],['music','Music'],['timeline','Timeline'],['capsule','Capsules'],['file','Files']];
  for(const [value,label] of types){const button=document.createElement('button');button.type='button';button.className=`filter-chip${value===''?' is-active':''}`;button.textContent=label;button.onclick=()=>{activeType=value;panel.querySelectorAll('.filter-chip').forEach(item=>item.classList.toggle('is-active',item===button));load();};panel.querySelector('.filter-bar').append(button);}
  panel.querySelector('input').oninput=()=>{clearTimeout(timer);timer=setTimeout(load,260);};
  async function load(){const query=panel.querySelector('input').value.trim();results.innerHTML='';if(!query){results.append(emptyState('Ketik sesuatu untuk mencari','Pencarian tidak menampilkan isi apa pun sebelum kamu memasukkan kata kunci.'));return;}results.innerHTML='<div class="skeleton" style="grid-column:1/-1;min-height:250px;border-radius:28px"></div>';try{const entries=await repository.listEntries({type:activeType||undefined,query,limit:150});results.innerHTML='';if(!entries.length){results.append(emptyState('Tidak ditemukan',`Tidak ada isi semesta yang cocok dengan “${query}”.`));return;}const map=profileMap();for(const entry of entries)results.append(createEntryCard(entry,{profileMap:map,onOpen:(item,origin)=>openEntryDetail(item,{onChanged:load,origin}),onEdit:item=>openComposer({type:item.type,entry:item,onSaved:load}),onDelete:item=>deleteEntry(item,load)}));}catch(error){results.innerHTML='';results.append(emptyState('Pencarian gagal',error.message));}}
  load();
}
