import { signedUrl } from '../core/storage.js';
import { formatBytes } from '../core/utils.js';
import { openAttachment } from './media-viewer.js';
import { getDataMode } from '../core/data-mode.js';

const ICONS={image:'▧',video:'▶',audio:'♫',pdf:'PDF',text:'TXT',document:'DOC',archive:'ZIP',other:'⌑'};
const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
const economy=getDataMode()==='economy'||connection?.saveData;

export async function createMemoryViewer({entry,body='',creator='',dateLabel='',meta=[],actions=null,lockedContent=null,extraContent=[],socialContent=null}={}){
  const root=document.createElement('section');root.className='memory-experience';
  const stage=document.createElement('div');stage.className='memory-experience__stage';
  const track=document.createElement('div');track.className='memory-experience__track';stage.append(track);
  const slides=[];
  const intro=introSlide(entry,{creator,dateLabel,meta});slides.push(intro);track.append(intro);
  if(lockedContent){const slide=basicSlide('memory-experience__slide--scroll');slide.append(lockedContent);slides.push(slide);track.append(slide);}
  else{
    if(String(body||'').trim()){
      const slide=basicSlide('memory-experience__slide--story');
      const article=document.createElement('article');article.className='memory-experience__story';article.innerHTML='<p class="eyebrow">CERITA DI BALIK MOMEN</p><blockquote></blockquote>';
      article.querySelector('blockquote').textContent=body;slide.append(article);slides.push(slide);track.append(slide);
    }
    for(const attachment of entry.attachments||[]){const slide=attachmentSlide(attachment,entry.title);slides.push(slide);track.append(slide);}
    for(const node of extraContent||[]){if(!node)continue;const slide=basicSlide('memory-experience__slide--scroll');slide.append(node);slides.push(slide);track.append(slide);}
  }
  if(socialContent){const slide=basicSlide('memory-experience__slide--scroll memory-experience__slide--social');slide.append(socialContent);slides.push(slide);track.append(slide);}
  const chrome=document.createElement('div');chrome.className='memory-experience__chrome';
  chrome.innerHTML='<button class="memory-experience__nav" type="button" data-prev aria-label="Kenangan sebelumnya">←</button><div class="memory-experience__status"><span data-count></span><div class="memory-experience__dots" data-dots></div><div class="memory-experience__progress"><span data-progress></span></div></div><button class="memory-experience__nav" type="button" data-next aria-label="Kenangan berikutnya">→</button>';
  root.append(stage,chrome);
  if(actions){actions.classList.add('memory-experience__actions');root.append(actions);}
  let index=0,startX=0,dragging=false,moved=false;
  const dots=chrome.querySelector('[data-dots]');
  slides.forEach((_,slideIndex)=>{const dot=document.createElement('button');dot.type='button';dot.setAttribute('aria-label',`Buka halaman ${slideIndex+1}`);dot.onclick=()=>show(slideIndex,slideIndex>=index?1:-1);dots.append(dot);});
  chrome.querySelector('[data-prev]').onclick=()=>show(index-1,-1);
  chrome.querySelector('[data-next]').onclick=()=>show(index+1,1);
  stage.addEventListener('pointerdown',event=>{dragging=true;moved=false;startX=event.clientX;stage.setPointerCapture?.(event.pointerId);});
  stage.addEventListener('pointermove',event=>{if(dragging&&Math.abs(event.clientX-startX)>12)moved=true;});
  stage.addEventListener('pointerup',event=>{if(!dragging)return;dragging=false;const dx=event.clientX-startX;if(moved&&Math.abs(dx)>44)show(index+(dx<0?1:-1),dx<0?1:-1);stage.releasePointerCapture?.(event.pointerId);});
  stage.addEventListener('pointercancel',()=>{dragging=false;});
  root.addEventListener('keydown',event=>{if(event.key==='ArrowLeft')show(index-1,-1);if(event.key==='ArrowRight')show(index+1,1);});
  function show(next,direction=1){
    const target=Math.max(0,Math.min(slides.length-1,next));if(target===index&&slides[index]?.classList.contains('is-active'))return;
    const old=slides[index],fresh=slides[target];
    old?._deactivate?.();
    index=target;
    slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===index);slide.setAttribute('aria-hidden',i===index?'false':'true');});
    fresh?._activate?.();
    if(old&&old!==fresh)old.animate([{opacity:1,transform:'translate3d(0,0,0) scale(1)'},{opacity:0,transform:`translate3d(${-direction*10}%,0,0) scale(.965)`,filter:'blur(10px)'}],{duration:430,easing:'cubic-bezier(.4,0,1,1)'});
    fresh.animate([{opacity:0,transform:`translate3d(${direction*12}%,0,0) scale(1.035)`,filter:'blur(12px)'},{opacity:1,transform:'translate3d(0,0,0) scale(1)',filter:'blur(0px)'}],{duration:680,easing:'cubic-bezier(.16,1,.3,1)'});
    chrome.querySelector('[data-count]').textContent=`${index+1} / ${slides.length}`;
    chrome.querySelector('[data-progress]').style.width=`${((index+1)/slides.length)*100}%`;
    [...dots.children].forEach((dot,i)=>dot.classList.toggle('is-active',i===index));
    chrome.querySelector('[data-prev]').disabled=index===0;chrome.querySelector('[data-next]').disabled=index===slides.length-1;
  }
  show(0,1);
  return root;
}

function introSlide(entry,{creator,dateLabel,meta}){
  const slide=basicSlide('memory-experience__slide--intro');
  const cover=(entry.type==='music'?entry.attachments?.find(item=>item.kind==='image'&&item.metadata?.role==='thumbnail'):null)
    ||entry.attachments?.find(item=>item.kind==='image')
    ||entry.attachments?.find(item=>item.kind==='video');
  const backdrop=document.createElement('div');backdrop.className='memory-experience__backdrop';
  if(cover?.kind==='video')backdrop.innerHTML='<div class="memory-card__video-placeholder"><span>▶</span><small>Geser untuk memutar video</small></div>';
  const copy=document.createElement('div');copy.className='memory-experience__intro-copy';copy.innerHTML='<p class="eyebrow"></p><h2></h2><p class="memory-experience__byline"></p><div class="memory-experience__meta"></div><span class="memory-experience__swipe">Geser untuk melihat kenangan <b>→</b></span>';
  copy.querySelector('.eyebrow').textContent=entry.type?.toUpperCase()||'KENANGAN';copy.querySelector('h2').textContent=entry.title;copy.querySelector('.memory-experience__byline').textContent=`${creator}${dateLabel?` · ${dateLabel}`:''}`;
  const metaHost=copy.querySelector('.memory-experience__meta');for(const label of meta||[]){const chip=document.createElement('span');chip.textContent=label;metaHost.append(chip);}
  slide.append(backdrop,copy);
  if(cover?.kind==='image'){
    let loaded=false;
    slide._activate=async()=>{
      if(loaded)return;loaded=true;
      try{const url=await signedUrl(cover.file_path);const img=document.createElement('img');img.alt='';img.decoding='async';img.fetchPriority='high';img.src=url;backdrop.replaceChildren(img);}catch{}
    };
  }
  return slide;
}

function attachmentSlide(attachment,title){
  const slide=basicSlide(`memory-experience__slide--media memory-experience__slide--${attachment.kind}`);
  const loader=document.createElement('div');loader.className='memory-experience__lazy-loader';loader.innerHTML='<span></span><p>Media baru dimuat saat halaman ini dibuka.</p>';slide.append(loader);
  let loaded=false,media=null,active=false,loadVersion=0;
  slide._activate=async()=>{
    active=true;
    if(loaded)return;
    loaded=true;
    const version=++loadVersion;
    try{
      if(attachment.kind==='image'){
        const url=await signedUrl(attachment.file_path);if(!active||version!==loadVersion){loaded=false;return;}const img=document.createElement('img');img.className='memory-experience__media';img.alt=title||attachment.file_name;img.decoding='async';img.fetchPriority='high';img.src=url;media=img;loader.replaceWith(img);
      }else if(attachment.kind==='video'){
        const url=await signedUrl(attachment.file_path);if(!active||version!==loadVersion){loaded=false;return;}const video=document.createElement('video');video.className='memory-experience__media';video.controls=true;video.playsInline=true;video.preload='none';video.src=url;media=video;loader.replaceWith(video);
      }else if(attachment.kind==='audio'){
        const url=await signedUrl(attachment.file_path);if(!active||version!==loadVersion){loaded=false;return;}const audioWrap=document.createElement('div');audioWrap.className='memory-experience__audio';audioWrap.innerHTML='<div class="memory-experience__vinyl"><span>♫</span></div><div><p class="eyebrow">SUARA DARI KENANGAN</p><h3></h3><div class="memory-experience__wave" aria-hidden="true"></div></div>';
        audioWrap.querySelector('h3').textContent=attachment.file_name;const wave=audioWrap.querySelector('.memory-experience__wave');for(let i=0;i<28;i++){const bar=document.createElement('i');bar.style.setProperty('--wave-i',String(i));bar.style.height=`${12+((i*7)%9)*4}px`;wave.append(bar);}const audio=document.createElement('audio');audio.src=url;audio.controls=true;audio.preload='none';media=audio;audioWrap.append(audio);loader.replaceWith(audioWrap);
      }else{
        const portal=document.createElement('div');portal.className='memory-experience__file';portal.innerHTML='<span></span><p class="eyebrow">ARSIP KENANGAN</p><h3></h3><p class="muted"></p><button class="button button--primary" type="button">Buka lampiran</button>';
        portal.querySelector('span').textContent=ICONS[attachment.kind]||'⌑';portal.querySelector('h3').textContent=attachment.file_name;portal.querySelector('.muted').textContent=`${attachment.mime_type||attachment.kind} · ${formatBytes(attachment.size_bytes)}`;portal.querySelector('button').onclick=()=>openAttachment(attachment);loader.replaceWith(portal);
      }
      const caption=document.createElement('div');caption.className='memory-experience__caption';caption.innerHTML='<strong></strong><span></span>';caption.querySelector('strong').textContent=attachment.file_name;caption.querySelector('span').textContent=attachment.kind==='image'?'Foto':attachment.kind==='video'?'Video':attachment.kind==='audio'?'Audio':'Lampiran';slide.append(caption);
    }catch(error){loader.innerHTML='<p>Media belum dapat dimuat. Periksa koneksi lalu buka halaman ini kembali.</p>';loaded=false;}
  };
  slide._deactivate=()=>{
    active=false;loadVersion+=1;
    try{media?.pause?.();}catch{}
    if(economy&&media&&['VIDEO','AUDIO'].includes(media.tagName)){
      media.removeAttribute('src');media.load?.();loaded=false;media=null;
      slide.querySelector('.memory-experience__caption')?.remove();
      if(!slide.contains(loader)){loader.innerHTML='<span></span><p>Media baru dimuat saat halaman ini dibuka.</p>';slide.prepend(loader);}
    }
  };
  return slide;
}

function basicSlide(extra=''){const slide=document.createElement('article');slide.className=`memory-experience__slide ${extra}`.trim();slide.setAttribute('aria-hidden','true');return slide;}
