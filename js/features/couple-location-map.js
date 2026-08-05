import { supabase } from '../core/supabase.js';
import { state } from '../core/state.js';
import { events } from '../core/event-bus.js';
import { toast } from '../components/toast.js';

const LEAFLET_CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LOCATION_TTL_MS=120000;
const MIN_SEND_INTERVAL_MS=10000;
const MIN_SEND_DISTANCE_M=12;

let launcher=null;
let sheet=null;
let mapHost=null;
let distanceHost=null;
let statusHost=null;
let shareToggle=null;
let channel=null;
let map=null;
let line=null;
let watcherId=null;
let activeUniverseId='';
let activeUserId='';
let partnerId='';
let isOpen=false;
let sharing=false;
let leafletPromise=null;
let lastSentAt=0;
let lastSentPoint=null;
const locations=new Map();
const markers=new Map();

function context(){
  const snapshot=state.snapshot;
  const universeId=snapshot.universe?.id||'';
  const userId=snapshot.user?.id||'';
  const partner=(snapshot.members||[]).find(member=>member.user_id!==userId)||null;
  return{snapshot,universeId,userId,partner};
}

function appReady(){
  const shell=document.querySelector('#app-shell');
  return Boolean(shell&&!shell.hidden);
}

function ensureUI(){
  if(launcher)return;

  launcher=document.createElement('button');
  launcher.type='button';
  launcher.className='couple-map-launcher';
  launcher.hidden=true;
  launcher.setAttribute('aria-label','Buka peta jarak pasangan');
  launcher.setAttribute('title','Jarak pasangan');
  launcher.setAttribute('data-capture-ignore','true');
  launcher.innerHTML='<span aria-hidden="true">⌖</span><i data-map-live></i>';
  launcher.addEventListener('click',openMap);
  document.body.append(launcher);

  sheet=document.createElement('section');
  sheet.className='couple-map-sheet';
  sheet.hidden=true;
  sheet.setAttribute('data-capture-ignore','true');
  sheet.innerHTML=`
    <div class="couple-map-panel" role="dialog" aria-modal="true" aria-labelledby="couple-map-title">
      <header class="couple-tool-header">
        <div>
          <small>PETA KALIAN</small>
          <strong id="couple-map-title">Jarak real-time</strong>
        </div>
        <button type="button" class="couple-tool-close" data-close-map aria-label="Tutup peta">×</button>
      </header>
      <div class="couple-map-distance">
        <span data-map-distance>Menunggu dua lokasi</span>
        <small data-map-status>Aktifkan berbagi lokasi untuk mulai</small>
      </div>
      <div class="couple-map-canvas" data-map-canvas>
        <div class="couple-map-loading">Menyiapkan peta...</div>
      </div>
      <div class="couple-map-actions">
        <label class="couple-tool-switch">
          <input type="checkbox" data-share-location>
          <span>Bagikan lokasiku</span>
        </label>
        <button type="button" class="couple-tool-button" data-focus-both>Fokus berdua</button>
      </div>
      <p class="couple-tool-note">Lokasi hanya terlihat oleh anggota semesta ini. Lokasi berhenti terlihat sekitar 2 menit setelah aplikasi ditutup.</p>
    </div>`;

  mapHost=sheet.querySelector('[data-map-canvas]');
  distanceHost=sheet.querySelector('[data-map-distance]');
  statusHost=sheet.querySelector('[data-map-status]');
  shareToggle=sheet.querySelector('[data-share-location]');
  sheet.querySelector('[data-close-map]').addEventListener('click',closeMap);
  sheet.querySelector('[data-focus-both]').addEventListener('click',focusBoth);
  shareToggle.addEventListener('change',()=>{
    if(shareToggle.checked)startSharing();
    else stopSharing({remove:true});
  });
  sheet.addEventListener('click',event=>{
    if(event.target===sheet)closeMap();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&isOpen)closeMap();
  });
  window.addEventListener('our-universe:overlay-open',event=>{
    if(event.detail?.source!=='couple-map'&&isOpen)closeMap();
  });
  document.body.append(sheet);
}

async function ensureStarted(){
  const next=context();
  if(!appReady()||!next.universeId||!next.userId){
    if(launcher)launcher.hidden=true;
    if(isOpen)closeMap();
    if(watcherId!==null)stopSharing({remove:false});
    return;
  }

  ensureUI();
  launcher.hidden=false;
  const changed=activeUniverseId!==next.universeId||activeUserId!==next.userId;
  activeUniverseId=next.universeId;
  activeUserId=next.userId;
  partnerId=next.partner?.user_id||'';

  if(changed){
    locations.clear();
    clearMapLayers();
    await disconnectRealtime();
    await subscribeRealtime();
    await loadLocations();
  }
  renderStatus();
}

async function openMap(){
  await ensureStarted();
  if(!sheet)return;
  window.dispatchEvent(new CustomEvent('our-universe:overlay-open',{detail:{source:'couple-map'}}));
  sheet.hidden=false;
  isOpen=true;
  await ensureMap();
  await loadLocations();
  renderMap();
  setTimeout(()=>map?.invalidateSize?.(),120);
}

function closeMap(){
  if(!sheet)return;
  sheet.hidden=true;
  isOpen=false;
}

async function loadLeaflet(){
  if(window.L)return window.L;
  if(leafletPromise)return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector(`link[href="${LEAFLET_CSS}"]`)){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href=LEAFLET_CSS;
      link.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin='';
      document.head.append(link);
    }
    const existing=document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if(existing){
      existing.addEventListener('load',()=>resolve(window.L),{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=LEAFLET_JS;
    script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin='';
    script.onload=()=>resolve(window.L);
    script.onerror=()=>reject(new Error('Pustaka peta gagal dimuat.'));
    document.head.append(script);
  });
  return leafletPromise;
}

async function ensureMap(){
  if(map||!mapHost)return;
  try{
    const L=await loadLeaflet();
    if(!L)throw new Error('Leaflet tidak tersedia.');
    mapHost.innerHTML='';
    map=L.map(mapHost,{zoomControl:true,attributionControl:true}).setView([-2.3,118],4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'&copy; OpenStreetMap'
    }).addTo(map);
    renderMap();
  }catch(error){
    console.warn(error);
    mapHost.innerHTML='<div class="couple-map-loading">Peta belum dapat dimuat. Pastikan koneksi internet aktif. Data jarak tetap akan dihitung.</div>';
  }
}

function markerIcon(label,mine){
  const L=window.L;
  return L.divIcon({
    className:'couple-map-marker-wrap',
    html:`<span class="couple-map-marker${mine?' is-me':''}">${escapeHtml(label.slice(0,1).toUpperCase()||'♡')}</span>`,
    iconSize:[38,38],
    iconAnchor:[19,19]
  });
}

function renderMap(){
  renderStatus();
  if(!map||!window.L)return;
  const active=[...locations.values()].filter(isFresh);
  const keep=new Set(active.map(item=>item.user_id));
  for(const [userId,marker] of markers){
    if(!keep.has(userId)){
      marker.remove();
      markers.delete(userId);
    }
  }

  const ctx=context();
  for(const item of active){
    const mine=item.user_id===activeUserId;
    const member=(ctx.snapshot.members||[]).find(row=>row.user_id===item.user_id);
    const name=mine?'Kamu':(member?.profile?.display_name||'Pasangan');
    const point=[Number(item.latitude),Number(item.longitude)];
    let marker=markers.get(item.user_id);
    if(!marker){
      marker=window.L.marker(point,{icon:markerIcon(name,mine)}).addTo(map);
      markers.set(item.user_id,marker);
    }else marker.setLatLng(point);
    marker.bindPopup(`<strong>${escapeHtml(name)}</strong><br><small>Akurasi sekitar ${Math.round(Number(item.accuracy_m||0))} m</small>`);
  }

  if(line){line.remove();line=null;}
  const mine=locations.get(activeUserId);
  const theirs=locations.get(partnerId);
  if(isFresh(mine)&&isFresh(theirs)){
    line=window.L.polyline([
      [Number(mine.latitude),Number(mine.longitude)],
      [Number(theirs.latitude),Number(theirs.longitude)]
    ],{weight:3,dashArray:'8 9',opacity:.85}).addTo(map);
  }
}

function renderStatus(){
  if(!launcher)return;
  pruneExpired();
  const mine=locations.get(activeUserId);
  const theirs=locations.get(partnerId);
  const both=isFresh(mine)&&isFresh(theirs);
  launcher.classList.toggle('is-live',both);
  launcher.querySelector('[data-map-live]')?.classList.toggle('is-live',both);

  if(both){
    const meters=haversine(mine,theirs);
    if(distanceHost)distanceHost.textContent=formatDistance(meters);
    if(statusHost)statusHost.textContent='Jarak garis lurus berdasarkan lokasi terbaru kalian';
  }else if(isFresh(mine)){
    if(distanceHost)distanceHost.textContent='Lokasimu sudah aktif';
    if(statusHost)statusHost.textContent='Menunggu pasangan membagikan lokasi';
  }else if(isFresh(theirs)){
    if(distanceHost)distanceHost.textContent='Lokasi pasangan tersedia';
    if(statusHost)statusHost.textContent='Aktifkan lokasimu untuk menghitung jarak';
  }else{
    if(distanceHost)distanceHost.textContent='Menunggu dua lokasi';
    if(statusHost)statusHost.textContent='Aktifkan berbagi lokasi untuk mulai';
  }
}

function focusBoth(){
  if(!map||!window.L)return;
  const points=[...locations.values()].filter(isFresh).map(item=>[Number(item.latitude),Number(item.longitude)]);
  if(points.length>=2)map.fitBounds(window.L.latLngBounds(points).pad(.25),{maxZoom:16});
  else if(points.length===1)map.setView(points[0],16);
  else toast('Belum ada lokasi aktif.',{type:'info'});
}

async function startSharing(){
  if(sharing)return;
  if(!navigator.geolocation){
    shareToggle.checked=false;
    toast('Perangkat ini tidak mendukung lokasi browser.',{type:'error'});
    return;
  }
  sharing=true;
  launcher?.classList.add('is-sharing');
  statusHost.textContent='Meminta izin lokasi...';
  watcherId=navigator.geolocation.watchPosition(handlePosition,handleGeoError,{
    enableHighAccuracy:true,
    maximumAge:12000,
    timeout:25000
  });
}

async function stopSharing({remove=false}={}){
  sharing=false;
  launcher?.classList.remove('is-sharing');
  if(watcherId!==null){
    navigator.geolocation?.clearWatch?.(watcherId);
    watcherId=null;
  }
  if(shareToggle)shareToggle.checked=false;
  if(remove&&activeUniverseId&&activeUserId){
    locations.delete(activeUserId);
    renderMap();
    try{
      await supabase().from('couple_locations').delete().eq('universe_id',activeUniverseId).eq('user_id',activeUserId);
    }catch(error){console.warn(error);}
  }
}

async function handlePosition(position){
  if(!sharing||!activeUniverseId||!activeUserId)return;
  const point={
    latitude:Number(position.coords.latitude),
    longitude:Number(position.coords.longitude),
    accuracy_m:Number(position.coords.accuracy||0)
  };
  const elapsed=Date.now()-lastSentAt;
  const moved=lastSentPoint?haversine(lastSentPoint,point):Infinity;
  if(elapsed<MIN_SEND_INTERVAL_MS&&moved<MIN_SEND_DISTANCE_M)return;
  lastSentAt=Date.now();
  lastSentPoint=point;
  const row={
    universe_id:activeUniverseId,
    user_id:activeUserId,
    latitude:point.latitude,
    longitude:point.longitude,
    accuracy_m:point.accuracy_m,
    heading:Number.isFinite(position.coords.heading)?Number(position.coords.heading):null,
    speed_mps:Number.isFinite(position.coords.speed)?Number(position.coords.speed):null,
    updated_at:new Date().toISOString(),
    expires_at:new Date(Date.now()+LOCATION_TTL_MS).toISOString()
  };
  locations.set(activeUserId,row);
  renderMap();
  if(isOpen)focusBoth();
  const{error}=await supabase().from('couple_locations').upsert(row,{onConflict:'universe_id,user_id'});
  if(error){
    console.warn(error);
    if(String(error.message||'').includes('couple_locations')){
      toast('Database peta belum aktif. Jalankan migrasi SQL v4.4.',{type:'error',duration:6000});
      stopSharing({remove:false});
    }
  }
}

function handleGeoError(error){
  console.warn(error);
  const messages={
    1:'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini.',
    2:'Lokasi belum tersedia. Coba aktifkan GPS.',
    3:'Pencarian lokasi terlalu lama. Coba lagi.'
  };
  toast(messages[error?.code]||'Lokasi belum dapat dibaca.',{type:'error',duration:6000});
  stopSharing({remove:false});
}

async function loadLocations(){
  if(!activeUniverseId)return;
  const{data,error}=await supabase().from('couple_locations').select('*').eq('universe_id',activeUniverseId).gt('expires_at',new Date().toISOString());
  if(error){
    const missing=String(error.message||'').includes('couple_locations');
    if(missing&&statusHost)statusHost.textContent='Database peta belum aktif. Jalankan migrasi SQL v4.4.';
    else console.warn(error);
    return;
  }
  locations.clear();
  for(const row of data||[])locations.set(row.user_id,row);
  renderMap();
}

async function subscribeRealtime(){
  if(!activeUniverseId)return;
  channel=supabase().channel(`couple-map:${activeUniverseId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'couple_locations',filter:`universe_id=eq.${activeUniverseId}`},payload=>{
      const row=payload.new||payload.old;
      if(!row?.user_id)return;
      if(payload.eventType==='DELETE')locations.delete(row.user_id);
      else locations.set(row.user_id,row);
      renderMap();
      if(isOpen&&map)setTimeout(focusBoth,80);
    })
    .subscribe();
}

async function disconnectRealtime(){
  if(!channel)return;
  const old=channel;
  channel=null;
  try{await supabase().removeChannel(old);}catch{}
}

function clearMapLayers(){
  for(const marker of markers.values())marker.remove?.();
  markers.clear();
  line?.remove?.();
  line=null;
}

function pruneExpired(){
  const now=Date.now();
  for(const [userId,row] of locations){
    if(new Date(row.expires_at||0).getTime()<=now)locations.delete(userId);
  }
}

function isFresh(row){
  return Boolean(row&&Number.isFinite(Number(row.latitude))&&Number.isFinite(Number(row.longitude))&&new Date(row.expires_at||0).getTime()>Date.now());
}

function haversine(a,b){
  const lat1=Number(a.latitude);
  const lon1=Number(a.longitude);
  const lat2=Number(b.latitude);
  const lon2=Number(b.longitude);
  const toRad=value=>value*Math.PI/180;
  const dLat=toRad(lat2-lat1);
  const dLon=toRad(lon2-lon1);
  const x=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function formatDistance(meters){
  if(meters<1000)return`${Math.max(0,Math.round(meters))} meter`;
  if(meters<10000)return`${(meters/1000).toFixed(2)} km`;
  return`${(meters/1000).toFixed(1)} km`;
}

function escapeHtml(value=''){
  return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

events.on('presence:sync',()=>renderStatus());
events.on('realtime:change',event=>{
  if(['universe_members','profiles'].includes(event.detail?.table))setTimeout(()=>ensureStarted(),300);
});
window.addEventListener('pagehide',()=>{
  if(watcherId!==null)navigator.geolocation?.clearWatch?.(watcherId);
  disconnectRealtime();
});

setInterval(()=>ensureStarted().catch(error=>console.warn('Peta pasangan menunggu konteks:',error)),1200);
setInterval(()=>renderMap(),15000);
ensureStarted().catch(()=>{});
