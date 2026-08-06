import { supabase } from '../core/supabase.js';
import { repository } from '../core/repository.js';
import { signedUrl } from '../core/storage.js';
import { openEntryDetail } from '../worlds/shared.js';
import { toast } from '../components/toast.js';

const REACTIONS={smile:'Masih bikin senyum',miss:'Jadi makin kangen',grateful:'Bersyukur punya ini'};

export function createMemoryReplay(api){
  let root=null;
  let history=[];
  let currentEntry=null;
  let currentReplay=null;
  let picking=false;
  let renderToken=0;

  function mount(host){
    root=host;
    root.innerHTML=`<div class="bond-replay">
      <section class="bond-hero bond-replay-hero"><div class="bond-replay-symbol" aria-hidden="true">↻<i></i></div><div><p class="bond-kicker">MEMORY REPLAY</p><h3>Biarkan semesta memilih satu momen yang hampir terlupakan.</h3><span class="bond-muted">Replay mengambil kenangan lama secara acak, menghindari pilihan terakhir, lalu membawanya kembali ke permukaan.</span></div><button class="bond-primary bond-replay-pick" type="button" data-pick-memory>Putar kenangan acak</button></section>
      <section class="bond-replay-stage" data-replay-stage><div class="bond-empty bond-empty--large"><strong>Belum ada kenangan yang diputar</strong><span>Tekan tombol di atas. Semesta akan memilih satu momen dari isi yang sudah kalian simpan.</span></div></section>
      <div class="bond-replay-bottom"><section class="bond-card"><header><div><small>JEJAK REPLAY</small><strong>Momen yang baru kembali</strong></div><span data-replay-count>0 replay</span></header><div class="bond-replay-history" data-replay-history></div></section><section class="bond-card bond-replay-how"><small>CARA KERJANYA</small><ol><li>Memilih dari memori, galeri, surat, dan catatan yang sudah terbuka.</li><li>Mengurangi peluang momen yang baru diputar agar hasilnya tidak berulang.</li><li>Menyimpan jejak replay untuk kalian berdua, bukan membuat duplikat konten.</li></ol></section></div>
    </div>`;
    root.querySelector('[data-pick-memory]').onclick=pickMemory;
    renderHistory();
  }

  async function activate(){
    api.setSubtitle('Kenangan lama kembali muncul tanpa membuat halaman atau salinan baru.');
    await loadHistory();
    if(currentEntry&&!root.querySelector('.bond-replay-card'))await renderCurrent(currentEntry,currentReplay);
  }

  async function contextChanged(){
    renderToken+=1;
    history=[];
    currentEntry=null;
    currentReplay=null;
    renderHistory();
    renderEmpty();
  }

  async function loadHistory(){
    const{universeId}=api.getContext();
    if(!universeId||!root)return;
    try{
      const{data,error}=await supabase().from('bond_replays').select('*').eq('universe_id',universeId).order('created_at',{ascending:false}).limit(16);
      if(error)throw error;
      history=Array.isArray(data)?data:[];
      renderHistory();
    }catch(error){renderHistoryError(error);}
  }

  async function pickMemory(){
    if(picking||!root)return;
    const{universeId,userId}=api.getContext();
    if(!universeId||!userId){toast('Semesta belum siap. Muat ulang lalu coba lagi.',{type:'error'});return;}
    const button=root.querySelector('[data-pick-memory]');
    picking=true;
    if(button){button.disabled=true;button.textContent='Mencari di orbit…';}
    try{
      const result=await repository.listEntries({limit:160,includeAttachments:true});
      const entries=Array.isArray(result)?result:[];
      const candidates=entries.filter(isReplayable);
      if(!candidates.length)throw new Error('Belum ada kenangan terbuka yang dapat diputar. Tambahkan satu memori, foto, surat, atau catatan terlebih dahulu.');
      const recentIds=new Set(history.slice(0,10).map(item=>item.entry_id).filter(Boolean));
      const freshPool=candidates.filter(entry=>!recentIds.has(entry.id));
      const chosen=weightedPick(freshPool.length?freshPool:candidates);
      if(!chosen)throw new Error('Semesta belum berhasil memilih kenangan. Coba sekali lagi.');

      currentEntry=chosen;
      currentReplay=null;

      // Render kartu lebih dulu. Pencatatan database tidak boleh menahan tampilan.
      await renderCurrent(chosen,null,{logging:true});

      try{
        const{data,error}=await supabase().from('bond_replays').insert({universe_id:universeId,entry_id:chosen.id,started_by:userId,mode:'surprise'}).select().single();
        if(error)throw error;
        currentReplay=data;
        history=[data,...history.filter(item=>item.id!==data.id)].slice(0,16);
        renderHistory();
        setReactionAvailability(true);
      }catch(logError){
        console.warn('Jejak Replay gagal dicatat, tetapi kenangan tetap ditampilkan:',logError);
        setReactionAvailability(false);
        toast('Kenangan berhasil diputar. Jejak dan reaksi belum dapat disimpan.',{duration:5000});
      }
    }catch(error){
      renderStageError(error);
      toast(friendlyError(error),{type:'error',duration:7000});
    }finally{
      picking=false;
      if(button){button.disabled=false;button.textContent='Putar kenangan acak';}
    }
  }

  function weightedPick(entries){
    if(!Array.isArray(entries)||!entries.length)return null;
    const now=Date.now();
    const weights=entries.map(entry=>{
      const parsed=safeDate(entry.event_date||entry.created_at);
      const ageDays=parsed?Math.max(1,(now-parsed.getTime())/86400000):1;
      const hasMedia=Boolean(normalizeAttachments(entry.attachments).length);
      const favorite=entry.favorite?1.4:1;
      const weight=Math.min(12,1+Math.log10(ageDays+1))*favorite*(hasMedia?1.18:1);
      return Number.isFinite(weight)&&weight>0?weight:1;
    });
    const total=weights.reduce((sum,value)=>sum+value,0);
    if(!Number.isFinite(total)||total<=0)return entries[Math.floor(Math.random()*entries.length)];
    let cursor=Math.random()*total;
    for(let index=0;index<entries.length;index+=1){cursor-=weights[index];if(cursor<=0)return entries[index];}
    return entries[entries.length-1];
  }

  async function renderCurrent(entry,replay,{logging=false}={}){
    if(!root||!entry)return;
    const token=++renderToken;
    const stage=root.querySelector('[data-replay-stage]');
    if(!stage)return;

    const article=document.createElement('article');
    article.className='bond-replay-card is-runtime-ready';
    article.innerHTML='<div class="bond-replay-media"><div class="bond-replay-glow"></div><span data-media-fallback>✦</span></div><div class="bond-replay-copy"><p class="bond-kicker">THE UNIVERSE CHOSE</p><h3></h3><small data-meta></small><blockquote></blockquote><div class="bond-replay-reactions"></div><p class="bond-runtime-status" data-replay-status hidden></p><div class="bond-replay-actions"><button type="button" class="bond-secondary" data-open-memory>Buka kenangan lengkap</button><button type="button" class="bond-primary" data-replay-again>Putar yang lain</button></div></div>';

    article.querySelector('h3').textContent=String(entry.title||'Kenangan tanpa judul');
    article.querySelector('[data-meta]').textContent=metaLabel(entry);
    const body=String(entry.body||'').trim();
    article.querySelector('blockquote').textContent=body?excerpt(body,260):'Tidak semua momen membutuhkan banyak kata. Momen ini tetap tinggal di semesta kalian.';

    const reactionHost=article.querySelector('.bond-replay-reactions');
    for(const[value,label]of Object.entries(REACTIONS)){
      const reactionButton=document.createElement('button');
      reactionButton.type='button';
      reactionButton.textContent=label;
      reactionButton.disabled=logging||!replay;
      reactionButton.classList.toggle('is-selected',replay?.reaction===value);
      reactionButton.onclick=()=>setReaction(value,reactionButton);
      reactionHost.append(reactionButton);
    }

    article.querySelector('[data-open-memory]').onclick=()=>{api.closePanel?.();openEntryDetail(entry);};
    article.querySelector('[data-replay-again]').onclick=pickMemory;
    stage.replaceChildren(article);
    stage.dataset.state='ready';

    const status=article.querySelector('[data-replay-status]');
    if(logging&&status){status.hidden=false;status.textContent='Menyimpan jejak replay…';}

    const attachment=preferredAttachment(normalizeAttachments(entry.attachments));
    if(attachment?.file_path){
      try{
        const url=await signedUrl(attachment.file_path);
        if(token!==renderToken||!article.isConnected)return;
        const mediaHost=article.querySelector('.bond-replay-media');
        if(!mediaHost)return;
        const media=attachment.kind==='video'?document.createElement('video'):document.createElement('img');
        mediaHost.querySelector('[data-media-fallback]')?.remove();
        if(attachment.kind==='video'){
          media.src=url;
          media.muted=true;
          media.loop=true;
          media.playsInline=true;
          media.preload='metadata';
          media.addEventListener('error',()=>restoreMediaFallback(mediaHost),{once:true});
          mediaHost.prepend(media);
          media.play().catch(()=>{});
        }else{
          media.src=url;
          media.alt=entry.title||'Kenangan';
          media.loading='eager';
          media.decoding='async';
          media.addEventListener('error',()=>restoreMediaFallback(mediaHost),{once:true});
          mediaHost.prepend(media);
        }
      }catch(error){console.warn('Media replay tidak dapat dimuat:',error);}
    }
  }

  function setReactionAvailability(enabled){
    if(!root)return;
    root.querySelectorAll('.bond-replay-reactions button').forEach(node=>{node.disabled=!enabled;});
    const status=root.querySelector('[data-replay-status]');
    if(status){status.hidden=enabled;status.textContent=enabled?'':'Jejak belum tersimpan. Kenangan tetap dapat dibuka.';}
  }

  async function setReaction(value,button){
    if(!currentReplay){toast('Jejak replay belum tersimpan, jadi reaksi belum dapat ditambahkan.');return;}
    const{userId}=api.getContext();
    if(currentReplay.started_by!==userId){toast('Reaksi replay ini dibuat oleh pasangan. Putar kenangan baru untuk menambahkan reaksimu.');return;}
    const buttons=[...root.querySelectorAll('.bond-replay-reactions button')];
    buttons.forEach(node=>node.disabled=true);
    try{
      const{data,error}=await supabase().from('bond_replays').update({reaction:value,completed_at:new Date().toISOString()}).eq('id',currentReplay.id).eq('started_by',userId).select().single();
      if(error)throw error;
      currentReplay=data;
      history=[data,...history.filter(item=>item.id!==data.id)];
      buttons.forEach(node=>node.classList.toggle('is-selected',node===button));
      renderHistory();
      toast('Reaksi replay tersimpan untuk kalian berdua.',{type:'success'});
    }catch(error){toast(friendlyError(error),{type:'error'});}
    finally{buttons.forEach(node=>node.disabled=false);}
  }

  function renderHistory(){
    if(!root)return;
    const host=root.querySelector('[data-replay-history]');
    const count=root.querySelector('[data-replay-count]');
    if(!host)return;
    if(count)count.textContent=`${history.length} replay terakhir`;
    host.innerHTML='';
    if(!history.length){host.innerHTML='<div class="bond-empty"><strong>Jejak masih kosong</strong><span>Replay pertama akan tersimpan di sini.</span></div>';return;}
    const{userId,partner}=api.getContext();
    history.slice(0,8).forEach(item=>{
      const row=document.createElement('article');
      row.className='bond-replay-row';
      row.innerHTML='<span>↻</span><div><strong></strong><small></small></div><b></b>';
      row.querySelector('strong').textContent=item.mode==='cinema'?'Love Cinema diputar':'Kenangan acak diputar';
      row.querySelector('small').textContent=`${item.started_by===userId?'Kamu':(partner?.profile?.display_name||'Pasanganmu')} · ${relativeTime(item.created_at)}`;
      row.querySelector('b').textContent=item.reaction?REACTIONS[item.reaction]||item.reaction:'';
      host.append(row);
    });
  }

  function renderEmpty(){
    if(!root)return;
    const stage=root.querySelector('[data-replay-stage]');
    if(stage)stage.innerHTML='<div class="bond-empty bond-empty--large"><strong>Belum ada kenangan yang diputar</strong><span>Tekan tombol di atas untuk memilih satu momen dari semesta kalian.</span></div>';
  }

  function renderStageError(error){
    const stage=root?.querySelector('[data-replay-stage]');
    if(stage)stage.innerHTML=`<div class="bond-empty bond-empty--large is-error"><strong>Kenangan belum dapat ditampilkan</strong><span>${escapeHtml(friendlyError(error))}</span></div>`;
  }

  function renderHistoryError(error){
    const host=root?.querySelector('[data-replay-history]');
    if(host)host.innerHTML='<div class="bond-empty is-error"><strong>Jejak replay belum aktif</strong><span>Riwayat belum dapat dimuat. Kenangan masih bisa dicoba.</span></div>';
    console.warn('Memory Replay:',error);
  }

  function realtime(table,payload){
    if(table!=='bond_replays')return;
    const row=payload.new||payload.old;
    if(!row)return;
    history=payload.eventType==='DELETE'?history.filter(item=>item.id!==row.id):[row,...history.filter(item=>item.id!==row.id)].slice(0,16);
    if(currentReplay?.id===row.id&&payload.new)currentReplay=payload.new;
    renderHistory();
  }

  return{mount,activate,contextChanged,realtime};
}

function isReplayable(entry){
  if(!entry||entry.status==='archived')return false;
  if(entry.type==='capsule'&&entry.unlock_at&&safeDate(entry.unlock_at)?.getTime()>Date.now())return false;
  return Boolean(entry.title||entry.body||normalizeAttachments(entry.attachments).length);
}
function normalizeAttachments(items){return Array.isArray(items)?items.filter(Boolean):[];}
function preferredAttachment(items){return items.find(item=>item.kind==='image'&&item.file_path)||items.find(item=>item.kind==='video'&&item.file_path)||null;}
function restoreMediaFallback(host){if(!host||host.querySelector('[data-media-fallback]'))return;host.querySelector('img,video')?.remove();const fallback=document.createElement('span');fallback.dataset.mediaFallback='';fallback.textContent='✦';host.append(fallback);}
function excerpt(value,max){const text=String(value).replace(/\s+/g,' ').trim();return text.length>max?`${text.slice(0,max).trim()}…`:text;}
function metaLabel(entry){try{const parts=[];const date=safeDate(entry.event_date||entry.created_at);if(date)parts.push(new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(date));parts.push(({memory:'Memori',gallery:'Galeri',letter:'Surat',note:'Catatan',music:'Musik',file:'Berkas',wish:'Harapan',capsule:'Kapsul waktu'})[entry.type]||'Kenangan');return parts.join(' · ');}catch{return'Kenangan';}}
function relativeTime(value){const date=safeDate(value);if(!date)return'waktu tidak tersedia';const delta=Math.max(0,Date.now()-date.getTime());if(delta<60000)return'baru saja';if(delta<3600000)return`${Math.floor(delta/60000)} menit lalu`;if(delta<86400000)return`${Math.floor(delta/3600000)} jam lalu`;return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short'}).format(date);}
function safeDate(value){const raw=String(value||'').trim();if(!raw)return null;const date=new Date(raw);return Number.isFinite(date.getTime())?date:null;}
function friendlyError(error){const message=String(error?.message||error||'');if(message.includes('bond_replays')||message.includes('schema cache'))return'Memory Replay belum aktif di database.';return message||'Kenangan belum dapat diputar.';}
function escapeHtml(value){return String(value).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));}
