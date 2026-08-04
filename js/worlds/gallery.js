import { repository } from '../core/repository.js';
import { signedUrl } from '../core/storage.js';
import { formatDate, truncate } from '../core/utils.js';
import { openComposer } from '../components/composer.js';
import { openModal } from '../components/modal.js';
import { openEntryDetail, deleteEntry, worldHeader, emptyState } from './shared.js';
import { openPeriodExperience } from './memory-orbits.js';

export async function renderGallery(container){
  container.innerHTML='';let currentEntries=[];let currentPeriods=[];
  container.append(worldHeader({
    eyebrow:'GALERI SINEMATIK',
    title:'Bukan galeri biasa. Ini potongan perjalanan kalian.',
    subtitle:'Buka berdasarkan periode, geser cerita, atau jalankan slideshow foto dan video dengan transisi sinematik.',
    actions:[
      {label:'▶ Putar slideshow',onClick:()=>openSlideshow(currentEntries)},
      {label:'＋ Tambah media',primary:true,onClick:()=>openComposer({type:'gallery',onSaved:load})}
    ]
  }));

  const periodShelf=document.createElement('section');periodShelf.className='gallery-period-shelf';
  periodShelf.innerHTML='<div class="gallery-period-shelf__head"><div><p class="eyebrow">PERIODE KENANGAN</p><h3>Buka satu bab, lalu masuk ke ceritanya.</h3></div><span class="muted" data-period-count></span></div><div class="gallery-period-strip" data-period-strip></div>';
  container.append(periodShelf);

  const toolbar=document.createElement('div');toolbar.className='toolbar gallery-toolbar';toolbar.innerHTML='<input class="input" style="max-width:420px" type="search" placeholder="Cari judul atau lokasi…"><button class="button button--ghost" type="button" data-favorites>Favorit saja</button>';container.append(toolbar);
  const grid=document.createElement('div');grid.className='gallery-cinematic-grid';container.append(grid);let favorites=false;let timer;
  toolbar.querySelector('input').oninput=()=>{clearTimeout(timer);timer=setTimeout(load,260);};
  toolbar.querySelector('[data-favorites]').onclick=event=>{favorites=!favorites;event.currentTarget.classList.toggle('button--primary',favorites);load();};

  async function loadPeriods(){
    try{
      currentPeriods=await repository.listPeriods();
      const strip=periodShelf.querySelector('[data-period-strip]');strip.innerHTML='';
      periodShelf.querySelector('[data-period-count]').textContent=`${currentPeriods.length} periode`;
      if(!currentPeriods.length){
        const create=document.createElement('button');create.className='period-mini-card period-mini-card--empty';create.type='button';create.innerHTML='<span>◌</span><div><strong>Belum ada periode</strong><small>Buat dari Universe Studio atau menu Periode Kenangan.</small></div>';create.onclick=()=>import('../components/period-composer.js').then(({openPeriodComposer})=>openPeriodComposer({onSaved:async()=>{await loadPeriods();}}));strip.append(create);return;
      }
      for(const period of currentPeriods){
        const card=document.createElement('button');card.type='button';card.className='period-mini-card';card.style.setProperty('--period-accent',period.accent_color||'#8fb8ff');
        card.innerHTML='<span class="period-mini-card__planet"></span><div><strong></strong><small></small></div>';
        card.querySelector('strong').textContent=period.title;
        card.querySelector('small').textContent=periodRange(period);
        card.onclick=async()=>{const entries=await repository.listEntries({periodId:period.id,limit:10000,ascending:true});openPeriodExperience(period,entries,async()=>{await Promise.all([loadPeriods(),load()]);},false,card);};
        strip.append(card);
      }
    }catch(error){periodShelf.hidden=true;console.warn('Periode galeri gagal dimuat',error);}
  }

  async function load(){
    grid.innerHTML='<div class="skeleton" style="grid-column:1/-1;min-height:320px;border-radius:28px"></div>';
    try{
      currentEntries=await repository.listEntries({type:'gallery',query:toolbar.querySelector('input').value.trim(),favorite:favorites?true:undefined});
      grid.innerHTML='';
      if(!currentEntries.length){grid.append(emptyState('Galeri masih gelap','Unggah foto atau video pertama. Setelah itu, masukkan ke Periode Kenangan supaya tampil sebagai satu perjalanan.',()=>openComposer({type:'gallery',onSaved:load})));return;}
      currentEntries.forEach((entry,index)=>grid.append(createGalleryCard(entry,index,load)));
    }catch(error){grid.innerHTML='';grid.append(emptyState('Galeri gagal dimuat',error.message));}
  }
  await Promise.all([loadPeriods(),load()]);
}

function createGalleryCard(entry,index,reload){
  const card=document.createElement('article');card.className='gallery-cinematic-card';card.dataset.shape=['wide','tall','square','wide'][index%4];card.tabIndex=0;
  const media=document.createElement('div');media.className='gallery-cinematic-card__media';media.innerHTML='<span class="gallery-cinematic-card__placeholder">✦</span>';
  const copy=document.createElement('div');copy.className='gallery-cinematic-card__copy';copy.innerHTML='<div class="gallery-cinematic-card__meta"><span></span><span></span></div><h3></h3><p></p>';
  copy.querySelector('.gallery-cinematic-card__meta span:first-child').textContent=entry.event_date?formatDate(entry.event_date):formatDate(entry.created_at);
  copy.querySelector('.gallery-cinematic-card__meta span:last-child').textContent=`${entry.attachments?.length||0} media`;
  copy.querySelector('h3').textContent=entry.title;
  copy.querySelector('p').textContent=truncate(entry.body||entry.location||'Ketuk untuk membuka cerita ini.',110);
  const actions=document.createElement('div');actions.className='gallery-cinematic-card__actions';
  const edit=iconButton('✎','Edit');edit.onclick=event=>{event.stopPropagation();openComposer({type:'gallery',entry,onSaved:reload});};
  const remove=iconButton('×','Hapus');remove.onclick=async event=>{event.stopPropagation();await deleteEntry(entry,reload);};actions.append(edit,remove);
  card.append(media,copy,actions);
  const cover=(entry.attachments||[]).find(item=>item.kind==='image')||(entry.attachments||[]).find(item=>item.kind==='video');
  if(cover)loadGalleryCover(media,cover);
  const open=()=>openEntryDetail(entry,{onChanged:reload,origin:card});card.onclick=open;card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};
  return card;
}

async function loadGalleryCover(host,attachment){
  try{
    const url=await signedUrl(attachment.file_path);host.innerHTML='';
    if(attachment.kind==='video'){
      const video=document.createElement('video');video.src=url;video.muted=true;video.playsInline=true;video.loop=true;video.preload='metadata';video.className='gallery-cinematic-card__asset';
      host.append(video);host.closest('.gallery-cinematic-card')?.addEventListener('pointerenter',()=>video.play().catch(()=>{}));host.closest('.gallery-cinematic-card')?.addEventListener('pointerleave',()=>video.pause());
    }else{
      const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';img.className='gallery-cinematic-card__asset';host.append(img);
    }
  }catch{host.innerHTML='<span class="gallery-cinematic-card__placeholder">◫</span>';}
}

async function openSlideshow(entries){
  const media=entries.flatMap(entry=>(entry.attachments||[]).filter(item=>['image','video'].includes(item.kind)).map(item=>({entry,attachment:item})));
  if(!media.length){const box=document.createElement('div');box.className='empty-state';box.textContent='Belum ada foto atau video untuk ditampilkan.';openModal({title:'Slideshow',content:box});return;}

  let index=0;let timer=null;let token=0;let auto=true;let startX=0;let moved=false;
  const content=document.createElement('div');content.className='cinematic-slideshow';
  content.innerHTML='<div class="cinematic-slideshow__stage" data-stage><div class="skeleton cinematic-slideshow__loading"></div></div><div class="cinematic-slideshow__controls"><button class="button button--ghost" data-prev aria-label="Sebelumnya">←</button><div class="cinematic-slideshow__copy"><strong data-title></strong><span class="muted" data-count></span><div class="cinematic-slideshow__progress"><span data-progress></span></div></div><button class="button button--ghost" data-next aria-label="Berikutnya">→</button></div><button class="button button--ghost cinematic-slideshow__auto" type="button" data-auto>Jeda slideshow</button>';
  const modal=openModal({title:'Slideshow Semesta',content,className:'cinematic-slideshow-modal',onClose:stop});
  const stage=content.querySelector('[data-stage]');
  content.querySelector('[data-prev]').onclick=()=>show(index-1,-1);
  content.querySelector('[data-next]').onclick=()=>show(index+1,1);
  content.querySelector('[data-auto]').onclick=event=>{auto=!auto;event.currentTarget.textContent=auto?'Jeda slideshow':'Lanjutkan slideshow';if(auto)schedule();else clearTimeout(timer);};
  stage.addEventListener('pointerdown',event=>{startX=event.clientX;moved=false;stage.setPointerCapture?.(event.pointerId);});
  stage.addEventListener('pointermove',event=>{if(Math.abs(event.clientX-startX)>14)moved=true;});
  stage.addEventListener('pointerup',event=>{const dx=event.clientX-startX;if(moved&&Math.abs(dx)>46)show(index+(dx<0?1:-1),dx<0?1:-1);stage.releasePointerCapture?.(event.pointerId);});

  function stop(){clearTimeout(timer);timer=null;token++;}
  function schedule(delay=5200){clearTimeout(timer);if(auto)timer=setTimeout(()=>show(index+1,1),delay);}
  async function show(next,direction=1){
    clearTimeout(timer);const local=++token;index=(next+media.length)%media.length;const item=media[index];
    content.querySelector('[data-title]').textContent=item.entry.title;
    content.querySelector('[data-count]').textContent=`${index+1} dari ${media.length}`;
    const progress=content.querySelector('[data-progress]');progress.style.transition='none';progress.style.width='0%';
    let url;try{url=await signedUrl(item.attachment.file_path);}catch(error){stage.textContent=error.message;schedule(3200);return;}
    if(local!==token)return;
    const frame=document.createElement('div');frame.className='cinematic-slideshow__frame';frame.dataset.direction=String(direction);
    if(item.attachment.kind==='video'){
      const video=document.createElement('video');video.src=url;video.controls=true;video.autoplay=true;video.muted=true;video.playsInline=true;video.preload='auto';frame.append(video);video.addEventListener('ended',()=>auto&&show(index+1,1),{once:true});
    }else{
      const img=document.createElement('img');img.src=url;img.alt=item.entry.title;frame.append(img);try{await img.decode();}catch{}
    }
    if(local!==token)return;
    const old=stage.querySelector('.cinematic-slideshow__frame');stage.append(frame);
    frame.animate([
      {opacity:0,transform:`translate3d(${direction*8}%,0,0) scale(1.045)`,filter:'blur(10px)'},
      {opacity:1,transform:'translate3d(0,0,0) scale(1)',filter:'blur(0px)'}
    ],{duration:720,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
    if(old){old.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:`translate3d(${-direction*5}%,0,0) scale(.98)`,filter:'blur(8px)'}],{duration:520,easing:'ease-in',fill:'forwards'}).finished.finally(()=>old.remove());}
    requestAnimationFrame(()=>requestAnimationFrame(()=>{progress.style.transition='width 5.1s linear';progress.style.width='100%';}));
    schedule(item.attachment.kind==='video'?12000:5200);
  }
  show(0,1);return modal;
}

function periodRange(period){if(!period.start_date&&!period.end_date)return'Periode kalian';if(period.start_date&&period.end_date)return`${formatDate(period.start_date)} – ${formatDate(period.end_date)}`;return formatDate(period.start_date||period.end_date);}
function iconButton(text,label){const button=document.createElement('button');button.type='button';button.className='icon-button';button.textContent=text;button.setAttribute('aria-label',label);return button;}
