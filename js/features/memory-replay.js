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
  }

  async function contextChanged(){history=[];currentEntry=null;currentReplay=null;renderHistory();renderEmpty();}

  async function loadHistory(){
    const{universeId}=api.getContext();if(!universeId||!root)return;
    try{
      const{data,error}=await supabase().from('bond_replays').select('*').eq('universe_id',universeId).order('created_at',{ascending:false}).limit(16);
      if(error)throw error;history=data||[];renderHistory();
    }catch(error){renderHistoryError(error);}
  }

  async function pickMemory(){
    if(picking)return;
    const{universeId,userId}=api.getContext();if(!universeId||!userId)return;
    const button=root.querySelector('[data-pick-memory]');picking=true;button.disabled=true;button.textContent='Mencari di orbit…';
    try{
      const entries=await repository.listEntries({limit:160,includeAttachments:true});
      const candidates=entries.filter(entry=>isReplayable(entry));
      if(!candidates.length)throw new Error('Belum ada kenangan terbuka yang dapat diputar. Tambahkan satu memori, foto, surat, atau catatan terlebih dahulu.');
      const recentIds=new Set(history.slice(0,10).map(item=>item.entry_id).filter(Boolean));
      const pool=candidates.filter(entry=>!recentIds.has(entry.id));
      const chosen=weightedPick(pool.length?pool:candidates);
      const{data,error}=await supabase().from('bond_replays').insert({universe_id:universeId,entry_id:chosen.id,started_by:userId,mode:'surprise'}).select().single();
      if(error)throw error;
      currentEntry=chosen;currentReplay=data;history=[data,...history.filter(item=>item.id!==data.id)].slice(0,16);
      await renderCurrent(chosen,data);renderHistory();
    }catch(error){toast(friendlyError(error),{type:'error',duration:7000});}
    finally{picking=false;button.disabled=false;button.textContent='Putar kenangan acak';}
  }

  function weightedPick(entries){
    const now=Date.now();
    const weights=entries.map(entry=>{
      const date=new Date(entry.event_date||entry.created_at).getTime();
      const ageDays=Math.max(1,(now-date)/86400000);
      const hasMedia=Boolean((entry.attachments||[]).length);
      const favorite=entry.favorite?1.4:1;
      return Math.min(12,1+Math.log10(ageDays+1))*favorite*(hasMedia?1.18:1);
    });
    const total=weights.reduce((sum,value)=>sum+value,0);let cursor=Math.random()*total;
    for(let index=0;index<entries.length;index+=1){cursor-=weights[index];if(cursor<=0)return entries[index];}
    return entries.at(-1);
  }

  async function renderCurrent(entry,replay){
    const token=++renderToken;
    const stage=root.querySelector('[data-replay-stage]');stage.innerHTML='';
    const article=document.createElement('article');article.className='bond-replay-card';
    article.innerHTML='<div class="bond-replay-media"><div class="bond-replay-glow"></div><span data-media-fallback>✦</span></div><div class="bond-replay-copy"><p class="bond-kicker">THE UNIVERSE CHOSE</p><h3></h3><small data-meta></small><blockquote></blockquote><div class="bond-replay-reactions"></div><div class="bond-replay-actions"><button type="button" class="bond-secondary" data-open-memory>Buka kenangan lengkap</button><button type="button" class="bond-primary" data-replay-again>Putar yang lain</button></div></div>';
    article.querySelector('h3').textContent=entry.title||'Kenangan tanpa judul';
    article.querySelector('[data-meta]').textContent=metaLabel(entry);
    const body=String(entry.body||'').trim();article.querySelector('blockquote').textContent=body?excerpt(body,260):'Tidak semua momen membutuhkan banyak kata. Momen ini tetap tinggal di semesta kalian.';
    const reactionHost=article.querySelector('.bond-replay-reactions');
    for(const[value,label]of Object.entries(REACTIONS)){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.classList.toggle('is-selected',replay.reaction===value);button.onclick=()=>setReaction(value,button);reactionHost.append(button);
    }
    article.querySelector('[data-open-memory]').onclick=()=>{api.closePanel?.();openEntryDetail(entry);};
    article.querySelector('[data-replay-again]').onclick=pickMemory;
    stage.append(article);
    const attachment=preferredAttachment(entry.attachments||[]);
    if(attachment){
      try{
        const url=await signedUrl(attachment.file_path);if(token!==renderToken)return;
        const mediaHost=article.querySelector('.bond-replay-media');mediaHost.querySelector('[data-media-fallback]')?.remove();
        if(attachment.kind==='image'){
          const image=document.createElement('img');image.src=url;image.alt=entry.title||'Kenangan';image.loading='eager';mediaHost.prepend(image);
        }else if(attachment.kind==='video'){
          const video=document.createElement('video');video.src=url;video.muted=true;video.loop=true;video.playsInline=true;video.preload='metadata';mediaHost.prepend(video);video.play().catch(()=>{});
        }
      }catch{}
    }
  }

  async function setReaction(value,button){
    if(!currentReplay)return;
    const{userId}=api.getContext();
    if(currentReplay.started_by!==userId){toast('Reaksi replay ini dibuat oleh pasangan. Putar kenangan baru untuk menambahkan reaksimu.');return;}
    const buttons=[...root.querySelectorAll('.bond-replay-reactions button')];buttons.forEach(node=>node.disabled=true);
    try{
      const{data,error}=await supabase().from('bond_replays').update({reaction:value,completed_at:new Date().toISOString()}).eq('id',currentReplay.id).eq('started_by',userId).select().single();
      if(error)throw error;currentReplay=data;history=[data,...history.filter(item=>item.id!==data.id)];buttons.forEach(node=>node.classList.toggle('is-selected',node===button));renderHistory();
      toast('Reaksi replay tersimpan untuk kalian berdua.',{type:'success'});
    }catch(error){toast(friendlyError(error),{type:'error'});}
    finally{buttons.forEach(node=>node.disabled=false);}
  }

  function renderHistory(){
    if(!root)return;
    const host=root.querySelector('[data-replay-history]');const count=root.querySelector('[data-replay-count]');if(!host)return;
    count.textContent=`${history.length} replay terakhir`;host.innerHTML='';
    if(!history.length){host.innerHTML='<div class="bond-empty"><strong>Jejak masih kosong</strong><span>Replay pertama akan tersimpan di sini.</span></div>';return;}
    const{userId,partner}=api.getContext();
    history.slice(0,8).forEach(item=>{
      const row=document.createElement('article');row.className='bond-replay-row';row.innerHTML='<span>↻</span><div><strong></strong><small></small></div><b></b>';
      row.querySelector('strong').textContent=item.mode==='cinema'?'Love Cinema diputar':'Kenangan acak diputar';
      row.querySelector('small').textContent=`${item.started_by===userId?'Kamu':(partner?.profile?.display_name||'Pasanganmu')} · ${relativeTime(item.created_at)}`;
      row.querySelector('b').textContent=item.reaction?REACTIONS[item.reaction]||item.reaction:'';host.append(row);
    });
  }

  function renderEmpty(){if(root)root.querySelector('[data-replay-stage]').innerHTML='<div class="bond-empty bond-empty--large"><strong>Belum ada kenangan yang diputar</strong><span>Tekan tombol di atas untuk memilih satu momen dari semesta kalian.</span></div>';}
  function renderHistoryError(error){const host=root?.querySelector('[data-replay-history]');if(host)host.innerHTML='<div class="bond-empty is-error"><strong>Jejak replay belum aktif</strong><span>Jalankan migrasi SQL v4.5.0 di Supabase.</span></div>';console.warn('Memory Replay:',error);}
  function realtime(table,payload){if(table!=='bond_replays')return;const row=payload.new||payload.old;if(!row)return;history=payload.eventType==='DELETE'?history.filter(item=>item.id!==row.id):[row,...history.filter(item=>item.id!==row.id)].slice(0,16);renderHistory();}
  return{mount,activate,contextChanged,realtime};
}

function isReplayable(entry){
  if(!entry||entry.status==='archived')return false;
  if(entry.type==='capsule'&&entry.unlock_at&&new Date(entry.unlock_at)>new Date())return false;
  return Boolean(entry.title||entry.body||(entry.attachments||[]).length);
}
function preferredAttachment(items){return items.find(item=>item.kind==='image')||items.find(item=>item.kind==='video')||null;}
function excerpt(value,max){const text=String(value).replace(/\s+/g,' ').trim();return text.length>max?`${text.slice(0,max).trim()}…`:text;}
function metaLabel(entry){const parts=[];if(entry.event_date)parts.push(new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${entry.event_date}T12:00:00`)));parts.push(({memory:'Memori',gallery:'Galeri',letter:'Surat',note:'Catatan',music:'Musik',file:'Berkas',wish:'Harapan',capsule:'Kapsul waktu'})[entry.type]||'Kenangan');return parts.join(' · ');}
function relativeTime(value){const delta=Math.max(0,Date.now()-new Date(value).getTime());if(delta<60000)return'baru saja';if(delta<3600000)return`${Math.floor(delta/60000)} menit lalu`;if(delta<86400000)return`${Math.floor(delta/3600000)} jam lalu`;return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short'}).format(new Date(value));}
function friendlyError(error){const message=String(error?.message||error||'');if(message.includes('bond_replays')||message.includes('schema cache'))return'Memory Replay belum aktif di database. Jalankan migrasi SQL v4.5.0.';return message||'Kenangan belum dapat diputar.';}
