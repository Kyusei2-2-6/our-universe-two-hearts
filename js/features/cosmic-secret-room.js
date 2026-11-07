/* Secret Room: galeri momen Cosmic Scanner, tersembunyi di balik PIN.
   PIN diverifikasi di SERVER lewat Edge Function "verify-cosmic-pin" - PIN tidak pernah dicocokkan
   di JavaScript frontend. Galeri sendiri numpang pada tabel couple_messages yang sudah ada
   (baris bermetadata feature:"cosmic"), jadi TIDAK ADA tabel database baru.
   PIN ini adalah penghalang UI supaya layar tidak mencolok/tidak kepencet tak sengaja - bukan
   pengganti keamanan data: akses foto tetap dilindungi RLS Supabase seperti biasa. */
import { state } from '../core/state.js';
import { supabase } from '../core/supabase.js';
import { CONFIG } from '../config.js';
import { toast } from '../components/toast.js';

let cssPromise=null;
function ensureStyles(){
  if(cssPromise)return cssPromise;
  cssPromise=new Promise(resolve=>{
    const link=document.createElement('link');link.rel='stylesheet';
    link.href=new URL('../../css/cosmic-secret-room.css?v=4.9.14',import.meta.url).href;
    link.onload=()=>resolve();link.onerror=()=>resolve();
    document.head.append(link);setTimeout(resolve,1800);
  });
  return cssPromise;
}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}

let unlockToken=null; // {token, expiresAt} - hanya di memori, hilang saat tab ditutup/di-reload

function ctx(){return{universeId:state.snapshot.universe?.id||'',userId:state.snapshot.user?.id||''};}

async function callVerify(pin){
  const{data:{session}}=await supabase().auth.getSession();
  const accessToken=session?.access_token;
  if(!accessToken)throw new Error('Sesi berakhir. Masuk ulang lalu coba lagi.');
  const{universeId}=ctx();
  const{data,error}=await supabase().functions.invoke('verify-cosmic-pin',{body:{universe_id:universeId,pin}});
  if(error){
    const status=error?.context?.status;
    if(status===429)throw new Error('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    if(status===401)throw new Error('PIN salah.');
    throw new Error('Tidak bisa menghubungi server. Coba lagi.');
  }
  if(!data?.ok)throw new Error(data?.error||'PIN salah.');
  return data;
}

function hasValidUnlock(){return Boolean(unlockToken&&unlockToken.expiresAt>Date.now());}

async function fetchCaptures(){
  const{universeId}=ctx();
  const{data,error}=await supabase().from('couple_messages').select('*').eq('universe_id',universeId).order('created_at',{ascending:false}).limit(300);
  if(error)throw error;
  return(data||[]).filter(row=>row?.metadata?.feature==='cosmic'&&row?.metadata?.type==='capture'&&row?.metadata?.attachment?.path);
}

async function removeCapture(row){
  const path=row.metadata.attachment.path;
  await supabase().storage.from(CONFIG.STORAGE_BUCKET).remove([path]).catch(()=>{});
  const{error}=await supabase().from('couple_messages').delete().eq('id',row.id);
  if(error)throw error;
}

function deviceInfo(){
  const ua=navigator.userAgent||'';
  const platform=navigator.userAgentData?.platform||navigator.platform||'Tidak diketahui';
  return{
    browser:(ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/[\d.]+/)||[ua.slice(0,40)])[0],
    platform,
    screen:`${screen.width}×${screen.height}`,
    time:new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date())
  };
}

function buildPinPad(onSubmit){
  const wrap=el('div','secret-pin');
  const title=el('div','secret-pin__title','🔒 Secret Room');
  const sub=el('p','secret-pin__sub','Masukkan PIN untuk membuka.');
  const dots=el('div','secret-pin__dots');
  for(let i=0;i<8;i++)dots.append(el('i',''));
  const error=el('p','secret-pin__error');error.hidden=true;
  let value='';
  const renderDots=()=>{[...dots.children].forEach((dot,i)=>dot.classList.toggle('is-filled',i<value.length));};
  const pad=el('div','secret-pin__pad');
  const confirmBtn=el('button','secret-pin__confirm','✓');confirmBtn.type='button';confirmBtn.disabled=true;confirmBtn.setAttribute('aria-label','Konfirmasi PIN');
  const keys=['1','2','3','4','5','6','7','8','9','⌫','0',null];
  let busy=false;
  const setPadDisabled=(disabled)=>{[...pad.querySelectorAll('button'),confirmBtn].forEach(button=>{button.disabled=disabled;});};
  const submit=async()=>{
    if(busy||value.length<4)return;
    busy=true;setPadDisabled(true);error.hidden=true;
    try{await onSubmit(value);}
    catch(err){error.textContent=err.message;error.hidden=false;value='';renderDots();busy=false;setPadDisabled(false);confirmBtn.disabled=true;}
  };
  for(const key of keys){
    if(key===null){pad.append(confirmBtn);continue;}
    const button=el('button','secret-pin__key',key);
    button.type='button';
    button.onclick=()=>{
      error.hidden=true;
      if(key==='⌫'){value=value.slice(0,-1);}
      else if(value.length<8){value+=key;}
      renderDots();confirmBtn.disabled=value.length<4;
    };
    pad.append(button);
  }
  confirmBtn.onclick=submit;
  wrap.append(title,sub,dots,pad,error);
  return wrap;
}

function buildDashboard(container,captures,onClose){
  container.innerHTML='';
  const wrap=el('div','secret-dash');
  const head=el('div','secret-dash__head');
  head.append(el('h2','','✨ Cosmic Control Center'),el('span','secret-dash__status','SYSTEM STATUS: ONLINE'));
  const close=el('button','button button--ghost secret-dash__close','Tutup');close.type='button';close.onclick=onClose;
  const stats=el('div','secret-dash__stats');
  const totalBytes=captures.reduce((sum,row)=>sum+(Number(row.metadata?.attachment?.size)||0),0);
  for(const[label,value] of[['CAPTURED MOMENTS',String(captures.length).padStart(2,'0')],['STORAGE',totalBytes?`${(totalBytes/1024/1024).toFixed(1)} MB`:'AVAILABLE'],['TERAKHIR',captures[0]?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date(captures[0].created_at)):'-']])
    stats.append((()=>{const card=el('div','secret-dash__stat');card.append(el('strong','',value),el('small','',label));return card;})());

  const device=deviceInfo();
  const deviceCard=el('div','secret-dash__device');
  deviceCard.append(el('h3','','Device Information'));
  const dl=el('dl','');
  for(const[k,v] of Object.entries({Browser:device.browser,Platform:device.platform,Layar:device.screen,Waktu:device.time}))
    dl.append(el('dt','',k),el('dd','',v));
  deviceCard.append(dl);

  const gallery=el('div','secret-dash__gallery');
  gallery.append(el('h3','',`Captured Moments (${captures.length})`));
  const grid=el('div','secret-dash__grid');
  if(!captures.length)grid.append(el('p','secret-dash__empty','Belum ada momen tersimpan.'));
  for(const row of captures){
    const card=el('div','secret-dash__photo');
    const img=el('img','');img.alt='Momen Cosmic Scanner';img.loading='lazy';
    const time=el('time','',new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.created_at)));
    const del=el('button','secret-dash__delete','🗑');del.type='button';del.setAttribute('aria-label','Hapus foto');
    del.onclick=async()=>{
      if(!window.confirm('Hapus foto ini? Tidak bisa dibatalkan.'))return;
      del.disabled=true;
      try{
        await removeCapture(row);
        card.remove();
        toast('Foto dihapus.');
      }catch{toast('Gagal menghapus foto.',{type:'error'});del.disabled=false;}
    };
    card.append(img,time,del);
    grid.append(card);
    supabase().storage.from(CONFIG.STORAGE_BUCKET).createSignedUrl(row.metadata.attachment.path,3600).then(({data})=>{if(data?.signedUrl)img.src=data.signedUrl;}).catch(()=>{card.classList.add('is-error');});
  }
  gallery.append(grid);

  wrap.append(head,close,stats,deviceCard,gallery);
  container.append(wrap);
}

export async function openSecretRoom(){
  await ensureStyles();
  const overlay=el('div','secret-overlay');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Secret Room');overlay.setAttribute('data-capture-ignore','true');
  document.body.append(overlay);
  const close=()=>{overlay.remove();document.removeEventListener('keydown',onKey,true);};
  const onKey=event=>{if(event.key==='Escape'){event.stopPropagation();close();}};
  document.addEventListener('keydown',onKey,true);
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();});

  async function showDashboard(){
    const loading=el('div','secret-loading','Memuat…');overlay.innerHTML='';overlay.append(loading);
    try{
      const captures=await fetchCaptures();
      buildDashboard(overlay,captures,close);
    }catch{
      overlay.innerHTML='';
      const errBox=el('div','secret-pin');
      errBox.append(el('p','secret-pin__sub','Gagal memuat Secret Room. Coba lagi nanti.'));
      const retry=el('button','button button--ghost','Tutup');retry.type='button';retry.onclick=close;
      errBox.append(retry);overlay.append(errBox);
    }
  }

  if(hasValidUnlock()){await showDashboard();return;}

  const pad=buildPinPad(async pin=>{
    const result=await callVerify(pin);
    unlockToken={token:result.token,expiresAt:result.expiresAt};
    await showDashboard();
  });
  overlay.append(pad);
}
