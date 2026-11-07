/* Cosmic Scanner: animasi "pemindaian" singkat yang tampil setelah tombol MASUK ditekan,
   sebelum masuk ke website. Murni tampilan (tidak menyentuh Supabase). Bisa dilewati kapan saja. */

import { events } from '../core/event-bus.js';
import { state } from '../core/state.js';
import { supabase } from '../core/supabase.js';
import { CONFIG } from '../config.js';

const LINES=[
  'INITIALIZING COSMIC SYSTEM...',
  'CONNECTING TO TWO HEARTS...',
  'SCANNING UNIVERSE...',
  'CONNECTION ESTABLISHED.'
];
const TYPE_MS=22,LINE_PAUSE=260,HOLD_MS=520,REDUCED_HOLD_MS=700;

let cssPromise=null;
function ensureStyles(){
  if(cssPromise)return cssPromise;
  cssPromise=new Promise(resolve=>{
    const link=document.createElement('link');link.rel='stylesheet';
    link.href=new URL('../../css/cosmic-scanner.css?v=4.9.12',import.meta.url).href;
    link.onload=()=>resolve();link.onerror=()=>resolve();
    document.head.append(link);setTimeout(resolve,1500);
  });
  return cssPromise;
}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function reducedMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches;}

/* Menjalankan animasi scanner lalu mengembalikan promise yang selesai saat animasi berakhir (atau dilewati).
   onDone HARUS dipanggil oleh pemanggil untuk melanjutkan alur (membuka website). */
export async function runCosmicScanner(){
  await ensureStyles();
  const reduced=reducedMotion();
  const overlay=el('div','cosmic-scanner');overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.setAttribute('data-capture-ignore','true');
  overlay.innerHTML=`
    <div class="cosmic-scanner__field" aria-hidden="true"></div>
    <div class="cosmic-scanner__radar" aria-hidden="true"><div class="cosmic-scanner__sweep"></div><div class="cosmic-scanner__ring"></div><div class="cosmic-scanner__ring cosmic-scanner__ring--2"></div></div>
    <div class="cosmic-scanner__panel">
      <pre class="cosmic-scanner__terminal" data-terminal></pre>
      <button type="button" class="cosmic-scanner__skip" data-skip>Lewati</button>
    </div>`;
  document.body.append(overlay);
  requestAnimationFrame(()=>overlay.classList.add('is-visible'));

  let skipped=false;
  let captureState='idle'; // idle | live | preview | saving | saved | declined
  let stream=null,photoBlob=null,photoUrl=null;
  const ctx=()=>({universeId:state.snapshot.universe?.id||'',userId:state.snapshot.user?.id||''});
  const loggedIn=()=>Boolean(ctx().universeId&&ctx().userId);
  const panel=overlay.querySelector('.cosmic-scanner__panel');
  const selfieWrap=el('div','cosmic-scanner__selfie');selfieWrap.hidden=true;
  const selfieOpen=el('button','cosmic-scanner__selfie-open','📷 Ambil selfie momen ini');selfieOpen.type='button';
  selfieWrap.innerHTML=`
    <video class="cosmic-scanner__video" playsinline muted autoplay></video>
    <canvas class="cosmic-scanner__canvas" hidden></canvas>
    <p class="cosmic-scanner__selfie-note" data-note></p>
    <div class="cosmic-scanner__selfie-actions">
      <button type="button" class="button button--ghost" data-cancel>Batal</button>
      <button type="button" class="button button--ghost" data-retake hidden>Ulangi</button>
      <button type="button" class="button button--primary" data-shoot>Ambil Foto</button>
      <button type="button" class="button button--primary" data-save hidden>Simpan Foto</button>
    </div>`;
  const video=selfieWrap.querySelector('.cosmic-scanner__video');
  const canvas=selfieWrap.querySelector('.cosmic-scanner__canvas');
  const note=selfieWrap.querySelector('[data-note]');
  const btnShoot=selfieWrap.querySelector('[data-shoot]'),btnRetake=selfieWrap.querySelector('[data-retake]'),btnSave=selfieWrap.querySelector('[data-save]'),btnCancel=selfieWrap.querySelector('[data-cancel]');

  function stopStream(){stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;}
  function releasePhoto(){if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;photoBlob=null;}

  function setNote(text){note.textContent=text;}

  async function startCamera(){
    if(!navigator.mediaDevices?.getUserMedia){setNote('Kamera tidak tersedia di browser ini.');btnShoot.hidden=true;return;}
    setNote('Meminta izin kamera…');
    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
    }catch(error){
      captureState='declined';
      setNote(error?.name==='NotAllowedError'||error?.name==='SecurityError'?'Izin kamera ditolak. Tidak apa — lanjut tanpa foto.':'Kamera tidak bisa diakses saat ini.');
      btnShoot.hidden=true;btnRetake.hidden=true;btnSave.hidden=true;
      return;
    }
    captureState='live';video.srcObject=stream;
    setNote(loggedIn()?'Kamera aktif. Ambil fotonya kalau sudah siap.':'Kamera aktif untuk dicoba. Masuk dulu supaya foto bisa disimpan.');
  }

  function shoot(){
    if(captureState!=='live')return;
    const width=video.videoWidth||720,height=video.videoHeight||720;
    canvas.width=width;canvas.height=height;
    canvas.getContext('2d').drawImage(video,0,0,width,height);
    stopStream();
    video.hidden=true;canvas.hidden=false;
    captureState='preview';
    btnShoot.hidden=true;btnRetake.hidden=false;
    btnSave.hidden=!loggedIn();
    setNote(loggedIn()?'Suka dengan hasilnya? Simpan atau ulangi.':'Ini pratinjau saja — masuk dulu untuk menyimpan foto ini.');
  }

  async function retake(){
    releasePhoto();canvas.hidden=true;video.hidden=false;btnRetake.hidden=true;btnSave.hidden=true;btnShoot.hidden=false;
    await startCamera();
  }

  function safeName(){return `selfie-${Date.now()}.webp`;}

  async function save(){
    if(captureState!=='preview'||!loggedIn())return;
    captureState='saving';btnSave.disabled=true;btnRetake.disabled=true;setNote('Menyimpan foto…');
    try{
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.85));
      if(!blob)throw new Error('Gagal memproses gambar.');
      const{universeId,userId}=ctx();
      const path=`${universeId}/profiles/${userId}/cosmic/${crypto.randomUUID()}-${safeName()}`;
      const{error:uploadError}=await supabase().storage.from(CONFIG.STORAGE_BUCKET).upload(path,blob,{cacheControl:'31536000',upsert:false,contentType:'image/webp'});
      if(uploadError)throw uploadError;
      const partner=(state.snapshot.members||[]).find(member=>member.user_id!==userId);
      const{error:insertError}=await supabase().from('couple_messages').insert({
        universe_id:universeId,sender_id:userId,recipient_id:partner?.user_id||userId,kind:'text',
        body:'✨ Momen Cosmic Scanner tersimpan',
        metadata:{feature:'cosmic',type:'capture',attachment:{type:'image',path,mime:'image/webp',width:canvas.width,height:canvas.height}}
      });
      if(insertError){await supabase().storage.from(CONFIG.STORAGE_BUCKET).remove([path]).catch(()=>{});throw insertError;}
      captureState='saved';setNote('Tersimpan. Bisa dilihat lagi di Secret Room nanti. 💜');
      btnSave.hidden=true;btnRetake.hidden=true;
    }catch(error){
      captureState='preview';btnSave.disabled=false;btnRetake.disabled=false;
      setNote('Belum berhasil tersimpan. Coba lagi, atau lewati saja.');
    }
  }

  btnShoot.onclick=shoot;btnRetake.onclick=()=>{retake();};btnSave.onclick=save;
  btnCancel.onclick=()=>{stopStream();releasePhoto();selfieWrap.hidden=true;selfieOpen.hidden=false;captureState='idle';};
  selfieOpen.onclick=()=>{selfieOpen.hidden=true;selfieWrap.hidden=false;startCamera();};
  const onAuthChange=()=>{if(loggedIn()&&captureState==='live')setNote('Kamera aktif. Ambil fotonya kalau sudah siap.');if(loggedIn()&&captureState==='preview')btnSave.hidden=false;};
  const unsubscribeAuth=events.on('state:change',onAuthChange);
  panel.append(selfieOpen,selfieWrap);
  const finish=()=>new Promise(resolve=>{
    stopStream();releasePhoto();unsubscribeAuth();
    overlay.classList.add('is-leaving');
    overlay.classList.remove('is-visible');
    const done=()=>{overlay.remove();resolve();};
    overlay.addEventListener('transitionend',done,{once:true});
    setTimeout(done,500); // jaring pengaman jika transisi tidak sempat terpicu (mis. tab tersembunyi)
  });

  overlay.querySelector('[data-skip]').onclick=()=>{skipped=true;};

  const terminal=overlay.querySelector('[data-terminal]');
  if(reduced){
    terminal.textContent=LINES.join('\n');
    await sleep(REDUCED_HOLD_MS);
  }else{
    for(const line of LINES){
      if(skipped)break;
      const row=document.createElement('div');terminal.append(row);
      for(const ch of line){
        if(skipped)break;
        row.textContent+=ch;
        await sleep(TYPE_MS);
      }
      if(!skipped)row.textContent=line; // pastikan baris utuh walau skip terjadi di tengah karakter
      await sleep(skipped?0:LINE_PAUSE);
    }
    if(!skipped)await sleep(HOLD_MS);
  }
  await finish();
}
