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
const performanceProfile=getPerformanceProfile();

async function init(){
  document.title=CONFIG.APP_NAME;
  audioEngine.configure({ambientElement:qs('#ambient-audio'),volume:.34,enabled:true});
  galaxy=new GalaxyEngine(qs('#universe-canvas'),performanceProfile);
  setupCards();setupControls();setupEvents();
  new EasterEggs({galaxyEngine:galaxy,canvas:qs('#universe-canvas'),initials:'♡'});
  if(CONFIG.ENABLE_PWA)registerPWA();
  await openingExperience();
}

function setupCards(){const host=qs('#orbit-cards');host.replaceChildren(...WORLD_CARDS.map(card=>createOrbitCard(card,route=>router.navigate(route))));animateOrbitCards();}
function animateOrbitCards(){cancelAnimationFrame(orbitFrame);const cards=qsa('.orbit-card');const render=now=>{orbitFrame=requestAnimationFrame(render);if(now-orbitLast<1000/Math.min(45,performanceProfile.fps))return;orbitLast=now;const rect=qs('#orbit-cards').getBoundingClientRect();const mobile=innerWidth<700;const cx=rect.width/2;const cy=rect.height*(mobile?.5:.49);const rx=Math.max(135,Math.min(rect.width*(mobile?.34:.43),510));const ry=Math.max(270,Math.min(rect.height*(mobile?.42:.39),390));const speed=(now*.000032);cards.forEach((card,index)=>{const angle=speed+(index/cards.length)*Math.PI*2;const layer=Math.sin(angle)*.5+.5;const x=cx+Math.cos(angle)*rx;const y=cy+Math.sin(angle)*ry;const scale=.82+layer*.2;card.style.left=`${x}px`;card.style.top=`${y}px`;card.style.zIndex=String(10+Math.round(layer*10));card.style.transform=`translate(-50%,-50%) scale(${scale})`;card.style.opacity=String(.68+layer*.32);});};orbitFrame=requestAnimationFrame(render);}

function setupControls(){
  qs('#home-button').onclick=()=>router.navigate('home');
  qs('#global-search').onclick=()=>router.navigate('search');
  qs('#studio-fab').onclick=()=>openTypePicker({onChoose:type=>openComposer({type,onSaved:handleDataChanged})});
  document.addEventListener('click',event=>{if(event.target.closest('[data-open-composer]'))openTypePicker({onChoose:type=>openComposer({type,onSaved:handleDataChanged})});});
  qs('#profile-button').onclick=()=>openProfileMenu({onRefresh:refreshContext,onNavigate:route=>router.navigate(route),onSignOut:showAccessGate});
  qs('#sound-toggle').onclick=async event=>{await audioEngine.setEnabled(!audioEngine.enabled);event.currentTarget.textContent=audioEngine.enabled?'◉':'○';toast(audioEngine.enabled?'Suara semesta aktif.':'Suara semesta dimatikan.');};
  qs('#skip-intro').onclick=()=>completeIntro(true);
  qs('#enter-universe').onclick=async()=>{const button=qs('#enter-universe');button.disabled=true;await audioEngine.playAmbient();await galaxy.enterUniverse();completeIntro(false);};
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
  state.patch(context);repository.setContext({universeId:context.universe.id,userId:context.user.id});document.documentElement.dataset.theme=context.universe.settings?.theme||'violet';
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
