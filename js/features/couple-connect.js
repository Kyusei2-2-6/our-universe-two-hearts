import { supabase } from '../core/supabase.js';
import { state } from '../core/state.js';
import { events } from '../core/event-bus.js';
import { signedUrl } from '../core/storage.js';
import { notificationService } from '../core/notifications.js';
import { initials } from '../core/utils.js';
import { toast } from '../components/toast.js';

const MAX_HISTORY=50;
const SIGNAL_LABELS={poke:'👉 Colek',heart:'❤️ Mengirim hati',miss_you:'🌙 Bilang kangen'};
let launcher=null,sheet=null,messagesHost=null,typingHost=null,compose=null,channel=null;
let activeUniverseId='',activeUserId='',partner=null,unread=0,isOpen=false,subscribed=false;
let typingTimer=null,lastTypingSent=0,popupTimer=null,signalCooldownUntil=0,retryAt=0;
let lastPartnerSignature='';
const seenIds=new Set();

function context(){
  const snapshot=state.snapshot;
  const universeId=snapshot.universe?.id||'';
  const userId=snapshot.user?.id||'';
  const chosen=(snapshot.members||[]).find(member=>member.user_id!==userId)||null;
  return{snapshot,universeId,userId,partner:chosen};
}

function appReady(){const shell=document.querySelector('#app-shell');return shell&&!shell.hidden;}

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
    seenIds.clear();unread=0;updateUnreadBadge();retryAt=0;
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
    <header class="couple-connect-header"><div class="couple-connect-header__person"><span class="couple-connect-header__avatar" data-partner-avatar>♡</span><span class="couple-connect-header__copy"><strong id="couple-connect-title" data-partner-name>Pasanganmu</strong><small data-partner-status>Memeriksa orbit…</small></span></div><button class="icon-button" data-close type="button" aria-label="Tutup chat">×</button></header>
    <div class="couple-connect-quick"><button data-signal="poke" type="button">👉 Colek</button><button data-signal="heart" type="button">❤️ Kirim hati</button><button data-signal="miss_you" type="button">🌙 Aku kangen</button></div>
    <div class="couple-connect-messages" data-messages><div class="couple-connect-empty">Kirim pesan kecil, colek, atau hati. Hanya kalian berdua yang dapat melihat ruang ini.</div></div>
    <div><div class="couple-connect-typing" data-typing></div><form class="couple-connect-compose" data-compose><textarea name="message" maxlength="2000" rows="1" placeholder="Tulis pesan untuk pasangan…" aria-label="Pesan untuk pasangan"></textarea><button class="button button--primary" type="submit" aria-label="Kirim pesan">➤</button></form></div>
  </div>`;
  messagesHost=sheet.querySelector('[data-messages]');typingHost=sheet.querySelector('[data-typing]');compose=sheet.querySelector('[data-compose]');
  sheet.querySelector('[data-close]').onclick=closeConnect;
  sheet.onclick=event=>{if(event.target===sheet)closeConnect();};
  sheet.querySelectorAll('[data-signal]').forEach(button=>button.onclick=()=>sendSignal(button.dataset.signal,button));
  compose.onsubmit=sendText;
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
  sheet.querySelectorAll('[data-signal], [data-compose] textarea, [data-compose] button').forEach(node=>node.disabled=!partner);
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
  if(!sheet)return;sheet.hidden=true;isOpen=false;broadcastTyping(false,true);
}

async function loadMessages(){
  if(!activeUniverseId||!messagesHost)return;
  messagesHost.innerHTML='<div class="couple-connect-empty">Membaca pesan kalian…</div>';
  try{
    const{data,error}=await supabase().from('couple_messages').select('*').eq('universe_id',activeUniverseId).order('created_at',{ascending:false}).limit(MAX_HISTORY);
    if(error)throw error;
    const rows=(data||[]).reverse();messagesHost.innerHTML='';
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
  const bubble=document.createElement('div');bubble.className='couple-message__bubble';bubble.textContent=row.kind==='text'?row.body:(SIGNAL_LABELS[row.kind]||'♡ Sinyal cinta');
  const meta=document.createElement('small');meta.className='couple-message__meta';
  const time=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit'}).format(new Date(row.created_at));
  meta.textContent=`${time}${mine&&row.read_at?' · Dibaca':''}`;
  node.append(bubble,meta);return node;
}

async function sendText(event){
  event.preventDefault();
  const input=compose.elements.message;const body=input.value.trim();if(!body||!partner)return;
  const button=compose.querySelector('button');button.disabled=true;
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

async function insertMessage(kind,body){
  if(!partner)throw new Error('Pasangan belum bergabung.');
  const{data,error}=await supabase().from('couple_messages').insert({universe_id:activeUniverseId,sender_id:activeUserId,recipient_id:partner.user_id,kind,body}).select().single();
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
events.on('realtime:change',event=>{if(['universe_members','profiles'].includes(event.detail?.table))setTimeout(ensureStarted,500);});
window.addEventListener('our-universe:romantic-push',event=>{if(['couple_message','couple_signal'].includes(event.detail?.event_type))openConnect();});
window.addEventListener('pagehide',()=>disconnectChannel());

setInterval(()=>ensureStarted().catch(error=>console.warn('Couple Connect menunggu konteks:',error)),900);
ensureStarted().catch(()=>{});
