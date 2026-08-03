import { ENTRY_TYPES } from '../config.js';
import { signedUrl } from '../core/storage.js';
import { formatDate, truncate } from '../core/utils.js';

const PLACEHOLDERS={memory:'✦',gallery:'◫',letter:'✉',note:'▤',wish:'♡',music:'♫',timeline:'⌁',capsule:'◉',file:'⌑'};

export function createEntryCard(entry, { onOpen, onEdit, onDelete, profileMap = new Map() } = {}) {
  const card=document.createElement('article');card.className=`entry-card entry-card--${entry.type}`;card.tabIndex=0;
  const visual=document.createElement('div');
  const cover=entry.attachments?.find(item=>item.kind==='image') || entry.attachments?.find(item=>item.kind==='video');
  if(cover){visual.className='entry-card__cover-placeholder';visual.textContent='✧';loadCover(visual,cover);}else{visual.className='entry-card__cover-placeholder';visual.textContent=PLACEHOLDERS[entry.type]||'✦';}
  const body=document.createElement('div');body.className='entry-card__body';
  const creator=profileMap.get(entry.created_by)?.display_name || 'Kalian';
  const date=entry.event_date ? formatDate(entry.event_date) : formatDate(entry.created_at);
  body.innerHTML=`<div class="entry-card__meta"><span>${ENTRY_TYPES[entry.type]?.label || entry.type}</span><span>${date}</span></div><h3></h3><p></p><div class="entry-card__footer"></div>`;
  body.querySelector('h3').textContent=entry.title;
  body.querySelector('p').textContent=entry.type==='capsule' && new Date(entry.unlock_at)>new Date() ? `Terkunci sampai ${formatDate(entry.unlock_at)}` : truncate(entry.body || entry.metadata?.summary || `Dibuat oleh ${creator}`,160);
  const footer=body.querySelector('.entry-card__footer');
  if(entry.favorite)footer.append(chip('♥ Favorit'));
  if(entry.location)footer.append(chip(`⌖ ${truncate(entry.location,28)}`));
  if(entry.attachments?.length)footer.append(chip(`${entry.attachments.length} lampiran`));
  if(entry.type==='wish')footer.append(chip(`${entry.progress||0}%`));
  const actions=document.createElement('div');actions.className='entry-card__actions';
  if(onEdit){const edit=iconButton('✎','Edit');edit.onclick=e=>{e.stopPropagation();onEdit(entry);};actions.append(edit);}
  if(onDelete){const del=iconButton('×','Hapus');del.onclick=e=>{e.stopPropagation();onDelete(entry);};actions.append(del);}
  card.append(visual,body,actions);
  card.onclick=()=>onOpen?.(entry);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen?.(entry);}};
  return card;
}
function chip(text){const node=document.createElement('span');node.className='chip';node.textContent=text;return node;}
function iconButton(text,label){const button=document.createElement('button');button.type='button';button.className='icon-button';button.textContent=text;button.setAttribute('aria-label',label);return button;}
async function loadCover(host,attachment){
  try{const url=await signedUrl(attachment.file_path);if(attachment.kind==='video'){const video=document.createElement('video');video.className='entry-card__cover';video.src=url;video.muted=true;video.playsInline=true;video.preload='metadata';host.replaceWith(video);}else{const img=document.createElement('img');img.className='entry-card__cover';img.alt='';img.loading='lazy';img.src=url;host.replaceWith(img);}}catch{host.textContent='◫';}
}
