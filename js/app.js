import { CONFIG } from './config.js';
import { qs, initials, debounce } from './core/utils.js';
import { state } from './core/state.js';
import { events } from './core/event-bus.js';
import { router } from './core/router.js';
import { auth } from './core/auth.js';
import { isSupabaseConfigured } from './core/supabase.js';
import { repository } from './core/repository.js';
import { realtime } from './core/realtime.js';
import { audioEngine } from './core/audio-engine.js';
import { registerPWA } from './core/pwa.js';
import { notificationService } from './core/notifications.js';
import { getPerformanceProfile } from './core/performance.js';
import { signedUrl,removeFiles } from './core/storage.js';
import { captureCurrentView } from './core/screenshot.js';
import { createPlanetDeck } from './components/planet-deck.js';
import { openPlanetComposer } from './components/planet-composer.js';
import { openStoryComposer } from './components/story-composer.js';
import * as profileMenu from './components/profile-menu.js';
import { needsV4Rebuild,openRebuildGate } from './components/rebuild-gate.js';
import { toast } from './components/toast.js';
import { renderConfigurationGate, renderAuthGate, renderOnboarding } from './components/auth-gate.js';
import { initCinematicPolish, syncCinematicPolish, setCinematicView } from './features/cinematic-polish.js';

document.documentElement.dataset.ourUniverseBooted='true';window.dispatchEvent(new Event('our-universe:booted'));

const worldLoaders={
  planet:()=>import('./worlds/planet.js').then(m=>m.renderPlanet),
  search:()=>import('./worlds/search.js').then(m=>m.renderSearch),
  activity:()=>import('./worlds/activity.js').then(m=>m.renderActivity),
  settings:()=>import('./worlds/settings.js').then(m=>m.renderSettings),
  'about-us':()=>import('./worlds/about-us.js').then(m=>m.renderAboutUs)
};
let galaxy=createLiteGalaxy(),galaxyLoadPromise=null,routeStarted=false,authUnsubscribe,accessReady=false,openedNotificationEntry='',deckController=null,rebuildModal=null;
const performanceProfile=getPerformanceProfile();
const REFRESH_FLASH_KEY='our-universe-refresh-flash';
let viewRefreshScheduled=false;


function createLiteGalaxy(){
  return {
    isCinematic:false,
    mode:'hub',
    camera:{position:{set(){}}},
    setTheme(name){document.documentElement.dataset.spaceTheme=name||'solar-system';},
    playOpening(onReady,onDone){onReady?.();onDone?.();return Promise.resolve();},
    enterUniverse(){return Promise.resolve();},
    captureFrame(){return Promise.resolve(null);},
    meteorShower(){},
    dispose(){}
  };
}

async function ensureGalaxy(theme=document.documentElement.dataset.spaceTheme||'solar-system'){
  if(galaxy?.isCinematic){galaxy.setTheme(theme);return galaxy;}
  if(galaxyLoadPromise)return galaxyLoadPromise;
  galaxyLoadPromise=import('./universe/galaxy-engine.js')
    .then(async({GalaxyEngine})=>{
      const next=new GalaxyEngine(qs('#universe-canvas'),performanceProfile);
      next.isCinematic=true;
      next.mode='hub';
      next.setTheme(theme);
      galaxy=next;
      document.documentElement.dataset.galaxyEngine='cinematic';
      try{
        const {EasterEggs}=await import('./universe/easter-eggs.js');
        new EasterEggs({galaxyEngine:galaxy,canvas:qs('#universe-canvas'),initials:'♡'});
      }catch(error){console.warn('Easter egg visual tidak dimuat:',error);}
      return galaxy;
    })
    .catch(error=>{
      document.documentElement.dataset.galaxyEngine='lite';
      console.warn('Mode galaksi ringan dipakai agar aplikasi tetap responsif:',error);
      galaxyLoadPromise=null;
      return galaxy;
    });
  return galaxyLoadPromise;
}

async function init(){
  document.title=CONFIG.APP_NAME;
  document.documentElement.dataset.galaxyEngine='lite';
  const soundEnabled=localStorage.getItem('our-universe-sound')==='on';
  audioEngine.configure({ambientElement:qs('#ambient-audio'),volume:.18,enabled:soundEnabled});
  setupControls();
  setupEvents();
  initCinematicPolish();
  if(CONFIG.ENABLE_PWA)registerPWA();
  openingExperience();
}

function setupControls(){
  qs('#home-button').onclick=()=>router.navigate('home');qs('#global-search').onclick=()=>router.navigate('search');qs('#capture-universe').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await captureCurrentView({galaxy});toast('Tangkapan semesta disimpan.');}catch(error){toast(error.message,{type:'error'});}finally{button.disabled=false;}};
  qs('#dock-home').onclick=()=>router.navigate('home');qs('#dock-search').onclick=()=>router.navigate('search');qs('#dock-add').onclick=()=>openCreateFlow();qs('#dock-notifications').onclick=()=>router.navigate('settings',{section:'notifications'});qs('#dock-profile').onclick=()=>openProfile();document.querySelectorAll('[data-create-planet]').forEach(button=>button.onclick=()=>openPlanetComposer({onSaved:renderHome}));
  qs('#profile-button').onclick=openProfile;const sound=qs('#sound-toggle');sound.textContent=audioEngine.enabled?'◉':'○';sound.onclick=async()=>{await audioEngine.setEnabled(!audioEngine.enabled);localStorage.setItem('our-universe-sound',audioEngine.enabled?'on':'off');sound.textContent=audioEngine.enabled?'◉':'○';toast(audioEngine.enabled?'Suara latar dinyalakan.':'Suara latar dimatikan.');};
  qs('#skip-intro').onclick=()=>completeIntro(true);qs('#enter-universe').onclick=()=>{qs('#enter-universe').disabled=true;completeIntro(false);};
}
function openProfile(){profileMenu.openProfileMenu({onRefresh:refreshContext,onNavigate:(route)=>router.navigate(route),onSignOut:showAccessGate,onPlanetCreated:renderHome});}
async function openCreateFlow(){try{const planets=await repository.listPlanets();if(!planets.length){openPlanetComposer({onSaved:()=>renderHome()});return;}openStoryComposer({onSaved:async()=>{if(state.get('route')==='home')await renderHome();else await renderRoute(state.get('route'));}});}catch(error){toast(error.message,{type:'error'});}}

function setupEvents(){
  events.on('route:change',event=>{if(accessReady)renderRoute(event.detail.route);});
  const refresh=debounce(async()=>{if(!accessReady)return;if(state.get('route')==='home')await renderHome();else await renderRoute(state.get('route'));},420);
  const refreshContextRealtime=debounce(()=>refreshContext(),650);
  events.on('realtime:change',event=>{if(['universe_members','profiles'].includes(event.detail.table))refreshContextRealtime();else refresh();});
  events.on('presence:sync',event=>{state.set('presence',event.detail.state||{});renderMembers();});
  events.on('data:changed',event=>scheduleViewRefresh({source:'content',message:event.detail?.message||'Perubahan berhasil disimpan.'}));
  addEventListener('our-universe:refresh',event=>scheduleViewRefresh(event.detail||{}));
}

function scheduleViewRefresh(detail={}){
  if(viewRefreshScheduled)return;
  viewRefreshScheduled=true;
  const message=detail.message||({
    entry:'Isi baru berhasil disimpan.',
    planet:'Planet berhasil disimpan.',
    'planet-delete':'Planet berhasil dihapus.',
    profile:'Profil berhasil diperbarui.',
    'settings-name':'Nama semesta berhasil diperbarui.',
    'settings-partner':'Data pasangan berhasil diperbarui.',
    content:'Perubahan berhasil disimpan.'
  })[detail.source]||'Perubahan berhasil disimpan.';
  window.setTimeout(async()=>{
    try{
      const requiresContext=['profile','settings-name','settings-partner'].includes(detail.source);
      if(requiresContext)await refreshContext();
      else if(accessReady){
        const route=state.get('route')||'home';
        if(route==='home')await renderHome();
        else await renderRoute(route);
      }
      toast(message,{type:'success',duration:4200});
      window.dispatchEvent(new CustomEvent('our-universe:view-refreshed',{detail}));
    }catch(error){
      console.warn('Refresh tampilan gagal, memuat ulang sebagai fallback aman:',error);
      try{sessionStorage.setItem(REFRESH_FLASH_KEY,message);}catch{}
      location.reload();
    }finally{
      viewRefreshScheduled=false;
    }
  },180);
}

function showRefreshFlash(){
  let message='';
  try{message=sessionStorage.getItem(REFRESH_FLASH_KEY)||'';sessionStorage.removeItem(REFRESH_FLASH_KEY);}catch{}
  if(message)setTimeout(()=>toast(message,{type:'success',duration:4800}),260);
}

function openingExperience(){
  qs('#intro-quote').textContent=CONFIG.INTRO_QUOTE;
  requestAnimationFrame(()=>{
    qs('#intro-kicker').style.opacity='1';
    qs('#intro-quote').style.opacity='1';
    const enter=qs('#enter-universe');
    enter.style.opacity='1';
    enter.style.transform='translateY(0)';
  });
}
function completeIntro(skipped){if(state.get('introComplete'))return;state.set('introComplete',true);galaxy.mode='hub';galaxy.camera?.position?.set?.(0,5,28);qs('#intro').classList.add('is-leaving');setTimeout(()=>{qs('#intro').hidden=true;showAccessGate();},260);}

async function showAccessGate(){
  accessReady=false;qs('#app-shell').hidden=true;window.dispatchEvent(new Event('our-universe:context-cleared'));const root=qs('#auth-root');root.hidden=false;
  if(!isSupabaseConfigured()){renderConfigurationGate(root,showAccessGate);return;}
  if(!authUnsubscribe)authUnsubscribe=auth.onChange(event=>{if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))refreshContext();if(event==='SIGNED_OUT'){realtime.disconnect();showAccessGate();}});
  try{const context=await auth.context();if(!context.session){renderAuthGate(root,{onAuthenticated:refreshContext});return;}if(!context.membership){renderOnboarding(root,context,{onComplete:refreshContext,onSignOut:async()=>{await auth.signOut();showAccessGate();}});return;}await activateUniverse(context);}catch(error){renderAuthGate(root,{onAuthenticated:refreshContext});toast(error.message,{type:'error',duration:6500});}
}
async function refreshContext(){try{const context=await auth.context();if(!context.session||!context.membership){showAccessGate();return;}await activateUniverse(context);}catch(error){toast(error.message,{type:'error'});}}
async function activateUniverse(context){
  state.patch(context);syncCinematicPolish();repository.setContext({universeId:context.universe.id,userId:context.user.id});notificationService.configure({universeId:context.universe.id,userId:context.user.id,profile:context.profile});const settings=context.universe.settings||{};document.documentElement.dataset.theme=settings.theme||'violet';document.documentElement.dataset.spaceTheme=settings.space_theme||'solar-system';galaxy.setTheme(settings.space_theme||'solar-system');
  qs('#auth-root').hidden=true;qs('#auth-root').innerHTML='';qs('#app-shell').hidden=false;accessReady=true;await realtime.connect({universeId:context.universe.id,user:context.user,profile:context.profile});renderMembers();window.dispatchEvent(new CustomEvent('our-universe:context-ready',{detail:{universeId:context.universe.id,userId:context.user.id}}));showRefreshFlash();cleanupExpiredStories().catch(error=>console.warn('Pembersihan story tertunda:',error));
  if(needsV4Rebuild()&&!rebuildModal){rebuildModal=openRebuildGate({onComplete:async()=>{rebuildModal=null;await refreshContext();}});}
  if(!routeStarted){router.start();routeStarted=true;}else await renderRoute(state.get('route')||'home');
  if(document.documentElement.dataset.dataMode!=='economy')window.setTimeout(()=>void ensureGalaxy(settings.space_theme||'solar-system'),1200);
}


async function cleanupExpiredStories(){
  if(needsV4Rebuild())return;
  const stories=await repository.listExpiredStories();
  for(const story of stories){
    if(story.keep_permanently){await repository.deleteStory(story.id);continue;}
    try{const entry=await repository.getEntry(story.entry_id);await removeFiles((entry.attachments||[]).map(item=>item.file_path));await repository.deleteEntry(entry.id);}catch(error){console.warn('Story sementara belum dibersihkan:',error);}
  }
}

async function renderMembers(){
  const host=qs('#member-presence');host.innerHTML='';const presence=state.get('presence')||{};
  for(const member of state.get('members')||[]){
    const node=document.createElement('button');node.type='button';node.className='presence-avatar';node.title=`Lihat profil ${member.profile?.display_name||'anggota'}`;node.setAttribute('aria-label',node.title);node.textContent=initials(member.profile?.display_name);
    if(member.profile?.avatar_path)signedUrl(member.profile.avatar_path).then(url=>{const img=document.createElement('img');img.src=url;img.alt='';node.textContent='';node.append(img);node.append(createPresenceDot(member,presence));}).catch(()=>{});
    else node.append(createPresenceDot(member,presence));
    node.onclick=()=>{if(typeof profileMenu.openMemberProfile==='function')profileMenu.openMemberProfile(member,{onRefresh:refreshContext});else openProfile();};host.append(node);
  }
  const profile=state.get('profile');const button=qs('#profile-button');button.innerHTML='';
  if(profile?.avatar_path){try{const img=document.createElement('img');img.src=await signedUrl(profile.avatar_path);img.alt='';button.append(img);}catch{button.textContent=initials(profile?.display_name);}}else button.textContent=initials(profile?.display_name);
  qs('#dock-profile span').textContent=initials(profile?.display_name);
}
function createPresenceDot(member,presence){const dot=document.createElement('span');dot.className=`status-dot${presence[member.user_id]?.length?' is-online':''}`;return dot;}

async function renderHome(){
  setCinematicView('home');
  const hub=qs('#galaxy-hub'),stage=qs('#world-stage');stage.hidden=true;hub.hidden=false;qs('#dock-home').classList.add('is-active');
  qs('#hub-title').textContent=state.get('universe')?.name||'OUR UNIVERSE';qs('#hub-subtitle').textContent='Kalian menciptakan planet, memberi nama, lalu mengisinya bersama.';
  const host=qs('#planet-deck-host');host.innerHTML='<div class="planet-deck-loading"><span></span><p>Membaca tata surya kalian…</p></div>';
  try{const planets=await repository.listPlanets();qs('#hub-empty').hidden=planets.length>0;document.querySelectorAll('[data-create-planet]').forEach((button,index)=>{button.hidden=index===0?planets.length>0:!planets.length;});deckController?.destroy?.();deckController=createPlanetDeck({planets,onOpen:planet=>router.navigate('planet',{id:planet.id}),onCreate:()=>openPlanetComposer({onSaved:renderHome}),onEdit:planet=>openPlanetComposer({planet,onSaved:renderHome,onDeleted:renderHome})});host.replaceChildren(deckController.element);await renderStoryRail();}catch(error){host.innerHTML=`<section class="world-panel glass-panel"><h2>Planet belum dapat dimuat.</h2><p class="muted"></p></section>`;host.querySelector('p').textContent=error.message;}
}
async function renderStoryRail(){const host=qs('#home-stories');try{const stories=await repository.listActiveStories();host.innerHTML='';host.hidden=!stories.length;if(!stories.length)return;const label=document.createElement('p');label.className='eyebrow';label.textContent='STORY YANG MASIH BERSINAR';host.append(label);const row=document.createElement('div');row.className='home-story-row';for(const story of stories){const button=document.createElement('button');button.type='button';button.className='home-story';button.style.setProperty('--planet-accent',story.planets?.accent_color||'#7C8CFF');button.innerHTML='<span>✦</span><strong></strong><small></small>';button.querySelector('strong').textContent=story.entries?.title||'Story';button.querySelector('small').textContent=story.planets?.name||'Planet';button.onclick=async()=>{const entry=await repository.getEntry(story.entry_id);const {openEntryDetail}=await import('./worlds/shared.js');await openEntryDetail(entry);};row.append(button);}host.append(row);}catch(error){host.hidden=true;}}

async function renderRoute(route){
  setCinematicView(route);
  document.querySelectorAll('.app-dock button').forEach(button=>button.classList.remove('is-active'));
  if(route==='home'){await renderHome();return;}
  if(route==='search')qs('#dock-search').classList.add('is-active');
  if(route==='settings'&&state.get('routeParams')?.section==='notifications')qs('#dock-notifications').classList.add('is-active');
  else if(route==='settings'||route==='activity')qs('#dock-profile').classList.add('is-active');
  const hub=qs('#galaxy-hub'),stage=qs('#world-stage');hub.hidden=true;stage.hidden=false;stage.classList.add('is-loading');stage.innerHTML='';
  try{const renderer=await worldLoaders[route]?.();if(!renderer){if(state.get('routeParams')?.entry){await renderHome();await openNotificationDeepLink();return;}router.navigate('home',{},true);return;}await renderer(stage);await openNotificationDeepLink();}
  catch(error){stage.innerHTML='<section class="world-panel glass-panel"><h2>Bagian ini belum dapat dibuka.</h2><p class="muted"></p></section>';stage.querySelector('p').textContent=error.message;console.error(error);}
  finally{stage.classList.remove('is-loading');scrollTo({top:0,behavior:'smooth'});}
}
async function openNotificationDeepLink(){const entryId=state.get('routeParams')?.entry;if(!entryId||entryId===openedNotificationEntry)return;openedNotificationEntry=entryId;try{const entry=await repository.getEntry(entryId);const {openEntryDetail}=await import('./worlds/shared.js');await openEntryDetail(entry);}catch(error){console.warn(error);}}

init().catch(error=>{document.body.innerHTML='<main style="padding:32px;color:white;background:#02030a;min-height:100vh;font-family:system-ui"><h1>Our Universe tidak dapat dimulai.</h1><pre></pre></main>';document.querySelector('pre').textContent=error.stack||error.message;});
