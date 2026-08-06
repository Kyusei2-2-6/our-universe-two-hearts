import { supabase } from '../core/supabase.js';
import { state } from '../core/state.js';
import { events } from '../core/event-bus.js';
import { toast } from '../components/toast.js';
import { initials } from '../core/utils.js';

let launcher=null;
let sheet=null;
let map=null;
let satelliteLayer=null;
let streetLayer=null;
let line=null;
let lineGlow=null;
let accuracyCircle=null;
let channel=null;
let watchId=null;
let activeUniverseId='';
let activeUserId='';
let partner=null;
let locationRows=[];
let markers=new Map();
let isOpen=false;
let lastSentAt=0;
let lastSentPosition=null;
let sharing=false;
let leafletPromise=null;
let startupTimer=0;

function context(){
  const snapshot=state.snapshot;
  const universeId=snapshot.universe?.id||'';
  const userId=snapshot.user?.id||'';
  const other=(snapshot.members||[]).find(member=>member.user_id!==userId)||null;
  return{snapshot,universeId,userId,partner:other};
}
function appReady(){const shell=document.querySelector('#app-shell');return Boolean(shell&&!shell.hidden);}

function scheduleStart(delay=0){
  clearTimeout(startupTimer);
  startupTimer=window.setTimeout(()=>ensureStarted().catch(()=>{}),delay);
}
function ensureDock(){let dock=document.querySelector('#couple-life-dock');if(!dock){dock=document.createElement('div');dock.id='couple-life-dock';dock.className='couple-life-dock';dock.setAttribute('data-capture-ignore','true');document.body.append(dock);}return dock;}

function ensureUI(){
  if(launcher)return;
  launcher=document.createElement('button');launcher.type='button';launcher.className='couple-life-button couple-life-button--map';launcher.setAttribute('aria-label','Buka peta lokasi pasangan');launcher.innerHTML='<span class="couple-life-button__icon">⌖</span><span class="couple-life-button__copy"><strong>Lokasi</strong><small data-map-launcher-status>Peta berdua</small></span>';launcher.onclick=openMap;ensureDock().prepend(launcher);
  sheet=document.createElement('section');sheet.className='couple-life-sheet couple-map-sheet';sheet.hidden=true;sheet.setAttribute('data-capture-ignore','true');sheet.innerHTML=`<div class="couple-life-backdrop" data-close></div>
  <div class="couple-life-panel couple-map-panel" role="dialog" aria-modal="true" aria-labelledby="couple-map-title">
    <header class="couple-life-header"><div><p class="couple-life-eyebrow">TWO HEARTS LIVE MAP</p><h2 id="couple-map-title">Peta Lokasi Berdua</h2><small>Peta satelit, posisi aktual, dan garis merah jarak kalian.</small></div><button class="couple-life-close" type="button" data-close aria-label="Tutup">×</button></header>
    <div class="couple-map-stage"><div class="couple-map-canvas" data-map></div><div class="couple-map-floating"><span data-map-state>Menunggu lokasi…</span><button type="button" data-focus>Fokus berdua</button></div></div>
    <div class="couple-map-stats"><article><small>Jarak lurus</small><strong data-distance>—</strong><span data-distance-note>Belum ada dua lokasi</span></article><article><small>Lokasimu</small><strong data-me-status>Belum dibagikan</strong><span data-me-detail>Aktifkan berbagi lokasi</span></article><article><small>Pasangan</small><strong data-partner-status>Menunggu</strong><span data-partner-detail>Belum ada pembaruan</span></article></div>
    <div class="couple-map-actions"><button type="button" class="primary" data-share>Bagikan lokasi langsung</button><button type="button" data-refresh>Perbarui sekali</button><button type="button" class="danger" data-stop hidden>Jeda berbagi</button></div>
    <div class="couple-map-privacy"><span>⌾</span><p><strong>Kendali tetap di tanganmu.</strong> Lokasi hanya terlihat oleh dua anggota dalam semesta ini. Kamu dapat menjeda berbagi kapan saja.</p></div>
  </div>`;
  document.body.append(sheet);
  sheet.querySelectorAll('[data-close]').forEach(node=>node.onclick=closeMap);
  sheet.querySelector('[data-share]').onclick=startSharing;
  sheet.querySelector('[data-refresh]').onclick=refreshOnce;
  sheet.querySelector('[data-stop]').onclick=stopSharing;
  sheet.querySelector('[data-focus]').onclick=focusBoth;
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen)closeMap();});
}

async function ensureStarted(){
  const next=context();
  if(!appReady()||!next.universeId||!next.userId){if(launcher)launcher.hidden=true;return;}
  ensureUI();launcher.hidden=false;
  const changed=activeUniverseId!==next.universeId||activeUserId!==next.userId;
  activeUniverseId=next.universeId;activeUserId=next.userId;partner=next.partner;
  if(changed){await disconnectChannel();locationRows=[];clearMapObjects();await subscribeRealtime();await loadLocations();}
  else if(!channel)await subscribeRealtime();
  updateUI();
}

async function ensureLeaflet(){
  if(window.L)return window.L;
  if(leafletPromise)return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-leaflet-runtime]')){const link=document.createElement('link');link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';link.dataset.leafletRuntime='1';document.head.append(link);}
    const existing=document.querySelector('script[data-leaflet-runtime]');
    if(existing){existing.addEventListener('load',()=>resolve(window.L),{once:true});existing.addEventListener('error',reject,{once:true});return;}
    const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.dataset.leafletRuntime='1';script.onload=()=>resolve(window.L);script.onerror=()=>reject(new Error('Leaflet gagal dimuat.'));document.head.append(script);
  });
  return leafletPromise;
}

async function initMap(){
  const L=await ensureLeaflet();
  if(map){setTimeout(()=>map.invalidateSize(),80);return;}
  map=L.map(sheet.querySelector('[data-map]'),{zoomControl:true,attributionControl:true,minZoom:2,maxZoom:20});
  satelliteLayer=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Tiles © Esri'}).addTo(map);
  streetLayer=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'});
  L.control.layers({'Satelit':satelliteLayer,'Jalan':streetLayer},null,{position:'topright',collapsed:true}).addTo(map);
  map.setView([-2.5,118],5);
}

async function openMap(){
  await ensureStarted();sheet.hidden=false;isOpen=true;document.body.classList.add('couple-life-open');
  try{await initMap();await loadLocations();renderMap();setTimeout(()=>map?.invalidateSize(),160);}catch(error){toast(error.message||'Peta gagal dimuat.',{type:'error'});}
}
function closeMap(){if(!sheet)return;sheet.hidden=true;isOpen=false;document.body.classList.remove('couple-life-open');}

async function subscribeRealtime(){
  if(!activeUniverseId)return;
  await disconnectChannel();
  channel=supabase().channel(`couple-live-location:${activeUniverseId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'couple_live_locations',filter:`universe_id=eq.${activeUniverseId}`},payload=>{
      const row=payload.new?.user_id?payload.new:payload.old;
      if(payload.eventType==='DELETE')locationRows=locationRows.filter(item=>item.user_id!==row.user_id);
      else locationRows=[...locationRows.filter(item=>item.user_id!==row.user_id),row];
      updateUI();if(isOpen)renderMap();
    })
    .subscribe();
}
async function disconnectChannel(){if(!channel)return;const old=channel;channel=null;try{await supabase().removeChannel(old);}catch{}}

async function loadLocations(){
  if(!activeUniverseId)return;
  try{
    const{data,error}=await supabase().from('couple_live_locations').select('*').eq('universe_id',activeUniverseId);
    if(error)throw error;locationRows=data||[];sharing=Boolean(myRow()?.sharing);updateSharingButtons();updateUI();if(isOpen)renderMap();
  }catch(error){console.warn(error);updateUI(true);}
}

async function startSharing(){
  if(!navigator.geolocation){toast('Perangkat ini tidak mendukung lokasi.',{type:'error'});return;}
  if(watchId!==null)return;
  const button=sheet.querySelector('[data-share]');button.disabled=true;button.textContent='Meminta izin lokasi…';
  watchId=navigator.geolocation.watchPosition(async position=>{
    sharing=true;updateSharingButtons();await publishPosition(position,true);
  },error=>{
    toast(locationError(error),{type:'error',duration:6500});
    if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}
    sharing=false;updateSharingButtons();
  },{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
}

async function refreshOnce(){
  if(!navigator.geolocation){toast('Perangkat ini tidak mendukung lokasi.',{type:'error'});return;}
  const button=sheet.querySelector('[data-refresh]');button.disabled=true;button.textContent='Mencari GPS…';
  navigator.geolocation.getCurrentPosition(async position=>{
    try{await publishPosition(position,false);toast('Lokasi berhasil diperbarui.',{type:'success'});}finally{button.disabled=false;button.textContent='Perbarui sekali';}
  },error=>{toast(locationError(error),{type:'error'});button.disabled=false;button.textContent='Perbarui sekali';},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
}

async function stopSharing(){
  if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}
  sharing=false;
  try{
    const{error}=await supabase().from('couple_live_locations').update({sharing:false,updated_at:new Date().toISOString()}).eq('universe_id',activeUniverseId).eq('user_id',activeUserId);
    if(error)throw error;
    const mine=myRow();if(mine)mine.sharing=false;
    updateSharingButtons();updateUI();renderMap();toast('Berbagi lokasi langsung dijeda.',{type:'success'});
  }catch(error){toast(friendlyError(error),{type:'error'});}
}

async function publishPosition(position,liveMode){
  const coords=position.coords;
  const now=Date.now();
  const next={latitude:coords.latitude,longitude:coords.longitude};
  if(liveMode&&now-lastSentAt<5000&&lastSentPosition&&distanceMeters(lastSentPosition,next)<12)return;
  const payload={universe_id:activeUniverseId,user_id:activeUserId,latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy??null,altitude:coords.altitude??null,heading:coords.heading??null,speed:coords.speed??null,sharing:liveMode,recorded_at:new Date(position.timestamp||now).toISOString(),updated_at:new Date().toISOString()};
  try{
    const{data,error}=await supabase().from('couple_live_locations').upsert(payload,{onConflict:'universe_id,user_id'}).select().single();
    if(error)throw error;
    lastSentAt=now;lastSentPosition=next;sharing=liveMode;locationRows=[...locationRows.filter(item=>item.user_id!==activeUserId),data];updateSharingButtons();updateUI();if(isOpen)renderMap();
  }catch(error){toast(friendlyError(error),{type:'error',duration:6500});}
}

function renderMap(){
  if(!map||!window.L)return;
  const L=window.L;
  const visible=locationRows.filter(row=>validRow(row));
  const keep=new Set(visible.map(row=>row.user_id));
  for(const[userId,marker]of markers){if(!keep.has(userId)){map.removeLayer(marker);markers.delete(userId);}}
  visible.forEach(row=>{
    const member=memberFor(row.user_id);const name=row.user_id===activeUserId?'Kamu':(member?.profile?.display_name||'Pasangan');
    const icon=L.divIcon({className:'couple-map-marker-wrap',html:`<div class="couple-map-marker ${row.user_id===activeUserId?'is-me':'is-partner'}"><span>${escapeHtml(initials(name))}</span><i></i></div><b>${escapeHtml(name)}</b>`,iconSize:[58,70],iconAnchor:[29,60]});
    let marker=markers.get(row.user_id);
    if(!marker){marker=L.marker([row.latitude,row.longitude],{icon}).addTo(map);markers.set(row.user_id,marker);}else{marker.setLatLng([row.latitude,row.longitude]);marker.setIcon(icon);}
    marker.bindPopup(`<strong>${escapeHtml(name)}</strong><br>${row.sharing?'Lokasi langsung aktif':'Pembaruan terakhir'}<br>${escapeHtml(relativeTime(row.recorded_at))}`);
  });
  const mine=myRow();
  if(accuracyCircle){map.removeLayer(accuracyCircle);accuracyCircle=null;}
  if(validRow(mine)&&Number(mine.accuracy)>0)accuracyCircle=L.circle([mine.latitude,mine.longitude],{radius:Number(mine.accuracy),className:'couple-map-accuracy',interactive:false}).addTo(map);
  if(line){map.removeLayer(line);line=null;}if(lineGlow){map.removeLayer(lineGlow);lineGlow=null;}
  const theirs=partnerRow();
  if(validRow(mine)&&validRow(theirs)){
    const points=[[mine.latitude,mine.longitude],[theirs.latitude,theirs.longitude]];
    lineGlow=L.polyline(points,{color:'#ffffff',weight:10,opacity:.75,dashArray:'1 0',interactive:false}).addTo(map);
    line=L.polyline(points,{color:'#ff315f',weight:5,opacity:1,dashArray:'10 9',lineCap:'round',interactive:false}).addTo(map);
  }
  sheet.querySelector('[data-map-state]').textContent=visible.length===2?'Dua lokasi terhubung':visible.length===1?'Satu lokasi tersedia':'Belum ada lokasi';
}

function focusBoth(){
  if(!map)return;
  const rows=locationRows.filter(row=>validRow(row));
  if(rows.length>=2){map.fitBounds(rows.map(row=>[row.latitude,row.longitude]),{padding:[55,55],maxZoom:17,animate:true});}
  else if(rows.length===1){map.setView([rows[0].latitude,rows[0].longitude],17,{animate:true});}
}

function updateUI(databaseError=false){
  if(!sheet||!launcher)return;
  const mine=myRow();const theirs=partnerRow();
  const distance=validRow(mine)&&validRow(theirs)?distanceMeters(mine,theirs):null;
  sheet.querySelector('[data-distance]').textContent=distance===null?'—':formatDistance(distance);
  sheet.querySelector('[data-distance-note]').textContent=distance===null?'Butuh lokasi kalian berdua':'Garis merah menunjukkan jarak lurus';
  sheet.querySelector('[data-me-status]').textContent=validRow(mine)?(mine.sharing?'Live aktif':'Tersimpan'):'Belum dibagikan';
  sheet.querySelector('[data-me-detail]').textContent=validRow(mine)?`${relativeTime(mine.recorded_at)}${mine.accuracy?` · akurasi ±${Math.round(mine.accuracy)} m`:''}`:'Aktifkan GPS untuk mulai';
  sheet.querySelector('[data-partner-status]').textContent=validRow(theirs)?(theirs.sharing?'Live aktif':'Lokasi terakhir'):(partner?'Menunggu lokasi':'Pasangan belum bergabung');
  sheet.querySelector('[data-partner-detail]').textContent=validRow(theirs)?relativeTime(theirs.recorded_at):'Belum ada pembaruan';
  launcher.querySelector('[data-map-launcher-status]').textContent=distance===null?'Peta berdua':formatDistance(distance);
  launcher.classList.toggle('has-live',Boolean(validRow(mine)&&mine.sharing&&validRow(theirs)&&theirs.sharing));
  if(databaseError)sheet.querySelector('[data-map-state]').textContent='Jalankan SQL v4.4.1';
  updateSharingButtons();
}

function updateSharingButtons(){
  if(!sheet)return;
  const share=sheet.querySelector('[data-share]');const stop=sheet.querySelector('[data-stop]');
  share.hidden=watchId!==null;share.disabled=false;share.textContent='Bagikan lokasi langsung';stop.hidden=watchId===null&&!sharing;
}
function clearMapObjects(){markers.clear();if(map){map.remove();map=null;}line=null;lineGlow=null;accuracyCircle=null;}
function myRow(){return locationRows.find(row=>row.user_id===activeUserId)||null;}
function partnerRow(){return partner?locationRows.find(row=>row.user_id===partner.user_id)||null:null;}
function memberFor(userId){return(state.snapshot.members||[]).find(member=>member.user_id===userId)||null;}
function validRow(row){return Boolean(row&&Number.isFinite(Number(row.latitude))&&Number.isFinite(Number(row.longitude)));}
function distanceMeters(a,b){const R=6371000;const lat1=Number(a.latitude)*Math.PI/180;const lat2=Number(b.latitude)*Math.PI/180;const dLat=(Number(b.latitude)-Number(a.latitude))*Math.PI/180;const dLon=(Number(b.longitude)-Number(a.longitude))*Math.PI/180;const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
function formatDistance(value){return value<1000?`${Math.round(value)} m`:`${(value/1000).toFixed(value<10000?2:1)} km`;}
function relativeTime(value){if(!value)return'Waktu tidak diketahui';const delta=Date.now()-new Date(value).getTime();if(delta<60000)return'baru saja';if(delta<3600000)return`${Math.floor(delta/60000)} menit lalu`;if(delta<86400000)return`${Math.floor(delta/3600000)} jam lalu`;return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
function locationError(error){if(error?.code===1)return'Izin lokasi ditolak. Aktifkan izin lokasi untuk browser ini.';if(error?.code===2)return'Sinyal GPS belum tersedia. Coba berada di area yang lebih terbuka.';if(error?.code===3)return'Pencarian lokasi terlalu lama. Coba lagi.';return'Lokasi belum dapat dibaca.';}
function friendlyError(error){const message=String(error?.message||error||'');if(message.includes('couple_live_locations')||message.includes('schema cache'))return'Peta lokasi belum aktif di database. Jalankan migrasi SQL v4.4.1.';return message||'Lokasi belum dapat disimpan.';}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}

events.on('presence:sync',()=>updateUI());
events.on('state:change',event=>{if(['user','universe','members'].includes(event.detail?.key))scheduleStart(90);});
events.on('realtime:change',event=>{if(['universe_members','profiles'].includes(event.detail?.table))scheduleStart(320);});
window.addEventListener('our-universe:context-ready',()=>scheduleStart(0));
window.addEventListener('our-universe:context-cleared',()=>{clearTimeout(startupTimer);closeMap();activeUniverseId='';activeUserId='';partner=null;locationRows=[];if(watchId!==null)navigator.geolocation?.clearWatch(watchId);watchId=null;sharing=false;void disconnectChannel();clearMapObjects();if(launcher)launcher.hidden=true;});
window.addEventListener('online',()=>scheduleStart(250));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleStart(180);});
window.addEventListener('pagehide',()=>{clearTimeout(startupTimer);disconnectChannel();if(watchId!==null)navigator.geolocation?.clearWatch(watchId);});
scheduleStart(0);
