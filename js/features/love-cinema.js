import { supabase } from '../core/supabase.js';
import { repository } from '../core/repository.js';
import { signedUrl } from '../core/storage.js';
import { openEntryDetail } from '../worlds/shared.js';
import { toast } from '../components/toast.js';

const RUNTIME_VERSION='4.9.5';
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
    root.innerHTML=`<div class="bond-cinema" data-cinema-runtime="${RUNTIME_VERSION}">
      <section class="bond-cinema-screen" data-cinema-screen data-state="idle">
        ${idleMarkup()}
      </section>
      <section class="bond-cinema-controls" data-cinema-controls hidden><button type="button" data-cinema-prev aria-label="Adegan sebelumnya">‹</button><button class="is-main" type="button" data-cinema-toggle>Jeda</button><button type="button" data-cinema-next aria-label="Adegan berikutnya">›</button><div class="bond-cinema-progress"><span data-cinema-progress></span></div><small data-cinema-count></small><button type="button" data-cinema-open>Buka kenangan</button></section>
      <section class="bond-cinema-note"><div><small>DIRECTOR MODE</small><strong>Film dibentuk dari kenangan asli kalian</strong></div><p>Urutan dibuat ulang setiap kali film dimulai. Media tetap berasal dari entry dan Storage yang sudah ada. Tidak ada unggahan ganda dan tidak ada halaman baru.</p></section>
    </div>`;
    root.addEventListener('click',handleClick);
  }

  function handleClick(event){
    const target=event.target instanceof Element?event.target.closest('button'):null;
    if(!target||!root?.contains(target))return;
    if(target.matches('[data-cinema-start]')){event.preventDefault();void startCinema();return;}
    if(target.matches('[data-cinema-prev]')){event.preventDefault();renderScene(index-1,-1);return;}
    if(target.matches('[data-cinema-next]')){event.preventDefault();renderScene(index+1,1);return;}
    if(target.matches('[data-cinema-toggle]')){event.preventDefault();togglePlayback();return;}
    if(target.matches('[data-cinema-open]')){event.preventDefault();const entry=slides[index]?.entry;if(entry){api.closePanel?.();openEntryDetail(entry);}}
  }

  async function activate(){api.setSubtitle('Film otomatis dari foto, video, dan cerita yang sudah tersimpan.');if(slides.length&&!root?.querySelector('.bond-cinema-scene'))renderScene(index,1,true);}
  async function contextChanged(){stop();renderIdle();}
  function deactivate(){pause();}
  function destroy(){stop();}

  async function startCinema(){
    if(loading||!root)return;
    const{universeId,userId}=api.getContext();
    if(!universeId||!userId){toast('Semesta belum siap. Muat ulang lalu coba lagi.',{type:'error'});return;}
    const startButton=root.querySelector('[data-cinema-start]');
    loading=true;
    if(startButton){startButton.disabled=true;startButton.textContent='Menyiapkan adegan…';}
    renderPreparing();
    try{
      const entries=await loadCinemaEntries(universeId);
      const candidates=shuffle(entries.filter(isCinemaEligible)).slice(0,14);
      if(!candidates.length)throw new Error('Love Cinema membutuhkan setidaknya satu foto, video, atau kenangan dengan cerita.');
      slides=candidates.map(entry=>({entry,attachment:preferredVisual(entry.attachments),url:null}));
      index=0;
      const controls=root.querySelector('[data-cinema-controls]');if(controls)controls.hidden=false;
      renderScene(0,1,true);
      play();
      void logCinemaStart({universeId,userId,entryId:slides[0].entry.id});
    }catch(error){
      stop();
      renderError(error);
      toast(friendlyError(error),{type:'error',duration:7000});
    }finally{
      loading=false;
      if(startButton?.isConnected){startButton.disabled=false;startButton.textContent='Mulai film kita';}
    }
  }

  async function loadCinemaEntries(universeId){
    try{
      const result=await repository.listEntries({limit:180,includeAttachments:true});
      return Array.isArray(result)?result:[];
    }catch(repositoryError){
      console.warn('Repository Cinema gagal, memakai pembacaan langsung:',repositoryError);
      const{data,error}=await supabase().from('entries').select('*').eq('universe_id',universeId).order('created_at',{ascending:false}).limit(180);
      if(error)throw error;
      const entries=Array.isArray(data)?data:[];
      if(!entries.length)return [];
      const ids=entries.map(item=>item.id).filter(Boolean);
      const{data:attachments,error:attachmentError}=await supabase().from('attachments').select('*').eq('universe_id',universeId).in('entry_id',ids).order('sort_order');
      if(attachmentError)console.warn('Lampiran Cinema gagal dimuat:',attachmentError);
      const grouped=new Map();
      for(const item of attachments||[]){if(!grouped.has(item.entry_id))grouped.set(item.entry_id,[]);grouped.get(item.entry_id).push(item);}
      return entries.map(entry=>({...entry,attachments:grouped.get(entry.id)||[]}));
    }
  }

  async function logCinemaStart({universeId,userId,entryId}){try{const{error}=await supabase().from('bond_replays').insert({universe_id:universeId,entry_id:entryId,started_by:userId,mode:'cinema'});if(error)throw error;}catch(error){console.warn('Love Cinema berjalan, tetapi jejak pemutaran gagal dicatat:',error);toast('Film berjalan. Jejak pemutaran belum dapat disimpan.',{duration:4500});}}

  function renderScene(nextIndex,direction=1,first=false){
    if(!root||!slides.length)return;
    index=(nextIndex+slides.length)%slides.length;
    const token=++loadToken;
    const slide=slides[index];
    const screen=root.querySelector('[data-cinema-screen]');
    if(!screen)return;
    const scene=document.createElement('article');
    scene.className=`bond-cinema-scene is-runtime-ready ${direction<0?'from-left':'from-right'}`;
    scene.dataset.runtimeVersion=RUNTIME_VERSION;
    scene.innerHTML='<div class="bond-cinema-visual"><div class="bond-cinema-placeholder">✦</div><div class="bond-cinema-vignette"></div></div><div class="bond-cinema-caption"><p></p><h3></h3><blockquote></blockquote><small></small></div>';
    scene.querySelector('.bond-cinema-caption p').textContent=`ADEGAN ${String(index+1).padStart(2,'0')}`;
    scene.querySelector('h3').textContent=String(slide.entry.title||'Satu momen di semesta kita');
    scene.querySelector('blockquote').textContent=captionText(slide.entry);
    scene.querySelector('.bond-cinema-caption small').textContent=dateLabel(slide.entry);
    screen.replaceChildren(scene);
    screen.dataset.state='playing';
    updateControls();
    void hydrateCinemaMedia(scene,slide,token,first);
    if(playing)schedule();
  }

  async function hydrateCinemaMedia(scene,slide,token,first){
    if(!slide.attachment?.file_path)return;
    try{
      if(!slide.url)slide.url=await withTimeout(signedUrl(slide.attachment.file_path),10000,'Media terlalu lama dimuat');
      if(token!==loadToken||!scene.isConnected)return;
      const visual=scene.querySelector('.bond-cinema-visual');
      const media=slide.attachment.kind==='video'?document.createElement('video'):document.createElement('img');
      if(slide.attachment.kind==='video'){
        media.src=slide.url;media.muted=true;media.playsInline=true;media.loop=true;media.preload='metadata';
        media.addEventListener('error',()=>restoreCinemaFallback(visual),{once:true});
        visual.prepend(media);if(playing||first)media.play().catch(()=>{});
      }else{
        media.src=slide.url;media.alt=slide.entry.title||'Adegan kenangan';media.decoding='async';media.loading='eager';
        media.addEventListener('error',()=>restoreCinemaFallback(visual),{once:true});visual.prepend(media);
      }
      visual.querySelector('.bond-cinema-placeholder')?.remove();
    }catch(error){console.warn('Media Love Cinema tidak dapat dimuat:',error);}
  }

  function play(){if(!root||!slides.length)return;playing=true;const toggle=root.querySelector('[data-cinema-toggle]');if(toggle)toggle.textContent='Jeda';root.querySelector('[data-cinema-screen] video')?.play().catch(()=>{});schedule();}
  function pause(){playing=false;clearTimeout(timer);timer=null;if(root){const toggle=root.querySelector('[data-cinema-toggle]');if(toggle)toggle.textContent='Lanjut';root.querySelector('[data-cinema-screen] video')?.pause();}}
  function stop(){pause();slides=[];index=0;loadToken+=1;}
  function togglePlayback(){if(playing)pause();else play();}
  function schedule(){clearTimeout(timer);if(!playing)return;timer=setTimeout(()=>renderScene(index+1,1),SLIDE_DURATION);}
  function updateControls(){if(!root||!slides.length)return;const count=root.querySelector('[data-cinema-count]');const progress=root.querySelector('[data-cinema-progress]');if(count)count.textContent=`${index+1} / ${slides.length}`;if(progress)progress.style.width=`${((index+1)/slides.length)*100}%`;}

  function renderIdle(){if(!root)return;const screen=root.querySelector('[data-cinema-screen]');if(!screen)return;screen.dataset.state='idle';screen.innerHTML=idleMarkup();const controls=root.querySelector('[data-cinema-controls]');if(controls)controls.hidden=true;}
  function renderPreparing(){const screen=root?.querySelector('[data-cinema-screen]');if(!screen)return;screen.dataset.state='loading';screen.innerHTML='<div class="bond-cinema-idle"><span class="bond-cinema-playmark">✦</span><p class="bond-kicker">LOVE CINEMA</p><h3>Menyiapkan film kalian…</h3><p>Mengumpulkan foto, video, dan cerita yang tersimpan.</p></div>';}
  function renderError(error){const screen=root?.querySelector('[data-cinema-screen]');if(!screen)return;screen.dataset.state='error';screen.innerHTML=`<div class="bond-cinema-idle bond-cinema-error"><span class="bond-cinema-playmark">!</span><p class="bond-kicker">LOVE CINEMA</p><h3>Film belum dapat diputar</h3><p>${escapeHtml(friendlyError(error))}</p><button class="bond-primary" type="button" data-cinema-start>Coba lagi</button><small>Runtime ${RUNTIME_VERSION}</small></div>`;const controls=root.querySelector('[data-cinema-controls]');if(controls)controls.hidden=true;}

  return{mount,activate,contextChanged,deactivate,destroy};
}

function idleMarkup(){return'<div class="bond-cinema-idle"><span class="bond-cinema-playmark">▶</span><p class="bond-kicker">LOVE CINEMA</p><h3>Ubah isi semesta menjadi film pendek tentang kalian.</h3><p>Foto, video, dan potongan cerita diputar sebagai rangkaian sinematik tanpa membuat file baru.</p><button class="bond-primary" type="button" data-cinema-start>Mulai film kita</button></div>';}
function isCinemaEligible(entry){if(!entry||entry.status==='archived')return false;if(entry.type==='capsule'&&entry.unlock_at&&safeDate(entry.unlock_at)?.getTime()>Date.now())return false;const hasVisual=normalizeAttachments(entry.attachments).some(item=>['image','video'].includes(item.kind)&&item.file_path);const hasStory=String(entry.body||'').trim().length>20||String(entry.title||'').trim().length>0;return hasVisual||hasStory;}
function normalizeAttachments(items){return Array.isArray(items)?items.filter(Boolean):[];}
function preferredVisual(items){const list=normalizeAttachments(items);return list.find(item=>item.kind==='image'&&item.file_path)||list.find(item=>item.kind==='video'&&item.file_path)||null;}
function restoreCinemaFallback(visual){if(!visual)return;visual.querySelector('img,video')?.remove();if(!visual.querySelector('.bond-cinema-placeholder')){const fallback=document.createElement('div');fallback.className='bond-cinema-placeholder';fallback.textContent='✦';visual.prepend(fallback);}}
function captionText(entry){const body=String(entry.body||'').replace(/\s+/g,' ').trim();if(!body)return'Beberapa momen tidak membutuhkan penjelasan. Cukup diputar kembali dan dirasakan bersama.';return body.length>220?`${body.slice(0,220).trim()}…`:body;}
function dateLabel(entry){try{const date=safeDate(entry.event_date||entry.created_at);return date?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(date):'Tanggal tidak tersedia';}catch{return'Tanggal tidak tersedia';}}
function shuffle(items){const copy=Array.isArray(items)?[...items]:[];for(let index=copy.length-1;index>0;index-=1){const target=Math.floor(Math.random()*(index+1));[copy[index],copy[target]]=[copy[target],copy[index]];}return copy;}
function safeDate(value){const raw=String(value||'').trim();if(!raw)return null;const date=new Date(raw);return Number.isFinite(date.getTime())?date:null;}
function friendlyError(error){const message=String(error?.message||error||'');if(message.includes('bond_replays')||message.includes('schema cache'))return'Love Cinema belum aktif di database.';return message||'Film belum dapat diputar.';}
function escapeHtml(value){return String(value).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));}
function withTimeout(promise,ms,message){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))]);}
