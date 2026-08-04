import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/index.js';
import { CONFIG, WORLD_CARDS } from './config.js';
import { qs, qsa, initials, debounce } from './core/utils.js';
import { state } from './core/state.js';
import { events } from './core/event-bus.js';
import { router } from './core/router.js';
import { auth } from './core/auth.js';
import { isSupabaseConfigured } from './core/supabase.js';
import { repository } from './core/repository.js';
import { realtime } from './core/realtime.js';
import { audioEngine } from './core/audio-engine.js';
import { registerPWA } from './core/pwa.js';
import { getPerformanceProfile } from './core/performance.js';
import { signedUrl } from './core/storage.js';
import { GalaxyEngine } from './universe/galaxy-engine.js';
import { calculateGrowth, renderGrowthMeter } from './universe/growth-engine.js';
import { EasterEggs } from './universe/easter-eggs.js';
import { createOrbitCard } from './components/glass-card.js';
import { openTypePicker, openComposer } from './components/composer.js';
import { openProfileMenu } from './components/profile-menu.js';
import { openModal } from './components/modal.js';
import { toast } from './components/toast.js';
import { renderConfigurationGate, renderAuthGate, renderOnboarding } from './components/auth-gate.js';

document.documentElement.dataset.ourUniverseBooted='true';
window.dispatchEvent(new Event('our-universe:booted'));

const worldLoaders={
  orbits:()=>import('./worlds/memory-orbits.js').then(m=>m.renderMemoryOrbits),
  memories:()=>import('./worlds/memories.js').then(m=>m.renderMemories),
  gallery:()=>import('./worlds/gallery.js').then(m=>m.renderGallery),
  letters:()=>import('./worlds/letters.js').then(m=>m.renderLetters),
  notes:()=>import('./worlds/notes.js').then(m=>m.renderNotes),
  wishes:()=>import('./worlds/wishes.js').then(m=>m.renderWishes),
  music:()=>import('./worlds/music.js').then(m=>m.renderMusic),
  timeline:()=>import('./worlds/timeline.js').then(m=>m.renderTimeline),
  'sky-tonight':()=>import('./worlds/sky-tonight.js').then(m=>m.renderSkyTonight),
  'time-capsules':()=>import('./worlds/time-capsules.js').then(m=>m.renderTimeCapsules),
  files:()=>import('./worlds/files.js').then(m=>m.renderFiles),
  search:()=>import('./worlds/search.js').then(m=>m.renderSearch),
  activity:()=>import('./worlds/activity.js').then(m=>m.renderActivity),
  settings:()=>import('./worlds/settings.js').then(m=>m.renderSettings),
  studio:()=>import('./worlds/studio.js').then(m=>m.renderStudio),
  'about-us':()=>import('./worlds/about-us.js').then(m=>m.renderAboutUs)
};

let galaxy;let routeStarted=false;let orbitFrame;let orbitLast=0;let authUnsubscribe;let accessReady=false;
let orbitRotation=0;let orbitVelocity=.000034;let orbitDragging=false;let orbitDragX=0;let orbitMoved=false;let orbitSuppressClickUntil=0;let orbitMeta=[];
const performanceProfile=getPerformanceProfile();

async function init(){
  document.title=CONFIG.APP_NAME;
  const soundEnabled=localStorage.getItem('our-universe-sound')==='on';audioEngine.configure({ambientElement:qs('#ambient-audio'),volume:.22,enabled:soundEnabled});
  galaxy=new GalaxyEngine(qs('#universe-canvas'),performanceProfile);
  setupCards();setupControls();setupEvents();
  new EasterEggs({galaxyEngine:galaxy,canvas:qs('#universe-canvas'),initials:'♡'});
  if(CONFIG.ENABLE_PWA)registerPWA();
  await openingExperience();
}

function setupCards(){
  const host=qs('#orbit-cards');
  const cards=WORLD_CARDS.map((card,index)=>createOrbitCard(card,route=>{
    if(performance.now()<orbitSuppressClickUntil)return;
    router.navigate(route);
  }));
  host.replaceChildren(...cards);
  orbitMeta=cards.map((card,index)=>({
    card,
    base:index/cards.length*Math.PI*2,
    phase:(index*1.618)%Math.PI*2,
    radial:.88+((index*37)%17)/100,
    yRange:22+((index*29)%38),
    tilt:-3+((index*11)%7),
    wobble:.00018+((index%5)*.000018)
  }));
  bindOrbitGestures(host);
  animateOrbitCards();
}

function bindOrbitGestures(host){
  host.addEventListener('pointerdown',event=>{
    orbitDragging=true;orbitMoved=false;orbitDragX=event.clientX;
    host.setPointerCapture?.(event.pointerId);
  });
  host.addEventListener('pointermove',event=>{
    if(!orbitDragging)return;
    const delta=event.clientX-orbitDragX;orbitDragX=event.clientX;
    if(Math.abs(delta)>2)orbitMoved=true;
    orbitRotation+=delta*.0065;
    orbitVelocity=delta*.000008;
  });
  const release=event=>{
    if(!orbitDragging)return;
    orbitDragging=false;
    if(orbitMoved)orbitSuppressClickUntil=performance.now()+260;
    host.releasePointerCapture?.(event.pointerId);
  };
  host.addEventListener('pointerup',release);
  host.addEventListener('pointercancel',release);
  host.addEventListener('wheel',event=>{
    if(Math.abs(event.deltaX)>Math.abs(event.deltaY)){
      orbitRotation+=event.deltaX*.0018;event.preventDefault();
    }
  },{passive:false});
}

function animateOrbitCards(){
  cancelAnimationFrame(orbitFrame);
  const render=now=>{
    orbitFrame=requestAnimationFrame(render);
    if(now-orbitLast<1000/Math.min(45,performanceProfile.fps))return;
    const dt=Math.min(48,now-orbitLast||16);orbitLast=now;
    if(!orbitDragging){orbitRotation+=dt*orbitVelocity;orbitVelocity+=(.000034-orbitVelocity)*.012;}
    const host=qs('#orbit-cards');if(!host||host.hidden)return;
    const rect=host.getBoundingClientRect();const mobile=innerWidth<700;
    const cx=rect.width/2;const cy=rect.height*(mobile?.51:.52);
    const rx=Math.max(mobile?142:260,Math.min(rect.width*(mobile?.39:.40),520));
    const ry=Math.max(mobile?170:210,Math.min(rect.height*(mobile?.25:.29),315));
    orbitMeta.forEach((meta,index)=>{
      const angle=orbitRotation+meta.base+Math.sin(now*meta.wobble+meta.phase)*.055;
      const depth=(Math.cos(angle)+1)/2;
      const depthSigned=Math.cos(angle);
      const x=cx+Math.sin(angle)*rx*meta.radial;
      const y=cy+Math.sin(angle*1.43+meta.phase)*meta.yRange+Math.sin(angle*.58+meta.phase)*ry*.26;
      const scale=(mobile?.60:.64)+depth*(mobile?.43:.48);
      const opacity=.28+depth*.72;
      const blur=(1-depth)*2.4;
      const rotate=meta.tilt+Math.sin(now*.0005+meta.phase)*2.2;
      meta.card.style.left=`${x}px`;
      meta.card.style.top=`${y}px`;
      meta.card.style.zIndex=String(depthSigned>0?20+Math.round(depth*18):7+Math.round(depth*8));
      meta.card.style.transform=`translate(-50%,-50%) scale(${scale}) rotate(${rotate}deg)`;
      meta.card.style.opacity=String(opacity);
      meta.card.style.filter=`blur(${blur.toFixed(2)}px) saturate(${(.72+depth*.38).toFixed(2)})`;
      meta.card.style.setProperty('--border-angle',`${(now*.012+index*23)%360}deg`);
      meta.card.dataset.depth=depthSigned>.12?'front':depthSigned<-.18?'back':'side';
      meta.card.setAttribute('aria-hidden',depth<.16?'true':'false');
    });
  };
  orbitFrame=requestAnimationFrame(render);
}

function setupControls(){
  qs('#home-button').onclick=()=>router.navigate('home');
  qs('#global-search').onclick=()=>router.navigate('search');
  qs('#studio-fab').onclick=()=>openTypePicker({onChoose:type=>openComposer({type,onSaved:handleDataChanged})});
  document.addEventListener('click',event=>{if(event.target.closest('[data-open-composer]'))openTypePicker({onChoose:type=>openComposer({type,onSaved:handleDataChanged})});});
  qs('#profile-button').onclick=()=>openProfileMenu({onRefresh:refreshContext,onNavigate:route=>router.navigate(route),onSignOut:showAccessGate});
  const soundToggle=qs('#sound-toggle');soundToggle.textContent=audioEngine.enabled?'◉':'○';soundToggle.onclick=async event=>{await audioEngine.setEnabled(!audioEngine.enabled);localStorage.setItem('our-universe-sound',audioEngine.enabled?'on':'off');event.currentTarget.textContent=audioEngine.enabled?'◉':'○';toast(audioEngine.enabled?'Suara latar dinyalakan manual.':'Suara latar dimatikan.');};
  qs('#skip-intro').onclick=()=>completeIntro(true);
  qs('#enter-universe').onclick=async()=>{const button=qs('#enter-universe');button.disabled=true;await galaxy.enterUniverse();completeIntro(false);};
}

function setupEvents(){
  events.on('route:change',event=>{if(accessReady)renderRoute(event.detail.route);});
  events.on('data:changed',handleDataChanged);
  const refreshRealtime=debounce(async()=>{if(!accessReady)return;await updateGrowth();const route=state.get('route');if(route&&route!=='home')renderRoute(route);},450);
  const refreshContextRealtime=debounce(()=>refreshContext(),650);
  events.on('realtime:change',event=>{
    if(['universe_members','profiles'].includes(event.detail.table)) refreshContextRealtime();
    else refreshRealtime();
  });
  events.on('presence:sync',event=>{state.set('presence',event.detail.state||{});renderMembers();});
  events.on('secret:menu',()=>{const content=document.createElement('div');content.innerHTML='<p class="muted">Semesta merespons pola yang tidak biasa.</p><div class="toolbar"><button class="button button--ghost" data-meteor>Hujan meteor</button><button class="button button--ghost" data-studio>Studio rahasia</button><button class="button button--ghost" data-about>Tentang kalian</button></div>';const modal=openModal({title:'Ruang di balik bintang',content});content.querySelector('[data-meteor]').onclick=()=>galaxy.meteorShower(88);content.querySelector('[data-studio]').onclick=()=>{modal.close();router.navigate('studio');};content.querySelector('[data-about]').onclick=()=>{modal.close();router.navigate('about-us');};});
}

async function openingExperience(){
  qs('#intro-quote').textContent=CONFIG.INTRO_QUOTE;
  await galaxy.playOpening(()=>{gsap.to('#intro-kicker',{opacity:1,duration:1.2});gsap.to('#intro-quote',{opacity:1,duration:1.8});},()=>gsap.to('#enter-universe',{opacity:1,y:0,duration:1.1}));
}

function completeIntro(skipped){if(state.get('introComplete'))return;state.set('introComplete',true);if(skipped){galaxy.mode='hub';galaxy.camera.position.set(0,5,28);}qs('#intro').classList.add('is-leaving');setTimeout(()=>{qs('#intro').hidden=true;showAccessGate();},500);}

async function showAccessGate(){
  accessReady=false;qs('#app-shell').hidden=true;const root=qs('#auth-root');root.hidden=false;
  if(!isSupabaseConfigured()){renderConfigurationGate(root,()=>showAccessGate());return;}
  if(!authUnsubscribe)authUnsubscribe=auth.onChange((event)=>{if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))refreshContext();if(event==='SIGNED_OUT'){realtime.disconnect();showAccessGate();}});
  try{const context=await auth.context();if(!context.session){renderAuthGate(root,{onAuthenticated:refreshContext});return;}if(!context.membership){renderOnboarding(root,context,{onComplete:refreshContext,onSignOut:async()=>{await auth.signOut();showAccessGate();}});return;}await activateUniverse(context);}catch(error){renderAuthGate(root,{onAuthenticated:refreshContext});toast(error.message,{type:'error',duration:6500});}
}

async function refreshContext(){try{const context=await auth.context();if(!context.session||!context.membership){showAccessGate();return;}await activateUniverse(context);}catch(error){toast(error.message,{type:'error'});}}

async function activateUniverse(context){
  state.patch(context);repository.setContext({universeId:context.universe.id,userId:context.user.id});document.documentElement.dataset.theme=context.universe.settings?.theme||'violet';document.documentElement.dataset.spaceTheme=context.universe.settings?.space_theme||'milky-way';galaxy.setTheme(context.universe.settings?.space_theme||'milky-way');
  qs('#auth-root').hidden=true;qs('#auth-root').innerHTML='';qs('#app-shell').hidden=false;accessReady=true;
  qs('#hub-title').textContent=context.universe.name||'Semesta yang tumbuh bersama.';qs('#hub-subtitle').textContent=context.members.length<2?'Semesta sudah hidup. Sekarang undang pasangan untuk membangunnya bersama.':'Setiap kenangan yang kalian tambahkan akan membuat semesta ini semakin terang.';
  await realtime.connect({universeId:context.universe.id,user:context.user,profile:context.profile});renderMembers();await updateGrowth();
  if(!routeStarted){router.start();routeStarted=true;}else renderRoute(state.get('route')||'home');
}

async function renderMembers(){const host=qs('#member-presence');host.innerHTML='';const presence=state.get('presence')||{};for(const member of state.get('members')||[]){const node=document.createElement('span');node.className='presence-avatar';node.title=member.profile?.display_name||'Anggota';node.textContent=initials(member.profile?.display_name);if(member.profile?.avatar_path)signedUrl(member.profile.avatar_path).then(url=>{const img=document.createElement('img');img.src=url;img.alt='';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%';node.textContent='';node.append(img);}).catch(()=>{});const dot=document.createElement('span');dot.className=`status-dot${presence[member.user_id]?.length?' is-online':''}`;node.append(dot);host.append(node);}const profileButton=qs('#profile-button');profileButton.innerHTML='';const profile=state.get('profile');if(profile?.avatar_path){try{const img=document.createElement('img');img.src=await signedUrl(profile.avatar_path);img.alt='';profileButton.append(img);}catch{profileButton.textContent=initials(profile?.display_name);}}else profileButton.textContent=initials(profile?.display_name);}

async function updateGrowth(){try{const stats=await repository.stats();const growth=calculateGrowth(stats);state.set('universeLevel',growth.level);galaxy.setGrowth(growth.level);renderGrowthMeter(qs('#growth-meter'),growth);qs('#empty-universe-hint').hidden=growth.entries>0;}catch(error){console.warn('Growth gagal diperbarui',error);}}
async function handleDataChanged(){await updateGrowth();const route=state.get('route');if(route&&route!=='home')renderRoute(route);}

async function renderRoute(route){const hub=qs('#galaxy-hub');const stage=qs('#world-stage');if(route==='home'){stage.hidden=true;hub.hidden=false;return;}hub.hidden=true;stage.hidden=false;stage.classList.add('is-loading');stage.innerHTML='';try{const renderer=await worldLoaders[route]?.();if(!renderer){router.navigate('home',true);return;}await renderer(stage);}catch(error){stage.innerHTML=`<section class="world-panel glass-panel"><h2>Bagian ini belum dapat dibuka.</h2><p class="muted"></p></section>`;stage.querySelector('p').textContent=error.message;console.error(error);}finally{stage.classList.remove('is-loading');scrollTo({top:0,behavior:'smooth'});}}

init().catch(error=>{document.body.innerHTML=`<main style="padding:32px;color:white;background:#02030a;min-height:100vh;font-family:system-ui"><h1>Our Universe tidak dapat dimulai.</h1><pre></pre></main>`;document.querySelector('pre').textContent=error.stack||error.message;});
