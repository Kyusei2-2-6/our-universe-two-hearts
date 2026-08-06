import { signedUrl } from '../core/storage.js';
import { truncate } from '../core/utils.js';

const TYPE_LABELS={
  gallery:'Foto',memory:'Kenangan',note:'Catatan',letter:'Surat',music:'Musik',file:'Berkas',wish:'Harapan',timeline:'Momen',capsule:'Kapsul'
};
const TYPE_ICONS={gallery:'▧',memory:'✦',note:'▤',letter:'✉',music:'♫',file:'⌑',wish:'♡',timeline:'⌁',capsule:'◉'};
const pending=new WeakMap();
const observer='IntersectionObserver' in window?new IntersectionObserver(items=>{
  for(const item of items){
    if(!item.isIntersecting)continue;
    observer.unobserve(item.target);
    const task=pending.get(item.target);
    pending.delete(item.target);
    task?.();
  }
},{rootMargin:'220px 0px',threshold:.01}):null;

export function createPlanetProfileTile(entry,{profileMap=new Map(),onOpen}={}){
  const tile=document.createElement('button');
  tile.type='button';
  tile.className=`planet-profile-tile planet-profile-tile--${entry.type}`;
  tile.dataset.entryType=entry.type;
  tile.setAttribute('aria-label',`Buka ${entry.title||TYPE_LABELS[entry.type]||'isi planet'}`);

  const visual=document.createElement('span');
  visual.className='planet-profile-tile__visual';
  const media=pickPreview(entry);
  if(media?.kind==='image')queueImage(visual,media);
  else if(media?.kind==='video')renderVideoPlaceholder(visual,entry);
  else renderTextPreview(visual,entry);

  const shade=document.createElement('span');
  shade.className='planet-profile-tile__shade';
  const top=document.createElement('span');
  top.className='planet-profile-tile__top';
  top.innerHTML='<span data-type></span><span data-media></span>';
  top.querySelector('[data-type]').textContent=`${TYPE_ICONS[entry.type]||'✦'} ${TYPE_LABELS[entry.type]||entry.type}`;
  const mediaCount=entry.attachments?.length||0;
  top.querySelector('[data-media]').textContent=mediaCount>1?`▧ ${mediaCount}`:(media?.kind==='video'?'▶':'');

  const copy=document.createElement('span');
  copy.className='planet-profile-tile__copy';
  const creator=profileMap.get(entry.created_by)?.display_name||'Kalian';
  copy.innerHTML='<strong></strong><small></small>';
  copy.querySelector('strong').textContent=entry.title||'Tanpa judul';
  copy.querySelector('small').textContent=`${initials(creator)} · ${creator}`;

  tile.append(visual,shade,top,copy);
  tile.onclick=()=>onOpen?.(entry,tile);
  return tile;
}

function pickPreview(entry){
  if(entry.type==='music'){
    const thumb=entry.attachments?.find(item=>item.kind==='image'&&item.metadata?.role==='thumbnail');
    if(thumb)return thumb;
  }
  return entry.attachments?.find(item=>item.kind==='image')||entry.attachments?.find(item=>item.kind==='video')||null;
}

function queueImage(host,attachment){
  host.classList.add('is-loading');
  host.innerHTML='<span class="planet-profile-tile__loading">✦</span>';
  const load=async()=>{
    try{
      const url=await signedUrl(attachment.file_path);
      const img=document.createElement('img');
      img.alt='';img.loading='lazy';img.decoding='async';img.src=url;
      img.onload=()=>host.classList.remove('is-loading');
      img.onerror=()=>renderFallback(host);
      host.replaceChildren(img);
    }catch{renderFallback(host);}
  };
  if(observer){pending.set(host,load);observer.observe(host);}else load();
}

function renderVideoPlaceholder(host,entry){
  host.classList.add('is-video');
  host.innerHTML='<span class="planet-profile-tile__video-icon">▶</span><small>VIDEO</small>';
  host.style.setProperty('--tile-seed',String(hash(entry.id||entry.title||'video')%360));
}

function renderTextPreview(host,entry){
  host.classList.add('is-text');
  host.style.setProperty('--tile-seed',String(hash(entry.id||entry.title||entry.type)%360));
  const icon=document.createElement('span');icon.className='planet-profile-tile__text-icon';icon.textContent=TYPE_ICONS[entry.type]||'✦';
  const quote=document.createElement('span');quote.className='planet-profile-tile__text-body';quote.textContent=truncate(entry.body||entry.metadata?.summary||entry.title||'Sebuah cerita dari planet ini.',90);
  host.append(icon,quote);
}

function renderFallback(host){host.className='planet-profile-tile__visual is-text';host.innerHTML='<span class="planet-profile-tile__text-icon">✦</span><span class="planet-profile-tile__text-body">Kenangan dari planet ini</span>';}
function initials(value=''){return String(value).trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()||'♡';}
function hash(value=''){let total=0;for(const char of String(value))total=(total*31+char.charCodeAt(0))|0;return Math.abs(total);}
