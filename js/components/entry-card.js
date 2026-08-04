import { ENTRY_TYPES } from '../config.js';
import { signedUrl } from '../core/storage.js';
import { formatDate, truncate } from '../core/utils.js';

const PLACEHOLDERS={memory:'✦',gallery:'◫',letter:'✉',note:'▤',wish:'♡',music:'♫',timeline:'⌁',capsule:'◉',file:'⌑'};
const ACCENTS={memory:'#8eb9ff',gallery:'#9cecff',letter:'#f2caa7',note:'#c5b4ff',wish:'#ff9fc9',music:'#a995ff',timeline:'#8de4d2',capsule:'#b6a0ff',file:'#9cc7ff'};

export function createEntryCard(entry,{onOpen,onEdit,onDelete,profileMap=new Map()}={}){
  const card=document.createElement('article');
  card.className=`entry-card entry-card--${entry.type} memory-card`;
  card.tabIndex=0;
  card.dataset.entryType=entry.type;
  card.style.setProperty('--memory-accent',ACCENTS[entry.type]||'#9fb8ff');

  const frame=document.createElement('div');frame.className='memory-card__frame';
  const visual=document.createElement('div');visual.className='memory-card__visual';
  const placeholder=document.createElement('div');placeholder.className='entry-card__cover-placeholder memory-card__placeholder';placeholder.textContent=PLACEHOLDERS[entry.type]||'✦';
  visual.append(placeholder);

  const cover=(entry.type==='music'?entry.attachments?.find(item=>item.kind==='image'&&item.metadata?.role==='thumbnail'):null)
    || entry.attachments?.find(item=>item.kind==='image')
    || entry.attachments?.find(item=>item.kind==='video');
  if(cover)loadCover(visual,cover);

  const body=document.createElement('div');body.className='entry-card__body memory-card__body';
  const creator=profileMap.get(entry.created_by)?.display_name||'Kalian';
  const date=entry.event_date?formatDate(entry.event_date):formatDate(entry.created_at);
  body.innerHTML='<div class="entry-card__meta"><span></span><span></span></div><h3></h3><p></p><div class="entry-card__footer"></div><span class="memory-card__open">Buka kenangan <b>→</b></span>';
  body.querySelector('.entry-card__meta span:first-child').textContent=ENTRY_TYPES[entry.type]?.label||entry.type;
  body.querySelector('.entry-card__meta span:last-child').textContent=date;
  body.querySelector('h3').textContent=entry.title;
  body.querySelector('p').textContent=entry.type==='capsule'&&new Date(entry.unlock_at)>new Date()
    ?`Terkunci sampai ${formatDate(entry.unlock_at)}`
    :truncate(entry.body||entry.metadata?.summary||`Dibuat oleh ${creator}`,160);

  const footer=body.querySelector('.entry-card__footer');
  if(entry.favorite)footer.append(chip('♥ Favorit'));
  if(entry.location)footer.append(chip(`⌖ ${truncate(entry.location,28)}`));
  if(entry.attachments?.length)footer.append(chip(`${entry.attachments.length} lampiran`));
  if(entry.type==='wish')footer.append(chip(`${entry.progress||0}%`));

  frame.append(visual,body);
  const border=document.createElement('span');border.className='memory-card__border';border.setAttribute('aria-hidden','true');
  const glow=document.createElement('span');glow.className='memory-card__glow';glow.setAttribute('aria-hidden','true');

  const actions=document.createElement('div');actions.className='entry-card__actions';
  if(onEdit){const edit=iconButton('✎','Edit');edit.onclick=event=>{event.stopPropagation();onEdit(entry);};actions.append(edit);}
  if(onDelete){const remove=iconButton('×','Hapus');remove.onclick=event=>{event.stopPropagation();onDelete(entry);};actions.append(remove);}

  card.append(glow,border,frame,actions);
  const open=()=>onOpen?.(entry,card);
  card.onclick=open;
  card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};
  return card;
}

function chip(text){const node=document.createElement('span');node.className='chip';node.textContent=text;return node;}
function iconButton(text,label){const button=document.createElement('button');button.type='button';button.className='icon-button';button.textContent=text;button.setAttribute('aria-label',label);return button;}

async function loadCover(host,attachment){
  try{
    const url=await signedUrl(attachment.file_path);host.innerHTML='';
    if(attachment.kind==='video'){
      const video=document.createElement('video');video.className='entry-card__cover memory-card__asset';video.src=url;video.muted=true;video.playsInline=true;video.preload='metadata';video.loop=true;
      host.append(video);
      const card=host.closest('.memory-card');
      card?.addEventListener('pointerenter',()=>video.play().catch(()=>{}));
      card?.addEventListener('pointerleave',()=>video.pause());
    }else{
      const img=document.createElement('img');img.className='entry-card__cover memory-card__asset';img.alt='';img.loading='lazy';img.src=url;host.append(img);
    }
  }catch{host.innerHTML='<div class="entry-card__cover-placeholder memory-card__placeholder">◫</div>';}
}
