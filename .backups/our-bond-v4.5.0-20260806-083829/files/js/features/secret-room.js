import { supabase } from '../core/supabase.js';
import { encryptPayload, decryptPayload } from '../core/crypto.js';
import { toast } from '../components/toast.js';

export function createSecretRoom(api){
  let root=null;
  let capsules=[];
  let countdownTimer=null;
  let loading=false;

  function mount(host){
    root=host;
    root.innerHTML=`<div class="bond-secret">
      <section class="bond-hero bond-secret-hero"><div class="bond-secret-moon" aria-hidden="true">☾<i></i></div><div><p class="bond-kicker">SECRET ROOM</p><h3>Tulis sesuatu sekarang. Biarkan waktu yang menyerahkannya.</h3><span class="bond-muted">Judul dan waktu buka terlihat bersama. Isi tetap berada di ruang rahasia sampai waktunya tiba.</span></div><button class="bond-primary" type="button" data-secret-create>＋ Buat kapsul rahasia</button></section>
      <section class="bond-secret-editor" data-secret-editor hidden><form data-secret-form><header><div><small>NEW SEALED MESSAGE</small><strong>Kapsul untuk masa depan</strong></div><button type="button" data-secret-cancel aria-label="Tutup formulir">×</button></header><label class="bond-field"><span>Judul yang akan terlihat</span><input name="title" maxlength="120" required placeholder="Contoh: Buka saat hari jadi kita"></label><label class="bond-field"><span>Petunjuk kecil</span><input name="hint" maxlength="180" placeholder="Opsional, tanpa membocorkan isi"></label><label class="bond-field"><span>Isi rahasia</span><textarea name="body" maxlength="12000" rows="6" required placeholder="Tulis surat, janji, atau pesan yang ingin dibuka nanti…"></textarea></label><div class="bond-secret-row"><label class="bond-field"><span>Waktu membuka</span><input name="unlock_at" type="datetime-local" required></label><label class="bond-field"><span>Kata sandi tambahan</span><input name="password" type="password" minlength="4" maxlength="120" placeholder="Opsional, minimal 4 karakter"></label></div><p class="bond-secret-safety">Tanpa kata sandi, isi tetap dilindungi oleh akun, RLS Supabase, dan waktu buka. Dengan kata sandi, isi juga dienkripsi AES-GCM di perangkat sebelum disimpan.</p><div class="bond-secret-form-actions"><button type="button" class="bond-secondary" data-secret-cancel>Batal</button><button type="submit" class="bond-primary">Segel kapsul</button></div></form></section>
      <section class="bond-secret-list" data-secret-list></section>
    </div>`;
    root.querySelector('[data-secret-create]').onclick=openEditor;
    root.querySelectorAll('[data-secret-cancel]').forEach(button=>button.onclick=closeEditor);
    root.querySelector('[data-secret-form]').onsubmit=createCapsule;
    setDefaultUnlockTime();renderList();
  }

  async function activate(){
    api.setSubtitle('Kapsul rahasia dengan waktu buka dan enkripsi opsional.');
    await refresh();startCountdowns();
  }

  function deactivate(){stopCountdowns();}
  function destroy(){stopCountdowns();}
  async function contextChanged(){capsules=[];renderList();if(root&&!root.hidden)await refresh();}

  function openEditor(){
    const editor=root.querySelector('[data-secret-editor]');editor.hidden=false;setDefaultUnlockTime();setTimeout(()=>root.querySelector('[name="title"]').focus(),80);
  }
  function closeEditor(){root.querySelector('[data-secret-editor]').hidden=true;root.querySelector('[data-secret-form]').reset();setDefaultUnlockTime();}
  function setDefaultUnlockTime(){
    const input=root?.querySelector('[name="unlock_at"]');if(!input)return;
    const date=new Date(Date.now()+24*60*60*1000);input.min=toLocalInput(new Date(Date.now()+60000));input.value=toLocalInput(date);
  }

  async function refresh(){
    const{universeId}=api.getContext();if(!root||!universeId||loading)return;
    loading=true;root.classList.add('is-loading');
    try{
      const{data,error}=await supabase().from('bond_capsules').select('*').eq('universe_id',universeId).order('unlock_at',{ascending:true});
      if(error)throw error;capsules=data||[];renderList();
    }catch(error){renderDatabaseError(error);}
    finally{loading=false;root.classList.remove('is-loading');}
  }

  async function createCapsule(event){
    event.preventDefault();
    const form=event.currentTarget;const{universeId,userId}=api.getContext();if(!universeId||!userId)return;
    const title=form.elements.title.value.trim();const body=form.elements.body.value.trim();const hint=form.elements.hint.value.trim();const password=form.elements.password.value;
    const unlockAt=new Date(form.elements.unlock_at.value);
    if(!title||!body||Number.isNaN(unlockAt.getTime()))return;
    if(unlockAt.getTime()<=Date.now()+30000){toast('Waktu membuka harus berada di masa depan.',{type:'error'});return;}
    if(password&&password.length<4){toast('Kata sandi tambahan minimal 4 karakter.',{type:'error'});return;}
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Menyegel…';let capsuleId='';
    try{
      const{data:capsule,error:capsuleError}=await supabase().from('bond_capsules').insert({universe_id:universeId,created_by:userId,title,hint:hint||null,unlock_at:unlockAt.toISOString(),password_protected:Boolean(password)}).select().single();
      if(capsuleError)throw capsuleError;capsuleId=capsule.id;
      const payload=password?null:{body};
      const encryptedPayload=password?await encryptPayload({body},password):null;
      const{error:secretError}=await supabase().from('bond_capsule_secrets').insert({capsule_id:capsule.id,universe_id:universeId,created_by:userId,payload,encrypted_payload:encryptedPayload,password_protected:Boolean(password)});
      if(secretError)throw secretError;
      capsules=[capsule,...capsules.filter(item=>item.id!==capsule.id)].sort((a,b)=>new Date(a.unlock_at)-new Date(b.unlock_at));
      closeEditor();renderList();toast('Kapsul sudah disegel dan waktunya mulai berjalan.',{type:'success'});
    }catch(error){
      if(capsuleId){try{await supabase().from('bond_capsules').delete().eq('id',capsuleId).eq('created_by',userId);}catch{}}
      toast(friendlyError(error),{type:'error',duration:7000});
    }finally{submit.disabled=false;submit.textContent='Segel kapsul';}
  }

  function renderList(){
    if(!root)return;
    const host=root.querySelector('[data-secret-list]');host.innerHTML='';
    if(!capsules.length){host.innerHTML='<div class="bond-empty bond-empty--large"><strong>Secret Room masih kosong</strong><span>Buat kapsul pertama untuk ulang tahun, hari jadi, permintaan maaf, atau pesan kecil yang baru boleh dibuka nanti.</span></div>';return;}
    const now=Date.now();const{userId,partner}=api.getContext();
    capsules.forEach(capsule=>{
      const unlocked=new Date(capsule.unlock_at).getTime()<=now;
      const mine=capsule.created_by===userId;
      const article=document.createElement('article');article.className=`bond-secret-card${unlocked?' is-unlocked':' is-locked'}`;article.dataset.capsuleId=capsule.id;
      article.innerHTML='<div class="bond-secret-seal"><span></span><i></i></div><div class="bond-secret-copy"><p></p><h3></h3><small data-secret-owner></small><span data-secret-hint></span><div class="bond-secret-countdown" data-secret-countdown></div><div class="bond-secret-reveal" data-secret-reveal></div></div><div class="bond-secret-actions"></div>';
      article.querySelector('.bond-secret-seal span').textContent=unlocked?'✦':'☾';article.querySelector('.bond-secret-copy p').textContent=unlocked?'READY TO OPEN':'SEALED IN TIME';article.querySelector('h3').textContent=capsule.title;
      article.querySelector('[data-secret-owner]').textContent=`Dibuat oleh ${mine?'kamu':(partner?.profile?.display_name||'pasangan')} · ${formatDate(capsule.created_at)}`;
      article.querySelector('[data-secret-hint]').textContent=capsule.hint||'Tidak ada petunjuk. Hanya waktu yang tahu.';
      if(!unlocked)article.querySelector('[data-secret-countdown]').dataset.unlockAt=capsule.unlock_at;
      const actions=article.querySelector('.bond-secret-actions');
      if(unlocked){const open=document.createElement('button');open.type='button';open.className='bond-primary';open.textContent='Buka isi rahasia';open.onclick=()=>openCapsule(capsule,article);actions.append(open);}
      if(mine){const remove=document.createElement('button');remove.type='button';remove.className='bond-danger';remove.textContent='Hapus';remove.onclick=()=>deleteCapsule(capsule);actions.append(remove);}
      host.append(article);
    });
    tickCountdowns();
  }

  async function openCapsule(capsule,article){
    const reveal=article.querySelector('[data-secret-reveal]');const button=article.querySelector('.bond-secret-actions .bond-primary');button.disabled=true;button.textContent='Membuka…';
    try{
      const{data,error}=await supabase().from('bond_capsule_secrets').select('*').eq('capsule_id',capsule.id).maybeSingle();
      if(error)throw error;if(!data)throw new Error('Isi kapsul belum tersedia atau waktunya belum tiba.');
      if(data.password_protected){
        reveal.innerHTML='<form class="bond-secret-unlock"><label class="bond-field"><span>Masukkan kata sandi kapsul</span><input name="password" type="password" minlength="4" required autocomplete="off"></label><button class="bond-primary" type="submit">Buka dengan kata sandi</button></form>';
        const form=reveal.querySelector('form');form.onsubmit=async event=>{event.preventDefault();const submit=form.querySelector('button');submit.disabled=true;try{const payload=await decryptPayload(data.encrypted_payload,form.elements.password.value);renderRevealed(reveal,payload.body);}catch(error){toast(error.message,{type:'error'});submit.disabled=false;}};
        setTimeout(()=>form.elements.password.focus(),60);
      }else renderRevealed(reveal,data.payload?.body||'');
      button.hidden=true;
    }catch(error){toast(friendlyError(error),{type:'error',duration:6500});button.disabled=false;button.textContent='Buka isi rahasia';}
  }

  function renderRevealed(host,body){
    host.innerHTML='';const box=document.createElement('blockquote');box.className='bond-secret-message';box.textContent=body||'Kapsul ini tidak memiliki isi.';host.append(box);navigator.vibrate?.([70,45,120]);
  }

  async function deleteCapsule(capsule){
    const{userId}=api.getContext();if(!confirm(`Hapus kapsul “${capsule.title}”? Isi rahasianya juga akan dihapus permanen.`))return;
    try{
      const{error}=await supabase().from('bond_capsules').delete().eq('id',capsule.id).eq('created_by',userId);if(error)throw error;
      capsules=capsules.filter(item=>item.id!==capsule.id);renderList();toast('Kapsul telah dihapus.');
    }catch(error){toast(friendlyError(error),{type:'error'});}
  }

  function startCountdowns(){stopCountdowns();tickCountdowns();countdownTimer=setInterval(tickCountdowns,1000);}
  function stopCountdowns(){clearInterval(countdownTimer);countdownTimer=null;}
  function tickCountdowns(){
    if(!root)return;let shouldRefresh=false;
    root.querySelectorAll('[data-secret-countdown][data-unlock-at]').forEach(node=>{
      const ms=new Date(node.dataset.unlockAt).getTime()-Date.now();
      if(ms<=0){shouldRefresh=true;return;}
      const days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000),minutes=Math.floor(ms%3600000/60000),seconds=Math.floor(ms%60000/1000);
      node.textContent=days>0?`${days} hari · ${hours} jam · ${minutes} menit`:`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    });
    if(shouldRefresh)refresh();
  }

  function renderDatabaseError(error){const host=root.querySelector('[data-secret-list]');host.innerHTML='<div class="bond-empty is-error"><strong>Secret Room belum aktif</strong><span>Jalankan migrasi SQL v4.5.0 di Supabase, lalu muat ulang aplikasi.</span></div>';console.warn('Secret Room:',error);}
  function realtime(table,payload){if(table!=='bond_capsules')return;const row=payload.new||payload.old;if(!row)return;capsules=payload.eventType==='DELETE'?capsules.filter(item=>item.id!==row.id):[row,...capsules.filter(item=>item.id!==row.id)].sort((a,b)=>new Date(a.unlock_at)-new Date(b.unlock_at));renderList();}
  return{mount,activate,deactivate,destroy,contextChanged,realtime};
}

function toLocalInput(date){const pad=value=>String(value).padStart(2,'0');return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;}
function formatDate(value){return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));}
function friendlyError(error){const message=String(error?.message||error||'');if(message.includes('bond_capsule')||message.includes('schema cache'))return'Secret Room belum aktif di database. Jalankan migrasi SQL v4.5.0.';return message||'Kapsul belum dapat diproses.';}
