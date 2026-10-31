import { supabase } from '../core/supabase.js';
import { state } from '../core/state.js';
import { events } from '../core/event-bus.js';
import { signedUrl } from '../core/storage.js';
import { notificationService } from '../core/notifications.js';
import { initials } from '../core/utils.js';
import { toast } from '../components/toast.js';
import { CONFIG } from '../config.js';
import { createSnakesGame, isGameRow } from './snakes-ladders.js';
import { createDailyQuestion, isQuestionRow } from './daily-question.js';

const MAX_HISTORY=50;
const MAX_VOICE_SECONDS=180;
const MAX_PHOTO_EDGE=1600;
const MAX_SCAN=500;
const SIGNAL_LABELS={poke:'👉 Colek',heart:'❤️ Mengirim hati',miss_you:'🌙 Bilang kangen'};
let launcher=null,sheet=null,messagesHost=null,typingHost=null,compose=null,channel=null;
let activeUniverseId='',activeUserId='',partner=null,unread=0,isOpen=false,subscribed=false;
let typingTimer=null,lastTypingSent=0,popupTimer=null,signalCooldownUntil=0,retryAt=0,startupTimer=0;
let lastPartnerSignature='';
const seenIds=new Set();
let sending=false,playingAudio=null;
const rec={active:false,recorder:null,stream:null,chunks:[],startedAt:0,timer:0,cancelled:false,mime:''};

function context(){
  const snapshot=state.snapshot;
  const universeId=snapshot.universe?.id||'';
  const userId=snapshot.user?.id||'';
  const chosen=(snapshot.members||[]).find(member=>member.user_id!==userId)||null;
  return{snapshot,universeId,userId,partner:chosen};
}

function appReady(){const shell=document.querySelector('#app-shell');return shell&&!shell.hidden;}

function scheduleStart(delay=0){
  clearTimeout(startupTimer);
  startupTimer=window.setTimeout(()=>ensureStarted().catch(error=>console.warn('Couple Connect menunggu konteks:',error)),delay);
}

async function ensureStarted(){
  const next=context();
  if(!appReady()||!next.universeId||!next.userId){
    if(launcher)launcher.hidden=true;
    if(sheet&&!sheet.hidden)closeConnect();
    return;
  }
  ensureUI();launcher.hidden=false;
  const changedContext=activeUniverseId!==next.universeId||activeUserId!==next.userId;
  const signature=`${next.partner?.user_id||''}|${next.partner?.profile?.display_name||''}|${next.partner?.profile?.avatar_path||''}`;
  partner=next.partner;
  if(signature!==lastPartnerSignature){lastPartnerSignature=signature;await refreshPartnerUI();}
  if(changedContext){
    seenIds.clear();unread=0;updateUnreadBadge();retryAt=0;game.reset();daily.reset();
    activeUniverseId=next.universeId;activeUserId=next.userId;
    await disconnectChannel();
  }
  if(!subscribed&&Date.now()>=retryAt)await subscribeRealtime();
  if(changedContext)await refreshUnread();
  if(new URL(location.href).searchParams.get('connect')==='1'){
    setTimeout(()=>openConnect(),350);
    const url=new URL(location.href);url.searchParams.delete('connect');history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);
  }
}

function ensureUI(){
  if(launcher)return;
  launcher=document.createElement('button');launcher.type='button';launcher.className='couple-connect-launcher';launcher.setAttribute('aria-label','Buka Couple Connect');launcher.setAttribute('data-capture-ignore','true');
  launcher.innerHTML='<span class="couple-connect-launcher__orb">♡<i class="couple-connect-launcher__status"></i></span><span class="couple-connect-launcher__copy"><strong>Couple Connect</strong><small data-connect-status>Hubungkan hati kalian</small></span><span class="couple-connect-launcher__badge" data-unread>0</span>';
  launcher.onclick=openConnect;document.body.append(launcher);

  sheet=document.createElement('section');sheet.className='couple-connect-sheet';sheet.hidden=true;sheet.setAttribute('data-capture-ignore','true');
  sheet.innerHTML=`<div class="couple-connect-panel" role="dialog" aria-modal="true" aria-labelledby="couple-connect-title">
    <header class="couple-connect-header"><div class="couple-connect-header__person"><span class="couple-connect-header__avatar" data-partner-avatar>♡</span><span class="couple-connect-header__copy"><strong id="couple-connect-title" data-partner-name>Pasanganmu</strong><small data-partner-status>Memeriksa orbit…</small></span></div><span class="couple-connect-header__actions"><button class="icon-button couple-game-button" data-daily type="button" aria-label="Pertanyaan hari ini">💭<i class="couple-game-dot" hidden></i></button><button class="icon-button couple-game-button" data-game type="button" aria-label="Main ular tangga">🎲<i class="couple-game-dot" hidden></i></button><button class="icon-button" data-close type="button" aria-label="Tutup chat">×</button></span></header>
    <div class="couple-connect-quick"><button data-signal="poke" type="button">👉 Colek</button><button data-signal="heart" type="button">❤️ Kirim hati</button><button data-signal="miss_you" type="button">🌙 Aku kangen</button></div>
    <div class="couple-connect-messages" data-messages><div class="couple-connect-empty">Kirim pesan kecil, colek, atau hati. Hanya kalian berdua yang dapat melihat ruang ini.</div></div>
    <div><div class="couple-connect-typing" data-typing></div><form class="couple-connect-compose" data-compose><button class="couple-connect-tool" type="button" data-attach aria-label="Kirim foto">📷</button><textarea name="message" maxlength="2000" rows="1" placeholder="Tulis pesan…" aria-label="Pesan untuk pasangan"></textarea><button class="couple-connect-tool" type="button" data-voice aria-label="Rekam pesan suara">🎤</button><button class="button button--primary" type="submit" aria-label="Kirim pesan">➤</button><div class="couple-connect-recording" data-recording hidden><i class="couple-connect-recording__dot"></i><strong data-rec-time>0:00</strong><span class="couple-connect-recording__hint">Merekam…</span><button class="button button--ghost" type="button" data-rec-cancel>Batal</button><button class="button button--primary" type="button" data-rec-send>Kirim</button></div><input type="file" accept="image/*" data-photo-input hidden></form></div>
  </div>`;
  messagesHost=sheet.querySelector('[data-messages]');typingHost=sheet.querySelector('[data-typing]');compose=sheet.querySelector('[data-compose]');
  sheet.querySelector('[data-close]').onclick=closeConnect;
  sheet.onclick=event=>{if(event.target===sheet)closeConnect();};
  sheet.querySelectorAll('[data-signal]').forEach(button=>button.onclick=()=>sendSignal(button.dataset.signal,button));
  sheet.querySelector('[data-game]').onclick=()=>game.open();
  sheet.querySelector('[data-daily]').onclick=()=>daily.open();
  compose.onsubmit=sendText;
  compose.querySelector('[data-attach]').onclick=()=>{if(!sending&&!rec.active)compose.querySelector('[data-photo-input]').click();};
  compose.querySelector('[data-photo-input]').onchange=event=>{const file=event.target.files?.[0];event.target.value='';if(file)sendPhoto(file);};
  compose.querySelector('[data-voice]').onclick=startRecording;
  compose.querySelector('[data-rec-cancel]').onclick=()=>stopRecording(true);
  compose.querySelector('[data-rec-send]').onclick=()=>stopRecording(false);
  const input=compose.elements.message;
  input.addEventListener('input',()=>{
    input.style.height='auto';input.style.height=`${Math.min(120,input.scrollHeight)}px`;
    broadcastTyping(Boolean(input.value.trim()));
  });
  input.addEventListener('blur',()=>broadcastTyping(false,true));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen)closeConnect();});
  document.body.append(sheet);
}

async function refreshPartnerUI(){
  if(!launcher||!sheet)return;
  const snapshot=state.snapshot;
  const online=Boolean(partner&&(snapshot.presence||{})[partner.user_id]?.length);
  const name=partner?.profile?.display_name||'Pasanganmu';
  launcher.classList.toggle('is-online',online);
  launcher.querySelector('[data-connect-status]').textContent=partner?(online?'Online sekarang':'Kirim pesan kapan saja'):'Menunggu pasangan bergabung';
  sheet.querySelector('[data-partner-name]').textContent=name;
  const status=sheet.querySelector('[data-partner-status]');status.textContent=partner?(online?'Online di semesta':'Pesan akan menunggunya'):'Pasangan belum bergabung';status.classList.toggle('is-online',online);
  sheet.querySelectorAll('[data-signal], [data-game], [data-daily], [data-compose] textarea, [data-compose] button').forEach(node=>node.disabled=!partner);
  const avatar=sheet.querySelector('[data-partner-avatar]');avatar.textContent=initials(name);
  if(partner?.profile?.avatar_path){
    try{const url=await signedUrl(partner.profile.avatar_path);const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';avatar.replaceChildren(img);}catch{}
  }
}

async function disconnectChannel(){
  subscribed=false;
  if(!channel)return;
  const old=channel;channel=null;
  try{await supabase().removeChannel(old);}catch{}
}

async function subscribeRealtime(){
  if(!activeUniverseId)return;
  await disconnectChannel();
  const client=supabase();
  channel=client.channel(`couple-connect:${activeUniverseId}`,{config:{broadcast:{self:false}}})
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'couple_messages',filter:`universe_id=eq.${activeUniverseId}`},payload=>handleIncoming(payload.new))
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'couple_messages',filter:`universe_id=eq.${activeUniverseId}`},payload=>handleUpdated(payload.new))
    .on('broadcast',{event:'typing'},payload=>handleTyping(payload.payload||{}))
    .subscribe(status=>{
      subscribed=status==='SUBSCRIBED';
      if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))retryAt=Date.now()+15000;
    });
  retryAt=Date.now()+15000;
}

async function openConnect(){
  await ensureStarted();
  if(!sheet)return;
  sheet.hidden=false;isOpen=true;launcher?.classList.remove('has-unread');unread=0;updateUnreadBadge();
  await loadMessages();await markRead();
  setTimeout(()=>compose?.elements.message?.focus(),120);
}

function closeConnect(){
  if(!sheet)return;sheet.hidden=true;isOpen=false;broadcastTyping(false,true);stopRecording(true);playingAudio?.pause();game.close();daily.close();
}

async function loadMessages(){
  if(!activeUniverseId||!messagesHost)return;
  messagesHost.innerHTML='<div class="couple-connect-empty">Membaca pesan kalian…</div>';
  try{
    const{data,error}=await supabase().from('couple_messages').select('*').eq('universe_id',activeUniverseId).order('created_at',{ascending:false}).limit(MAX_SCAN);
    if(error)throw error;
    const all=(data||[]).reverse();
    all.forEach(item=>seenIds.add(item.id));game.ingest(all.filter(isGameRow));daily.ingest(all.filter(isQuestionRow));
    updateGameDot();updateDailyDot();
    const rows=all.filter(item=>!isGameRow(item)&&!isQuestionRow(item)).slice(-MAX_HISTORY);messagesHost.innerHTML='';
    if(!rows.length){messagesHost.innerHTML='<div class="couple-connect-empty">Belum ada pesan. Mulai dengan colek kecil atau katakan sesuatu dari hati.</div>';return;}
    for(const row of rows){seenIds.add(row.id);messagesHost.append(renderMessage(row));}
    scrollToLatest();
  }catch(error){
    messagesHost.innerHTML='<div class="couple-connect-empty">Couple Connect belum aktif. Jalankan migrasi SQL v4.3 di Supabase terlebih dahulu.</div>';
    console.warn(error);
  }
}

function renderMessage(row){
  const mine=row.sender_id===activeUserId;
  const node=document.createElement('article');node.className=`couple-message${mine?' is-mine':''}${row.kind!=='text'?' is-signal':''}`;node.dataset.messageId=row.id;
  const attachment=row.kind==='text'?readAttachment(row):null;
  const bubble=document.createElement('div');bubble.className='couple-message__bubble';
  if(attachment){bubble.classList.add('couple-message__bubble--media');bubble.append(attachment.type==='image'?buildPhoto(attachment):buildVoice(attachment));}
  else bubble.textContent=row.kind==='text'?row.body:(SIGNAL_LABELS[row.kind]||'♡ Sinyal cinta');
  const meta=document.createElement('small');meta.className='couple-message__meta';
  const time=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit'}).format(new Date(row.created_at));
  meta.textContent=`${time}${mine&&row.read_at?' · Dibaca':''}`;
  node.append(bubble,meta);return node;
}

/* ---------- Ular tangga (v4.9.8) ---------- */
const game=createSnakesGame({
  getContext:()=>{
    const me=(state.snapshot.members||[]).find(member=>member.user_id===activeUserId);
    return{userId:activeUserId,partnerId:partner?.user_id||'',myName:me?.profile?.display_name||'Kamu',partnerName:partner?.profile?.display_name||'Pasanganmu'};
  },
  load:async()=>{
    const{data,error}=await supabase().from('couple_messages').select('*').eq('universe_id',activeUniverseId).order('created_at',{ascending:false}).limit(MAX_SCAN);
    if(error)throw error;
    return(data||[]).reverse().filter(isGameRow);
  },
  send:(metadata,body)=>insertMessage('text',body,metadata),
  toast,
  onChange:()=>updateGameDot()
});

function updateGameDot(){
  const dot=sheet?.querySelector('[data-game] .couple-game-dot');if(dot)dot.hidden=!game.isMyTurn();
}

function handleGameRow(row){
  game.ingest(row);
  if(row.sender_id===activeUserId)return;
  if(game.isOpen()){markRead();return;}
  unread+=1;updateUnreadBadge();
  const senderName=partner?.profile?.display_name||'Pasanganmu';
  const type=row.metadata?.type,winner=game.getState().winner;
  if(type==='start'){showPopup('🎲',`${senderName} mengajak main ular tangga`,'Buka chat lalu ketuk 🎲');}
  else if(winner===row.sender_id){showPopup('🏆',`${senderName} menang ular tangga`,'Ketuk 🎲 untuk main lagi');}
  else if(game.isMyTurn()){showPopup('🎲','Giliranmu di ular tangga','Buka chat lalu ketuk 🎲');}
  navigator.vibrate?.([70,40,90]);
}

/* ---------- Pertanyaan hari ini (v4.9.9) ---------- */
const daily=createDailyQuestion({
  getContext:()=>{
    const me=(state.snapshot.members||[]).find(member=>member.user_id===activeUserId);
    return{userId:activeUserId,partnerId:partner?.user_id||'',myName:me?.profile?.display_name||'Kamu',partnerName:partner?.profile?.display_name||'Pasanganmu'};
  },
  load:async()=>{
    const{data,error}=await supabase().from('couple_messages').select('*').eq('universe_id',activeUniverseId).order('created_at',{ascending:false}).limit(MAX_SCAN);
    if(error)throw error;
    return(data||[]).reverse().filter(isQuestionRow);
  },
  send:(metadata,body)=>insertMessage('text',body,metadata),
  toast,
  onChange:()=>updateDailyDot()
});

function updateDailyDot(){
  const dot=sheet?.querySelector('[data-daily] .couple-game-dot');if(dot)dot.hidden=!daily.needsMyAnswer();
}

function handleQuestionRow(row){
  daily.ingest(row);
  if(row.sender_id===activeUserId)return;
  if(daily.isOpen()){markRead();return;}
  unread+=1;updateUnreadBadge();
  const senderName=partner?.profile?.display_name||'Pasanganmu';
  showPopup('💭',`${senderName} sudah menjawab pertanyaan hari ini`,daily.needsMyAnswer()?'Jawab dulu untuk membuka jawabannya':'Jawaban kalian sudah terbuka');
  navigator.vibrate?.([60,40,80]);
}

/* ---------- Foto dan pesan suara (v4.9.7) ---------- */
function readAttachment(row){
  const item=row?.metadata?.attachment;
  if(!item||typeof item.path!=='string'||!activeUniverseId||!item.path.startsWith(`${activeUniverseId}/`))return null;
  return item.type==='image'||item.type==='audio'?item:null;
}

function buildPhoto(item){
  const button=document.createElement('button');button.type='button';button.className='couple-message__photo';button.setAttribute('aria-label','Buka foto');
  const width=Number(item.width)||0,height=Number(item.height)||0;
  button.style.aspectRatio=width>0&&height>0?`${width} / ${height}`:'4 / 3';
  const img=document.createElement('img');img.alt='Foto dari chat';img.loading='lazy';img.decoding='async';button.append(img);
  const load=async()=>{try{img.src=await signedUrl(item.path);button.classList.remove('is-error');}catch{button.classList.add('is-error');}};
  img.onerror=()=>button.classList.add('is-error');
  button.onclick=async()=>{if(button.classList.contains('is-error')){await load();return;}openPhotoViewer(img.currentSrc||img.src);};
  load();return button;
}

function openPhotoViewer(src){
  if(!src)return;
  const viewer=document.createElement('div');viewer.className='couple-photo-viewer';viewer.setAttribute('data-capture-ignore','true');viewer.setAttribute('role','dialog');viewer.setAttribute('aria-label','Foto');
  const img=document.createElement('img');img.src=src;img.alt='Foto';
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Tutup foto');
  const dismiss=()=>{document.removeEventListener('keydown',onKey,true);viewer.remove();};
  const onKey=event=>{if(event.key==='Escape'){event.stopPropagation();dismiss();}};
  viewer.onclick=event=>{if(event.target!==img)dismiss();};
  document.addEventListener('keydown',onKey,true);
  viewer.append(img,close);document.body.append(viewer);
}

function formatClock(ms){const total=Math.max(0,Math.floor(ms/1000));return`${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;}

function buildVoice(item){
  const wrap=document.createElement('div');wrap.className='couple-message__voice';
  const button=document.createElement('button');button.type='button';button.className='couple-voice__button';button.textContent='▶';button.setAttribute('aria-label','Putar pesan suara');
  const track=document.createElement('span');track.className='couple-voice__track';const bar=document.createElement('i');track.append(bar);
  const time=document.createElement('span');time.className='couple-voice__time';
  const total=Number(item.duration_ms)||0;time.textContent=formatClock(total);
  let audio=null;
  const reset=()=>{button.textContent='▶';bar.style.width='0%';time.textContent=formatClock(total);};
  button.onclick=async()=>{
    try{
      if(audio&&!audio.paused){audio.pause();return;}
      if(!audio){
        button.disabled=true;
        const next=new Audio(await signedUrl(item.path));next.preload='auto';
        next.onended=()=>{reset();if(playingAudio===next)playingAudio=null;};
        next.onpause=()=>{if(!next.ended)button.textContent='▶';};
        next.onplay=()=>{button.textContent='❚❚';};
        next.ontimeupdate=()=>{
          const length=total>0?total/1000:(Number.isFinite(next.duration)?next.duration:0);
          if(length>0){bar.style.width=`${Math.min(100,next.currentTime/length*100)}%`;time.textContent=formatClock(Math.max(0,(length-next.currentTime)*1000));}
        };
        next.onerror=()=>{toast('Pesan suara tidak dapat diputar.',{type:'error'});if(audio===next)audio=null;reset();};
        audio=next;button.disabled=false;
      }
      if(playingAudio&&playingAudio!==audio)playingAudio.pause();
      playingAudio=audio;await audio.play();
    }catch{button.disabled=false;toast('Pesan suara tidak dapat diputar.',{type:'error'});}
  };
  wrap.append(button,track,time);return wrap;
}

function setBusy(on){
  sending=on;compose?.classList.toggle('is-busy',on);
  compose?.querySelectorAll('[data-attach],[data-voice],[type="submit"]').forEach(node=>{node.disabled=on||!partner;});
}

function showSending(text){
  messagesHost?.querySelector('.couple-connect-empty')?.remove();
  const node=document.createElement('article');node.className='couple-message is-mine is-sending';
  const bubble=document.createElement('div');bubble.className='couple-message__bubble';bubble.textContent=text;node.append(bubble);
  messagesHost?.append(node);scrollToLatest();return node;
}

function mediaError(error){
  const message=String(error?.message||error||'');
  if(/row-level security|permission denied|not authorized|unauthorized/i.test(message))return'Izin penyimpanan ditolak. Coba muat ulang halaman atau masuk lagi.';
  if(/failed to fetch|network|load failed/i.test(message))return'Koneksi terputus. Belum terkirim, coba lagi.';
  return friendlyError(error);
}

function safeName(name){return String(name||'file').normalize('NFKD').replace(/[^\w.\-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-80)||'file';}

async function uploadChatFile(file){
  const path=`${activeUniverseId}/profiles/${activeUserId}/chat/${crypto.randomUUID()}-${safeName(file.name)}`;
  const{data,error}=await supabase().storage.from(CONFIG.STORAGE_BUCKET).upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type||'application/octet-stream'});
  if(error)throw error;
  return data.path;
}

async function removeUploaded(path){if(!path)return;try{await supabase().storage.from(CONFIG.STORAGE_BUCKET).remove([path]);}catch{}}

async function preparePhoto(file){
  const type=String(file.type||'').toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(type)||!('createImageBitmap'in window))return{file,width:0,height:0};
  let bitmap;
  try{
    bitmap=await createImageBitmap(file);
    const scale=Math.min(1,MAX_PHOTO_EDGE/Math.max(bitmap.width,bitmap.height));
    const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
    if(scale===1&&file.size<600*1024)return{file,width,height};
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context2d=canvas.getContext('2d');if(!context2d)return{file,width,height};
    context2d.drawImage(bitmap,0,0,width,height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));
    if(!blob||blob.size>=file.size)return{file,width,height};
    return{file:new File([blob],`${(file.name||'foto').replace(/\.[^.]+$/,'')}.webp`,{type:'image/webp'}),width,height};
  }catch{return{file,width:0,height:0};}
  finally{bitmap?.close?.();}
}

async function sendPhoto(file){
  if(!file||!partner||sending||rec.active)return;
  if(!String(file.type||'').startsWith('image/')){toast('Pilih file foto (gambar).',{type:'error'});return;}
  if(file.size>CONFIG.MAX_UPLOAD_MB*1024*1024){toast(`Foto lebih besar dari ${CONFIG.MAX_UPLOAD_MB} MB.`,{type:'error'});return;}
  setBusy(true);const note=showSending('Mengirim foto…');let uploaded='';
  try{
    const prepared=await preparePhoto(file);
    uploaded=await uploadChatFile(prepared.file);
    const row=await insertMessage('text','📷 Foto',{attachment:{type:'image',path:uploaded,mime:prepared.file.type||file.type,size:prepared.file.size,width:prepared.width||null,height:prepared.height||null}});
    uploaded='';appendOwn(row);
  }catch(error){await removeUploaded(uploaded);toast(mediaError(error),{type:'error',duration:6000});}
  finally{note.remove();setBusy(false);}
}

function pickAudioMime(){
  if(!window.MediaRecorder||!MediaRecorder.isTypeSupported)return'';
  return['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type))||'';
}

async function startRecording(){
  if(rec.active||sending||!partner)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Perekam suara tidak didukung di browser ini.',{type:'error'});return;}
  playingAudio?.pause();
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});}
  catch(error){toast(error?.name==='NotAllowedError'||error?.name==='SecurityError'?'Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan browser, lalu coba lagi.':'Mikrofon tidak bisa dipakai saat ini.',{type:'error',duration:6000});return;}
  const mime=pickAudioMime();let recorder;
  try{recorder=new MediaRecorder(stream,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:32000});}
  catch{try{recorder=new MediaRecorder(stream);}catch{stream.getTracks().forEach(track=>track.stop());toast('Perekam suara tidak didukung di browser ini.',{type:'error'});return;}}
  rec.stream=stream;rec.recorder=recorder;rec.chunks=[];rec.cancelled=false;rec.mime=recorder.mimeType||mime||'audio/webm';rec.startedAt=Date.now();
  recorder.ondataavailable=event=>{if(event.data&&event.data.size)rec.chunks.push(event.data);};
  recorder.onstop=()=>{finishRecording();};
  recorder.start(1000);rec.active=true;
  compose.classList.add('is-recording');compose.querySelector('[data-recording]').hidden=false;
  const clock=compose.querySelector('[data-rec-time]');clock.textContent='0:00';
  rec.timer=setInterval(()=>{const elapsed=Date.now()-rec.startedAt;clock.textContent=formatClock(elapsed);if(elapsed>=MAX_VOICE_SECONDS*1000)stopRecording(false);},250);
}

function stopRecording(cancel){
  if(!rec.active)return;
  rec.active=false;rec.cancelled=Boolean(cancel);clearInterval(rec.timer);
  compose?.classList.remove('is-recording');const bar=compose?.querySelector('[data-recording]');if(bar)bar.hidden=true;
  try{if(rec.recorder&&rec.recorder.state!=='inactive')rec.recorder.stop();else finishRecording();}catch{finishRecording();}
}

async function finishRecording(){
  rec.stream?.getTracks().forEach(track=>track.stop());rec.stream=null;
  const chunks=rec.chunks;rec.chunks=[];const durationMs=Date.now()-rec.startedAt;
  if(rec.cancelled)return;
  if(durationMs<800||!chunks.length){toast('Rekaman terlalu singkat.');return;}
  const type=String(rec.mime||'audio/webm').split(';')[0];
  const extension=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm';
  await sendVoice(new File([new Blob(chunks,{type})],`suara-${Date.now()}.${extension}`,{type}),durationMs);
}

async function sendVoice(file,durationMs){
  if(!partner||sending)return;
  if(file.size>CONFIG.MAX_UPLOAD_MB*1024*1024){toast('Rekaman terlalu besar.',{type:'error'});return;}
  setBusy(true);const note=showSending('Mengirim pesan suara…');let uploaded='';
  try{
    uploaded=await uploadChatFile(file);
    const row=await insertMessage('text','🎤 Pesan suara',{attachment:{type:'audio',path:uploaded,mime:file.type,size:file.size,duration_ms:Math.round(durationMs)}});
    uploaded='';appendOwn(row);
  }catch(error){await removeUploaded(uploaded);toast(mediaError(error),{type:'error',duration:6000});}
  finally{note.remove();setBusy(false);}
}

document.addEventListener('visibilitychange',()=>{if(document.hidden&&rec.active)stopRecording(true);});

async function sendText(event){
  event.preventDefault();
  const input=compose.elements.message;const body=input.value.trim();if(!body||!partner)return;
  const button=compose.querySelector('[type="submit"]');button.disabled=true;
  try{
    const row=await insertMessage('text',body);
    input.value='';input.style.height='auto';broadcastTyping(false,true);appendOwn(row);
  }catch(error){toast(friendlyError(error),{type:'error',duration:6000});}
  finally{button.disabled=false;input.focus();}
}

async function sendSignal(kind,button){
  if(!partner||Date.now()<signalCooldownUntil)return;
  signalCooldownUntil=Date.now()+3500;button.disabled=true;
  try{
    const row=await insertMessage(kind,null);appendOwn(row);
    if(kind==='poke')playPokeEffect();else showerHearts(kind==='miss_you'?'🌙':'♥');
  }catch(error){toast(friendlyError(error),{type:'error'});}
  finally{setTimeout(()=>{button.disabled=!partner;},3500);}
}

async function insertMessage(kind,body,metadata){
  if(!partner)throw new Error('Pasangan belum bergabung.');
  const{data,error}=await supabase().from('couple_messages').insert({universe_id:activeUniverseId,sender_id:activeUserId,recipient_id:partner.user_id,kind,body,...(metadata?{metadata}:{})}).select().single();
  if(error)throw error;
  seenIds.add(data.id);
  notificationService.send(kind==='text'?'couple_message':'couple_signal',{resourceId:data.id}).catch(error=>console.warn('Push Couple Connect belum terkirim:',error.message));
  return data;
}

function appendOwn(row){
  messagesHost?.querySelector('.couple-connect-empty')?.remove();messagesHost?.append(renderMessage(row));scrollToLatest();
}

async function handleIncoming(row){
  if(!row?.id||seenIds.has(row.id))return;seenIds.add(row.id);
  if(isGameRow(row)){handleGameRow(row);return;}
  if(isQuestionRow(row)){handleQuestionRow(row);return;}
  if(row.sender_id===activeUserId){if(isOpen)appendOwn(row);return;}
  if(isOpen){messagesHost?.querySelector('.couple-connect-empty')?.remove();messagesHost?.append(renderMessage(row));scrollToLatest();await markRead();}
  else{unread+=1;updateUnreadBadge();}
  const senderName=partner?.profile?.display_name||'Pasanganmu';
  if(row.kind==='poke'){playPokeEffect();showPopup('👉',`${senderName} mencolekmu`,'Buka Couple Connect');navigator.vibrate?.([130,60,130,60,180]);}
  else if(row.kind==='heart'){showerHearts('♥');showPopup('❤️',`${senderName} mengirim hati`,'Sebuah hati baru tiba');navigator.vibrate?.([80,45,110]);}
  else if(row.kind==='miss_you'){showerHearts('🌙');showPopup('🌙',`${senderName} bilang kangen`,'Buka dan balas pesannya');navigator.vibrate?.([100,60,140]);}
  else{showPopup('💬',senderName,row.body||'Pesan baru');navigator.vibrate?.([75,45,95]);}
}

function handleUpdated(row){
  const node=messagesHost?.querySelector(`[data-message-id="${row.id}"]`);if(!node)return;
  const meta=node.querySelector('.couple-message__meta');if(row.sender_id===activeUserId&&row.read_at&&!meta.textContent.includes('Dibaca'))meta.textContent+=' · Dibaca';
}

async function refreshUnread(){
  if(!activeUniverseId||!activeUserId)return;
  try{
    const{count,error}=await supabase().from('couple_messages').select('id',{count:'exact',head:true}).eq('universe_id',activeUniverseId).eq('recipient_id',activeUserId).is('read_at',null);
    if(error)throw error;unread=count||0;updateUnreadBadge();
  }catch{unread=0;updateUnreadBadge();}
}

async function markRead(){
  if(!activeUniverseId||!activeUserId)return;
  try{
    await supabase().from('couple_messages').update({read_at:new Date().toISOString()}).eq('universe_id',activeUniverseId).eq('recipient_id',activeUserId).is('read_at',null);
  }catch{}
}

function updateUnreadBadge(){
  if(!launcher)return;launcher.classList.toggle('has-unread',unread>0);launcher.querySelector('[data-unread]').textContent=String(Math.min(unread,99));
}

function broadcastTyping(active,immediate=false){
  if(!channel||!subscribed||!partner)return;
  const now=Date.now();if(!immediate&&now-lastTypingSent<900)return;lastTypingSent=now;
  Promise.resolve(channel.send({type:'broadcast',event:'typing',payload:{user_id:activeUserId,active:Boolean(active),at:now}})).catch(()=>{});
}

function handleTyping(payload){
  if(payload.user_id===activeUserId||!typingHost)return;
  clearTimeout(typingTimer);typingHost.textContent=payload.active?`${partner?.profile?.display_name||'Pasanganmu'} sedang mengetik…`:'';
  if(payload.active)typingTimer=setTimeout(()=>{typingHost.textContent='';},2400);
}

function showPopup(icon,title,text){
  document.querySelector('.couple-popup')?.remove();clearTimeout(popupTimer);
  const node=document.createElement('button');node.type='button';node.className='couple-popup';node.setAttribute('data-capture-ignore','true');node.innerHTML='<span class="couple-popup__icon"></span><span class="couple-popup__copy"><strong></strong><span></span></span>';
  node.querySelector('.couple-popup__icon').textContent=icon;node.querySelector('strong').textContent=title;node.querySelector('.couple-popup__copy span').textContent=text;
  node.onclick=()=>{node.remove();openConnect();};document.body.append(node);requestAnimationFrame(()=>node.classList.add('is-visible'));
  popupTimer=setTimeout(()=>{node.classList.remove('is-visible');setTimeout(()=>node.remove(),450);},6500);
}

function playPokeEffect(){
  document.querySelector('.couple-poke-effect')?.remove();const effect=document.createElement('div');effect.className='couple-poke-effect';document.body.append(effect);document.body.classList.add('is-couple-poked');
  setTimeout(()=>document.body.classList.remove('is-couple-poked'),620);setTimeout(()=>effect.remove(),1100);
}

function showerHearts(symbol='♥'){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(let i=0;i<16;i++)setTimeout(()=>{
    const heart=document.createElement('span');heart.className='couple-heart-particle';heart.textContent=symbol;
    heart.style.setProperty('--x',`${8+Math.random()*84}%`);heart.style.setProperty('--size',`${16+Math.random()*22}px`);heart.style.setProperty('--duration',`${2.6+Math.random()*1.8}s`);heart.style.setProperty('--drift',`${-80+Math.random()*160}px`);heart.style.setProperty('--rotate',`${-100+Math.random()*200}deg`);
    document.body.append(heart);setTimeout(()=>heart.remove(),5000);
  },i*70);
}

function scrollToLatest(){requestAnimationFrame(()=>{if(messagesHost)messagesHost.scrollTop=messagesHost.scrollHeight;});}
function friendlyError(error){const message=String(error?.message||error||'');if(message.includes('couple_messages')||message.includes('schema cache'))return'Couple Connect belum dipasang di database. Jalankan migrasi SQL v4.3.';return message||'Sinyal belum dapat dikirim.';}

events.on('presence:sync',()=>refreshPartnerUI());
events.on('state:change',event=>{if(['user','universe','members'].includes(event.detail?.key))scheduleStart(90);});
events.on('realtime:change',event=>{if(['universe_members','profiles'].includes(event.detail?.table))scheduleStart(400);});
window.addEventListener('our-universe:context-ready',()=>scheduleStart(0));
window.addEventListener('our-universe:context-cleared',()=>{clearTimeout(startupTimer);closeConnect();activeUniverseId='';activeUserId='';partner=null;void disconnectChannel();if(launcher)launcher.hidden=true;});
window.addEventListener('our-universe:romantic-push',event=>{if(['couple_message','couple_signal'].includes(event.detail?.event_type))openConnect();});
window.addEventListener('online',()=>scheduleStart(250));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleStart(180);});
window.addEventListener('pagehide',()=>{clearTimeout(startupTimer);disconnectChannel();});

scheduleStart(0);
