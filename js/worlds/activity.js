import { repository } from '../core/repository.js';
import { state } from '../core/state.js';
import { formatDateTime } from '../core/utils.js';
import { worldHeader, emptyState, profileMap } from './shared.js';

export async function renderActivity(container){
  container.innerHTML='';container.append(worldHeader({eyebrow:'ACTIVITY',title:'Jejak yang kalian tinggalkan.',subtitle:'Riwayat perubahan membantu kalian mengetahui siapa yang menambah, mengubah, atau menghapus sesuatu.'}));
  const list=document.createElement('div');list.className='timeline';container.append(list);
  try{const logs=await repository.activities();list.innerHTML='';if(!logs.length){list.append(emptyState('Belum ada aktivitas','Riwayat akan muncul setelah salah satu dari kalian mulai mengisi semesta.'));return;}const map=profileMap();for(const log of logs){const item=document.createElement('article');item.className='timeline-item';const panel=document.createElement('div');panel.className='world-panel glass-panel';const name=map.get(log.actor_id)?.display_name||'Seseorang';panel.innerHTML='<div class="entry-card__meta"><strong></strong><span></span></div><h3></h3><p class="muted"></p>';panel.querySelector('strong').textContent=name;panel.querySelector('span').textContent=formatDateTime(log.created_at);panel.querySelector('h3').textContent=activityTitle(log.action,log.entity_type);panel.querySelector('p').textContent=log.metadata?.title||log.entity_id||'';item.append(panel);list.append(item);}}catch(error){list.innerHTML='';list.append(emptyState('Aktivitas gagal dimuat',error.message));}
}
function activityTitle(action,entity){const verbs={insert:'menambahkan',update:'memperbarui',delete:'menghapus'};return`${verbs[action]||action} ${entity||'isi'}`;}
