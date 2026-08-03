import { ENTRY_TYPES } from '../config.js';
import { repository } from '../core/repository.js';
import { calculateGrowth } from '../universe/growth-engine.js';
import { openTypePicker, openComposer } from '../components/composer.js';
import { createEntryCard } from '../components/entry-card.js';
import { openEntryDetail, deleteEntry, profileMap, worldHeader, emptyState } from './shared.js';

export async function renderStudio(container){
  container.innerHTML='';container.append(worldHeader({eyebrow:'UNIVERSE STUDIO',title:'Bangun semesta tanpa menyentuh kode.',subtitle:'Panel ini dibuat agar kalian berdua dapat mengelola semuanya langsung dari HP.',actions:[{label:'＋ Tambahkan sesuatu',primary:true,onClick:()=>openTypePicker({onChoose:type=>openComposer({type,onSaved:load})})}]}));
  const statsHost=document.createElement('div');statsHost.className='stat-grid';container.append(statsHost);
  const picker=document.createElement('section');picker.className='world-panel glass-panel';picker.innerHTML='<h3 style="margin-top:0">Jalan pintas</h3><div class="composer-type-grid"></div>';container.append(picker);
  for(const [type,definition] of Object.entries(ENTRY_TYPES)){const button=document.createElement('button');button.type='button';button.className='composer-type';button.innerHTML='<span></span><strong></strong>';button.querySelector('span').textContent=definition.icon;button.querySelector('strong').textContent=definition.label;button.onclick=()=>openComposer({type,onSaved:load});picker.querySelector('.composer-type-grid').append(button);}
  const heading=document.createElement('h3');heading.textContent='Isi terbaru';heading.style.marginTop='28px';container.append(heading);const grid=document.createElement('div');grid.className='content-grid';container.append(grid);
  async function load(){try{const [stats,entries]=await Promise.all([repository.stats(),repository.listEntries({limit:24})]);const growth=calculateGrowth(stats);statsHost.innerHTML='';for(const [value,label] of [[stats.entryCount,'Isi semesta'],[stats.attachmentCount,'Lampiran'],[stats.commentCount,'Komentar'],[growth.level,'Level semesta']]){const card=document.createElement('div');card.className='stat-card glass-panel';card.innerHTML='<strong></strong><span></span>';card.querySelector('strong').textContent=value;card.querySelector('span').textContent=label;statsHost.append(card);}grid.innerHTML='';if(!entries.length){grid.append(emptyState('Semesta masih kosong','Tidak ada data contoh. Kalian berdua akan membangunnya dari bagian pertama yang ditambahkan.',()=>openTypePicker({onChoose:type=>openComposer({type,onSaved:load})})));return;}const map=profileMap();for(const entry of entries)grid.append(createEntryCard(entry,{profileMap:map,onOpen:item=>openEntryDetail(item,{onChanged:load}),onEdit:item=>openComposer({type:item.type,entry:item,onSaved:load}),onDelete:item=>deleteEntry(item,load)}));}catch(error){grid.innerHTML='';grid.append(emptyState('Studio belum dapat dimuat',error.message));}}
  await load();
}
