import { supabase } from '../core/supabase.js';
import { initials } from '../core/utils.js';
import { toast } from '../components/toast.js';

const MOODS={
  loved:{emoji:'🥰',label:'Disayang'},
  calm:{emoji:'🌙',label:'Tenang'},
  missing:{emoji:'💗',label:'Kangen'},
  excited:{emoji:'✨',label:'Bersemangat'},
  tired:{emoji:'☁',label:'Lelah'},
  sad:{emoji:'🥺',label:'Butuh peluk'}
};
const PULSE_TYPES={heartbeat:'Detak hati',hug:'Peluk virtual',kiss:'Cium jauh',support:'Aku di sini'};

export function createHeartbeatEngine(api){
  let root=null;
  let emotions=[];
  let pulses=[];
  let loading=false;
  let lastPulseAt=0;

  function mount(host){
    root=host;
    root.innerHTML=`<div class="bond-heartbeat">
      <section class="bond-hero bond-heartbeat-hero">
        <div class="bond-heart-orbit" aria-hidden="true"><span>♡</span><i></i><b></b></div>
        <div><p class="bond-kicker">HEARTBEAT PRESENCE</p><h3>Rasakan kehadiran, bukan sekadar status online.</h3><span class="bond-muted">Bagikan suasana hati dan kirim satu detak kecil saat kata-kata belum cukup.</span></div>
      </section>
      <div class="bond-heartbeat-grid">
        <section class="bond-card bond-presence-card"><header><div><small>KEHADIRAN KALIAN</small><strong>Two hearts, one orbit</strong></div><span data-heart-sync>Menunggu sinkronisasi</span></header><div class="bond-people" data-heart-people></div></section>
        <section class="bond-card bond-emotion-card"><header><div><small>SUASANA HATIKU</small><strong>Apa yang sedang kamu rasakan?</strong></div></header><form data-emotion-form><div class="bond-mood-picker">${Object.entries(MOODS).map(([value,item],index)=>`<label><input type="radio" name="mood" value="${value}" ${index===0?'checked':''}><span><b>${item.emoji}</b><small>${item.label}</small></span></label>`).join('')}</div><label class="bond-field"><span>Pesan kecil untuk pasangan</span><input name="note" maxlength="180" placeholder="Contoh: Hari ini capek, tapi ingat kamu."></label><label class="bond-range"><span>Seberapa kuat rasanya?</span><input name="intensity" type="range" min="1" max="5" value="3"><output>3/5</output></label><button class="bond-primary" type="submit">Bagikan suasana hati</button></form></section>
      </div>
      <section class="bond-card bond-pulse-card"><header><div><small>SEND A PULSE</small><strong>Kirim sinyal yang langsung terasa</strong></div><span>Privat untuk kalian berdua</span></header><div class="bond-pulse-actions">${Object.entries(PULSE_TYPES).map(([type,label],index)=>`<button type="button" data-pulse="${type}" ${index===0?'class="is-primary"':''}><span>${type==='heartbeat'?'♡':type==='hug'?'🤍':type==='kiss'?'💋':'🫶'}</span><small>${label}</small></button>`).join('')}</div><div class="bond-pulse-history" data-pulse-history></div></section>
    </div>`;
    const form=root.querySelector('[data-emotion-form]');
    form.onsubmit=saveEmotion;
    const range=form.elements.intensity;
    range.oninput=()=>{form.querySelector('output').textContent=`${range.value}/5`;};
    root.querySelectorAll('[data-pulse]').forEach(button=>button.onclick=()=>sendPulse(button.dataset.pulse,button));
    render();
  }

  async function activate(){
    api.setSubtitle('Detak, suasana hati, dan kehadiran kalian dalam satu ruang.');
    await refresh();
  }

  async function contextChanged(){
    emotions=[];pulses=[];render();
    if(root&&!root.hidden)await refresh();
  }

  async function refresh(){
    const{universeId}=api.getContext();
    if(!root||!universeId||loading)return;
    loading=true;root.classList.add('is-loading');
    try{
      const client=supabase();
      const[{data:emotionRows,error:emotionError},{data:pulseRows,error:pulseError}]=await Promise.all([
        client.from('bond_emotions').select('*').eq('universe_id',universeId).order('updated_at',{ascending:false}),
        client.from('bond_pulses').select('*').eq('universe_id',universeId).order('created_at',{ascending:false}).limit(12)
      ]);
      if(emotionError)throw emotionError;
      if(pulseError)throw pulseError;
      emotions=emotionRows||[];pulses=pulseRows||[];
      hydrateEmotionForm();render();
    }catch(error){
      renderDatabaseError(error);
    }finally{loading=false;root.classList.remove('is-loading');}
  }

  function hydrateEmotionForm(){
    const{userId}=api.getContext();
    const mine=emotions.find(item=>item.user_id===userId);
    const form=root?.querySelector('[data-emotion-form]');
    if(!mine||!form)return;
    const radio=form.querySelector(`[name="mood"][value="${mine.mood}"]`);if(radio)radio.checked=true;
    form.elements.note.value=mine.note||'';
    form.elements.intensity.value=String(mine.intensity||3);
    form.querySelector('output').textContent=`${mine.intensity||3}/5`;
  }

  function render(){
    if(!root)return;
    renderPeople();renderHistory();
  }

  function renderPeople(){
    const host=root.querySelector('[data-heart-people]');
    const sync=root.querySelector('[data-heart-sync]');
    if(!host)return;
    const{snapshot,userId,partner}=api.getContext();
    const people=[
      {id:userId,name:snapshot.profile?.display_name||'Kamu',profile:snapshot.profile,isMe:true},
      {id:partner?.user_id||'',name:partner?.profile?.display_name||'Pasanganmu',profile:partner?.profile||null,isMe:false}
    ];
    host.innerHTML='';
    let onlineCount=0;
    people.forEach(person=>{
      const online=Boolean(person.id&&(snapshot.presence||{})[person.id]?.length);
      if(online)onlineCount+=1;
      const emotion=emotions.find(item=>item.user_id===person.id);
      const mood=MOODS[emotion?.mood]||null;
      const article=document.createElement('article');article.className=`bond-person${online?' is-online':''}`;
      const avatar=document.createElement('span');avatar.className='bond-person__avatar';avatar.textContent=initials(person.name);
      const copy=document.createElement('div');copy.innerHTML='<strong></strong><small></small><p></p>';copy.querySelector('strong').textContent=person.isMe?'Kamu':person.name;
      copy.querySelector('small').textContent=online?'Online di semesta':(person.id?'Sedang di luar semesta':'Belum bergabung');
      copy.querySelector('p').textContent=mood?`${mood.emoji} ${mood.label}${emotion.note?` · ${emotion.note}`:''}`:'Belum membagikan suasana hati';
      const beat=document.createElement('i');beat.className='bond-person__beat';const strength=Math.max(1,Math.min(5,emotion?.intensity||2));beat.style.setProperty('--beat-duration',`${(1.65-strength*.08).toFixed(2)}s`);
      article.append(avatar,copy,beat);host.append(article);
    });
    sync.textContent=onlineCount===2?'Kalian sedang hadir bersama':onlineCount===1?'Satu hati sedang online':'Detak tersimpan di sini';
    sync.classList.toggle('is-live',onlineCount===2);
  }

  function renderHistory(){
    const host=root.querySelector('[data-pulse-history]');if(!host)return;
    const{userId,partner}=api.getContext();
    host.innerHTML='';
    if(!pulses.length){host.innerHTML='<div class="bond-empty"><strong>Belum ada detak terkirim</strong><span>Detak pertama akan muncul di sini dan langsung tersinkron ke pasangan.</span></div>';return;}
    pulses.slice(0,8).forEach(item=>{
      const mine=item.sender_id===userId;
      const article=document.createElement('article');article.className=`bond-pulse-row${mine?' is-mine':''}`;
      const icon=document.createElement('span');icon.textContent=item.pulse_type==='heartbeat'?'♡':item.pulse_type==='hug'?'🤍':item.pulse_type==='kiss'?'💋':'🫶';
      const copy=document.createElement('div');copy.innerHTML='<strong></strong><small></small>';
      copy.querySelector('strong').textContent=mine?`Kamu mengirim ${PULSE_TYPES[item.pulse_type]||'sinyal'}`:`${partner?.profile?.display_name||'Pasanganmu'} mengirim ${PULSE_TYPES[item.pulse_type]||'sinyal'}`;
      copy.querySelector('small').textContent=relativeTime(item.created_at);
      const intensity=document.createElement('b');intensity.textContent='♥'.repeat(Math.max(1,Math.min(5,item.intensity||1)));
      article.append(icon,copy,intensity);host.append(article);
    });
  }

  async function saveEmotion(event){
    event.preventDefault();
    const form=event.currentTarget;
    const{universeId,userId}=api.getContext();
    if(!universeId||!userId)return;
    const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Menyimpan…';
    const record={universe_id:universeId,user_id:userId,mood:form.elements.mood.value,note:form.elements.note.value.trim()||null,intensity:Number(form.elements.intensity.value),updated_at:new Date().toISOString()};
    try{
      const{data,error}=await supabase().from('bond_emotions').upsert(record,{onConflict:'universe_id,user_id'}).select().single();
      if(error)throw error;
      emotions=[data,...emotions.filter(item=>item.user_id!==userId)];render();
      toast('Suasana hatimu sudah sampai ke pasangan.',{type:'success'});
    }catch(error){toast(friendlyError(error),{type:'error',duration:6500});}
    finally{button.disabled=false;button.textContent='Bagikan suasana hati';}
  }

  async function sendPulse(type,button){
    const{universeId,userId,partner}=api.getContext();
    if(!partner){toast('Pasangan belum bergabung ke semesta.',{type:'error'});return;}
    if(Date.now()-lastPulseAt<4500){toast('Tunggu sebentar sebelum mengirim detak berikutnya.');return;}
    lastPulseAt=Date.now();button.disabled=true;
    try{
      const mine=emotions.find(item=>item.user_id===userId);
      const{data,error}=await supabase().from('bond_pulses').insert({universe_id:universeId,sender_id:userId,recipient_id:partner.user_id,pulse_type:type,intensity:mine?.intensity||3}).select().single();
      if(error)throw error;
      pulses=[data,...pulses.filter(item=>item.id!==data.id)];renderHistory();
      animatePulse(type);navigator.vibrate?.([80,45,110]);
      toast(`${PULSE_TYPES[type]||'Sinyal'} sudah terkirim.`,{type:'success'});
    }catch(error){toast(friendlyError(error),{type:'error',duration:6500});}
    finally{setTimeout(()=>{button.disabled=false;},1800);}
  }

  function animatePulse(type){
    const hero=root.querySelector('.bond-heart-orbit');hero.classList.remove('is-pulsing');void hero.offsetWidth;hero.classList.add('is-pulsing');
    const symbol=type==='kiss'?'💋':type==='hug'?'🤍':type==='support'?'🫶':'♥';
    for(let index=0;index<7;index+=1){
      const particle=document.createElement('span');particle.className='bond-local-particle';particle.textContent=symbol;particle.style.setProperty('--particle-index',String(index));particle.style.setProperty('--particle-x',`${(index-3)*18}px`);particle.style.setProperty('--particle-y',`${-72-index*5}px`);particle.style.setProperty('--particle-rotate',`${(index-3)*16}deg`);hero.append(particle);setTimeout(()=>particle.remove(),1800);
    }
  }

  function renderDatabaseError(error){
    const host=root.querySelector('[data-pulse-history]');
    if(host)host.innerHTML='<div class="bond-empty is-error"><strong>Heartbeat belum tersambung</strong><span>Jalankan SQL v4.9.3 ALL-IN-ONE di Supabase, lalu muat ulang aplikasi.</span></div>';
    console.warn('Heartbeat Presence:',error);
  }

  function realtime(table,payload){
    if(table==='bond_emotions'){
      const row=payload.new||payload.old;if(!row)return;
      emotions=payload.eventType==='DELETE'?emotions.filter(item=>item.user_id!==row.user_id):[row,...emotions.filter(item=>item.user_id!==row.user_id)];
      render();
    }
    if(table==='bond_pulses'){
      const row=payload.new||payload.old;if(!row)return;
      pulses=payload.eventType==='DELETE'?pulses.filter(item=>item.id!==row.id):[row,...pulses.filter(item=>item.id!==row.id)].slice(0,12);
      renderHistory();
      const{userId}=api.getContext();if(payload.eventType==='INSERT'&&row.sender_id!==userId)animatePulse(row.pulse_type);
    }
  }

  function presenceChanged(){renderPeople();}
  return{mount,activate,contextChanged,refresh,realtime,presenceChanged};
}

function relativeTime(value){
  const delta=Math.max(0,Date.now()-new Date(value).getTime());
  if(delta<60000)return'baru saja';
  if(delta<3600000)return`${Math.floor(delta/60000)} menit lalu`;
  if(delta<86400000)return`${Math.floor(delta/3600000)} jam lalu`;
  return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
function friendlyError(error){
  const message=String(error?.message||error||'');
  if(message.includes('bond_')||message.includes('schema cache'))return'Our Bond belum aktif di database. Jalankan SQL v4.9.3 ALL-IN-ONE.';
  return message||'Detak belum dapat disimpan.';
}
