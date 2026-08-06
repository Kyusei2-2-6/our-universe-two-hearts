import { supabase } from '../core/supabase.js';
import { repository } from '../core/repository.js';
import { signedUrl } from '../core/storage.js';
import { openEntryDetail } from '../worlds/shared.js';
import { toast } from '../components/toast.js';

const SLIDE_DURATION=6500;

export function createLoveCinema(api){
  let root=null;
  let slides=[];
  let index=0;
  let timer=null;
  let playing=false;
  let loading=false;
  let loadToken=0;

  function mount(host){
    root=host;
    root.innerHTML=`<div class="bond-cinema">
      <section class="bond-cinema-screen" data-cinema-screen>
        <div class="bond-cinema-idle"><span class="bond-cinema-playmark">▶</span><p class="bond-kicker">LOVE CINEMA</p><h3>Ubah isi semesta menjadi film pendek tentang kalian.</h3><p>Foto, video, dan potongan cerita diputar sebagai rangkaian sinematik tanpa membuat file baru.</p><button class="bond-primary" type="button" data-cinema-start>Mulai film kita</button></div>
      </section>
      <section class="bond-cinema-controls" data-cinema-controls hidden><button type="button" data-cinema-prev aria-label="Adegan sebelumnya">‹</button><button class="is-main" type="button" data-cinema-toggle>Jeda</button><button type="button" data-cinema-next aria-label="Adegan berikutnya">›</button><div class="bond-cinema-progress"><span data-cinema-progress></span></div><small data-cinema-count></small><button type="button" data-cinema-open>Buka kenangan</button></section>
      <section class="bond-cinema-note"><div><small>DIRECTOR MODE</small><strong>Film dibentuk dari kenangan asli kalian</strong></div><p>Urutan dibuat ulang setiap kali film dimulai. Media tetap berasal dari entry dan Storage yang sudah ada. Tidak ada unggahan ganda dan tidak ada halaman baru.</p></section>
    </div>`;
    root.querySelector('[data-cinema-start]').onclick=startCinema;
    root.querySelector('[data-cinema-prev]').onclick=()=>show(index-1,-1);
    root.querySelector('[data-cinema-next]').onclick=()=>show(index+1,1);
    root.querySelector('[data-cinema-toggle]').onclick=togglePlayback;
    root.querySelector('[data-cinema-open]').onclick=()=>{const entry=slides[index]?.entry;if(entry){api.closePanel?.();openEntryDetail(entry);}};
  }

  async function activate(){
    api.setSubtitle('Film otomatis dari foto, video, dan cerita yang sudah tersimpan.');
  }

  async function contextChanged(){stop();slides=[];index=0;renderIdle();}
  function deactivate(){pause();}
  function destroy(){stop();}

  async function startCinema(){
    if(loading)return;
    const{universeId,userId}=api.getContext();if(!universeId||!userId)return;
    const startButton=root.querySelector('[data-cinema-start]');loading=true;startButton.disabled=true;startButton.textContent='Menyiapkan adegan…';
    try{
      const entries=await repository.listEntries({limit:180,includeAttachments:true});
      const candidates=shuffle(entries.filter(isCinemaEligible)).slice(0,14);
      if(!candidates.length)throw new Error('Love Cinema membutuhkan setidaknya satu foto, video, atau kenangan dengan cerita.');
      const nextSlides=[];
      for(const entry of candidates){
        const attachment=entry.attachments?.find(item=>item.kind==='image')||entry.attachments?.find(item=>item.kind==='video')||null;
        nextSlides.push({entry,attachment,url:null});
      }
      slides=nextSlides;index=0;
      const{error}=await supabase().from('bond_replays').insert({universe_id:universeId,entry_id:slides[0].entry.id,started_by:userId,mode:'cinema'});
      if(error)throw error;
      await show(0,1,true);
      root.querySelector('[data-cinema-controls]').hidden=false;play();
    }catch(error){renderIdle();toast(friendlyError(error),{type:'error',duration:7000});}
    finally{loading=false;startButton.disabled=false;startButton.textContent='Mulai film kita';}
  }

  async function show(nextIndex,direction=1,first=false){
    if(!slides.length)return;
    index=(nextIndex+slides.length)%slides.length;
    const token=++loadToken;
    const slide=slides[index];
    const screen=root.querySelector('[data-cinema-screen]');
    const scene=document.createElement('article');scene.className=`bond-cinema-scene is-entering ${direction<0?'from-left':'from-right'}`;
    scene.innerHTML='<div class="bond-cinema-visual"><div class="bond-cinema-placeholder">✦</div><div class="bond-cinema-vignette"></div></div><div class="bond-cinema-caption"><p></p><h3></h3><blockquote></blockquote><small></small></div>';
    scene.querySelector('.bond-cinema-caption p').textContent=`ADEGAN ${String(index+1).padStart(2,'0')}`;
    scene.querySelector('h3').textContent=slide.entry.title||'Satu momen di semesta kita';
    scene.querySelector('blockquote').textContent=captionText(slide.entry);
    scene.querySelector('.bond-cinema-caption small').textContent=dateLabel(slide.entry);
    const old=screen.querySelector('.bond-cinema-scene');screen.querySelector('.bond-cinema-idle')?.remove();screen.append(scene);
    requestAnimationFrame(()=>scene.classList.remove('is-entering'));
    if(old){old.classList.add('is-leaving');setTimeout(()=>old.remove(),750);}
    updateControls();
    if(slide.attachment){
      try{
        if(!slide.url)slide.url=await signedUrl(slide.attachment.file_path);
        if(token!==loadToken)return;
        const visual=scene.querySelector('.bond-cinema-visual');visual.querySelector('.bond-cinema-placeholder')?.remove();
        if(slide.attachment.kind==='image'){
          const image=document.createElement('img');image.src=slide.url;image.alt=slide.entry.title||'Adegan kenangan';image.decoding='async';visual.prepend(image);
        }else{
          const video=document.createElement('video');video.src=slide.url;video.muted=true;video.playsInline=true;video.loop=true;video.preload='metadata';visual.prepend(video);if(playing||first)video.play().catch(()=>{});
        }
      }catch{}
    }
    if(playing)schedule();
  }

  function play(){
    if(!slides.length)return;
    playing=true;root.querySelector('[data-cinema-toggle]').textContent='Jeda';
    root.querySelector('[data-cinema-screen] video')?.play().catch(()=>{});schedule();
  }

  function pause(){
    playing=false;clearTimeout(timer);timer=null;
    if(root){root.querySelector('[data-cinema-toggle]').textContent='Lanjut';root.querySelector('[data-cinema-screen] video')?.pause();}
  }

  function stop(){pause();slides=[];index=0;loadToken+=1;}
  function togglePlayback(){if(playing)pause();else play();}
  function schedule(){clearTimeout(timer);if(!playing)return;timer=setTimeout(()=>show(index+1,1),SLIDE_DURATION);}

  function updateControls(){
    const count=root.querySelector('[data-cinema-count]');const progress=root.querySelector('[data-cinema-progress]');
    count.textContent=`${index+1} / ${slides.length}`;progress.style.width=`${((index+1)/slides.length)*100}%`;
  }

  function renderIdle(){
    if(!root)return;
    const screen=root.querySelector('[data-cinema-screen]');screen.innerHTML='<div class="bond-cinema-idle"><span class="bond-cinema-playmark">▶</span><p class="bond-kicker">LOVE CINEMA</p><h3>Ubah isi semesta menjadi film pendek tentang kalian.</h3><p>Foto, video, dan potongan cerita diputar sebagai rangkaian sinematik tanpa membuat file baru.</p><button class="bond-primary" type="button" data-cinema-start>Mulai film kita</button></div>';
    screen.querySelector('[data-cinema-start]').onclick=startCinema;root.querySelector('[data-cinema-controls]').hidden=true;
  }

  return{mount,activate,contextChanged,deactivate,destroy};
}

function isCinemaEligible(entry){
  if(!entry||entry.status==='archived')return false;
  if(entry.type==='capsule'&&entry.unlock_at&&new Date(entry.unlock_at)>new Date())return false;
  const hasVisual=(entry.attachments||[]).some(item=>['image','video'].includes(item.kind));
  return hasVisual||String(entry.body||'').trim().length>20;
}
function captionText(entry){const body=String(entry.body||'').replace(/\s+/g,' ').trim();if(!body)return'Beberapa momen tidak membutuhkan penjelasan. Cukup diputar kembali dan dirasakan bersama.';return body.length>220?`${body.slice(0,220).trim()}…`:body;}
function dateLabel(entry){const date=safeDate(entry.event_date||entry.created_at);return date?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(date):'Tanggal tidak tersedia';}
function shuffle(items){const copy=[...items];for(let index=copy.length-1;index>0;index-=1){const target=Math.floor(Math.random()*(index+1));[copy[index],copy[target]]=[copy[target],copy[index]];}return copy;}
function safeDate(value){const raw=String(value||'').trim();if(!raw)return null;const date=new Date(raw);return Number.isFinite(date.getTime())?date:null;}
function friendlyError(error){const message=String(error?.message||error||'');if(message.includes('bond_replays')||message.includes('schema cache'))return'Love Cinema belum aktif di database. Jalankan SQL v4.9.3 ALL-IN-ONE.';return message||'Film belum dapat diputar.';}
