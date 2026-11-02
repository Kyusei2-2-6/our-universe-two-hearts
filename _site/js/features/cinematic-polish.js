import { state } from '../core/state.js';
import { events } from '../core/event-bus.js';

const VERSION='4.8.1';
const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
let initialized=false;
let minuteTimer=0;
let viewportTimer=0;

const DAYPARTS={
  dawn:{label:'Fajar di semesta kalian',message:'Cahaya pertama hari ini menemukan dua hati yang sama.'},
  morning:{label:'Pagi di semesta kalian',message:'Cerita kalian tumbuh pelan, seperti cahaya yang baru datang.'},
  afternoon:{label:'Siang di semesta kalian',message:'Di tengah ramainya hari, semesta kecil ini tetap menunggu kalian.'},
  evening:{label:'Senja di semesta kalian',message:'Langit meredup, tetapi cerita kalian tetap menyala.'},
  night:{label:'Malam di semesta kalian',message:'Malam ini, setiap kenangan kembali menjadi bintang.'},
  midnight:{label:'Tengah malam di semesta kalian',message:'Saat dunia sunyi, semesta kalian masih bernapas perlahan.'}
};

export function initCinematicPolish(){
  if(initialized)return;
  initialized=true;
  document.documentElement.dataset.uiPolish=VERSION;
  createAtmosphere();
  createGalaxySignal();
  setupViewportAwareness();
  setupScrollState();
  setupTouchLight();
  setupVisibilityState();
  setupViewObserver();
  events.on('presence:sync',()=>queueMicrotask(syncCinematicPolish));
  events.on('route:change',event=>setView(event.detail?.route||'home'));
  syncCinematicPolish();
  requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add('is-ui-ready')));
}

export function syncCinematicPolish(){
  if(!initialized)return;
  updateDaypart();
  updatePresenceSignal();
  updateUniverseLabel();
}

export function setCinematicView(route='home'){
  setView(route);
}

function createAtmosphere(){
  if(document.querySelector('.cosmic-atmosphere'))return;
  const layer=document.createElement('div');
  layer.className='cosmic-atmosphere';
  layer.setAttribute('aria-hidden','true');
  layer.innerHTML='<span class="cosmic-atmosphere__moon"></span><span class="cosmic-atmosphere__aurora cosmic-atmosphere__aurora--violet"></span><span class="cosmic-atmosphere__aurora cosmic-atmosphere__aurora--rose"></span><span class="cosmic-atmosphere__dust"></span><span class="cosmic-atmosphere__shooting-star"></span>';
  document.body.insertBefore(layer,document.body.firstChild);
}

function createGalaxySignal(){
  const copy=document.querySelector('.hub-copy--v4');
  if(!copy||copy.querySelector('.galaxy-signal'))return;
  const signal=document.createElement('div');
  signal.className='galaxy-signal';
  signal.setAttribute('role','status');
  signal.setAttribute('aria-live','polite');
  signal.innerHTML='<span class="galaxy-signal__pulse" aria-hidden="true"></span><span class="galaxy-signal__copy"><strong data-galaxy-signal-label>Semesta kalian</strong><small data-galaxy-signal-message>Menunggu cahaya dari dua hati.</small></span>';
  copy.append(signal);
}

function updateUniverseLabel(){
  const universe=state.get('universe');
  const name=String(universe?.name||'OUR UNIVERSE').trim();
  document.documentElement.style.setProperty('--universe-name-length',String(Math.min(32,name.length)));
}

function updateDaypart(){
  const hour=new Date().getHours();
  const key=hour<5?'midnight':hour<7?'dawn':hour<12?'morning':hour<17?'afternoon':hour<20?'evening':'night';
  document.documentElement.dataset.daypart=key;
  const copy=DAYPARTS[key];
  const label=document.querySelector('[data-galaxy-signal-label]');
  const message=document.querySelector('[data-galaxy-signal-message]');
  if(label&&!label.dataset.presenceOverride)label.textContent=copy.label;
  if(message&&!message.dataset.presenceOverride)message.textContent=copy.message;
  clearTimeout(minuteTimer);
  const nextMinute=60000-(Date.now()%60000)+50;
  minuteTimer=window.setTimeout(updateDaypart,nextMinute);
}

function updatePresenceSignal(){
  const presence=state.get('presence')||{};
  const members=state.get('members')||[];
  const onlineCount=members.reduce((total,member)=>total+(presence[member.user_id]?.length?1:0),0);
  const label=document.querySelector('[data-galaxy-signal-label]');
  const message=document.querySelector('[data-galaxy-signal-message]');
  const mode=onlineCount>=2?'together':onlineCount===1?'one':'quiet';
  document.documentElement.dataset.couplePresence=mode;
  if(!label||!message)return;
  label.dataset.presenceOverride='true';
  message.dataset.presenceOverride='true';
  if(mode==='together'){
    label.textContent='Dua hati sedang hadir';
    message.textContent='Semesta kalian terasa lebih terang sekarang.';
  }else if(mode==='one'){
    label.textContent='Satu hati sedang menjaga semesta';
    message.textContent='Cahaya yang lain akan selalu punya tempat untuk kembali.';
  }else{
    const key=document.documentElement.dataset.daypart||'night';
    label.textContent=DAYPARTS[key].label;
    message.textContent=DAYPARTS[key].message;
    delete label.dataset.presenceOverride;
    delete message.dataset.presenceOverride;
  }
}

function setView(route){
  const view=route==='home'?'home':'world';
  document.documentElement.dataset.activeView=view;
  document.documentElement.dataset.activeRoute=route;
}

function setupViewportAwareness(){
  const viewport=window.visualViewport;
  const update=()=>{
    clearTimeout(viewportTimer);
    viewportTimer=window.setTimeout(()=>{
      const height=viewport?.height||window.innerHeight;
      const offsetTop=viewport?.offsetTop||0;
      const keyboardOpen=window.innerHeight-height>150;
      document.documentElement.style.setProperty('--ou-visual-height',`${Math.round(height)}px`);
      document.documentElement.style.setProperty('--ou-visual-offset',`${Math.round(offsetTop)}px`);
      document.documentElement.classList.toggle('is-keyboard-open',keyboardOpen);
    },24);
  };
  viewport?.addEventListener('resize',update,{passive:true});
  viewport?.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',update,{passive:true});
  update();
}

function setupScrollState(){
  let ticking=false;
  const update=()=>{
    ticking=false;
    document.documentElement.classList.toggle('is-page-scrolled',window.scrollY>28);
  };
  window.addEventListener('scroll',()=>{
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(update);
  },{passive:true});
  update();
}

function setupTouchLight(){
  if(reduceMotion)return;
  document.addEventListener('pointerdown',event=>{
    const target=event.target.closest('button,.button,[role="button"]');
    if(!target||target.disabled||target.closest('[data-no-cosmic-touch]'))return;
    const rect=target.getBoundingClientRect();
    const light=document.createElement('span');
    light.className='cosmic-touch-light';
    light.setAttribute('aria-hidden','true');
    light.style.left=`${event.clientX-rect.left}px`;
    light.style.top=`${event.clientY-rect.top}px`;
    target.append(light);
    window.setTimeout(()=>light.remove(),540);
  },{passive:true});
}

function setupVisibilityState(){
  const update=()=>document.documentElement.toggleAttribute('data-document-hidden',document.hidden);
  document.addEventListener('visibilitychange',update);
  update();
}

function setupViewObserver(){
  const hub=document.querySelector('#galaxy-hub');
  const stage=document.querySelector('#world-stage');
  if(!hub||!stage)return;
  const observer=new MutationObserver(()=>{
    const homeVisible=!hub.hidden;
    document.documentElement.dataset.activeView=homeVisible?'home':'world';
    if(!stage.hidden&&stage.children.length){
      stage.classList.remove('is-view-ready');
      requestAnimationFrame(()=>stage.classList.add('is-view-ready'));
    }
  });
  observer.observe(hub,{attributes:true,attributeFilter:['hidden']});
  observer.observe(stage,{attributes:true,childList:true,attributeFilter:['hidden']});
}
