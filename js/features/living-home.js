import { state } from '../core/state.js';
import { events } from '../core/event-bus.js';
import { toast } from '../components/toast.js';

const VERSION='4.8.1';
let initialized=false;
let lastSummary={planets:0,memories:0,stories:0};

const PORTALS={
  connect:'.couple-connect-launcher',
  map:'.couple-life-button--map',
  calendar:'.couple-life-button--calendar',
  bond:'.couple-life-button--bond'
};

export function initLivingHome(){
  if(initialized)return;
  initialized=true;
  document.documentElement.dataset.livingHome=VERSION;
  document.querySelectorAll('[data-home-portal]').forEach(button=>{
    button.addEventListener('click',()=>openPortal(button.dataset.homePortal,button));
  });
  events.on('presence:sync',syncLivingHomeIdentity);
  events.on('state:change',event=>{
    if(['members','profile','presence','universe'].includes(event.detail?.key))syncLivingHomeIdentity();
  });
  syncLivingHomeIdentity();
}

export function updateLivingHome(planets=[]){
  const summary=planets.reduce((result,planet)=>{
    result.memories+=Number(planet.entry_count||0);
    result.stories+=Number(planet.active_story_count||0);
    return result;
  },{planets:planets.length,memories:0,stories:0});
  lastSummary=summary;
  setText('[data-home-planets]',formatNumber(summary.planets));
  setText('[data-home-memories]',formatNumber(summary.memories));
  setText('[data-home-stories]',formatNumber(summary.stories));
  document.documentElement.dataset.galaxyDensity=summary.memories>99?'rich':summary.memories>19?'growing':'young';
  syncLivingHomeIdentity();
}

export function setLivingPlanetFocus(planet,index=0,total=1){
  const label=document.querySelector('[data-active-planet-label]');
  if(!label)return;
  if(!planet){label.textContent='Belum ada planet';return;}
  label.textContent=`${String(index+1).padStart(2,'0')} / ${String(total).padStart(2,'0')} · ${planet.name}`;
  label.style.setProperty('--active-planet-accent',planet.accent_color||'#9b8cff');
}

export function syncLivingHomeIdentity(){
  if(!initialized)return;
  const snapshot=state.snapshot;
  const members=snapshot.members||[];
  const me=members.find(member=>member.user_id===snapshot.user?.id)||null;
  const partner=members.find(member=>member.user_id!==snapshot.user?.id)||null;
  const myName=me?.profile?.display_name||snapshot.profile?.display_name||'Aku';
  const partnerName=partner?.profile?.display_name||'Kamu';
  setText('[data-home-my-initial]',initials(myName));
  setText('[data-home-partner-initial]',partner?initials(partnerName):'♡');

  const presence=snapshot.presence||{};
  const onlineCount=members.reduce((count,member)=>count+(presence[member.user_id]?.length?1:0),0);
  const mode=onlineCount>=2?'together':onlineCount===1?'one':'quiet';
  document.documentElement.dataset.homePresence=mode;
  if(mode==='together'){
    setText('[data-home-kicker]','DUA HATI · SATU ORBIT');
    setText('[data-home-status]',`${myName} dan ${partnerName} sedang hadir`);
    setText('[data-home-message]','Cahaya semesta meningkat karena kalian membukanya pada waktu yang sama.');
  }else if(mode==='one'){
    setText('[data-home-kicker]','SATU HATI SEDANG MENJAGA');
    setText('[data-home-status]',partner?`${myName} sedang berada di semesta`:'Semesta menunggu pasanganmu');
    setText('[data-home-message]',partner?'Setiap cerita tetap menyimpan tempat bagi hati yang lain.':'Bagikan kode undangan ketika waktunya terasa tepat.');
  }else{
    const name=snapshot.universe?.name||'OUR UNIVERSE';
    setText('[data-home-kicker]','THE LIVING GALAXY');
    setText('[data-home-status]',`${name} menyimpan ${formatNumber(lastSummary.memories)} kenangan`);
    setText('[data-home-message]',dayMessage());
  }
}

async function openPortal(key,button){
  const selector=PORTALS[key];
  if(!selector)return;
  button.classList.add('is-launching');
  try{
    let launcher=document.querySelector(selector);
    if(!launcher){
      window.dispatchEvent(new Event('our-universe:context-ready'));
      await delay(260);
      launcher=document.querySelector(selector);
    }
    if(!launcher||launcher.hidden){
      toast('Portal sedang menyelaraskan orbit. Coba sekali lagi.',{type:'info'});
      return;
    }
    launcher.click();
  }finally{
    window.setTimeout(()=>button.classList.remove('is-launching'),420);
  }
}

function dayMessage(){
  const hour=new Date().getHours();
  if(hour<5)return'Malam paling sunyi sering menjadi tempat kenangan terdengar paling jelas.';
  if(hour<11)return'Hari baru datang, tetapi cerita kalian tetap terhubung dari kemarin.';
  if(hour<16)return'Di tengah ramainya hari, semesta kecil ini tetap menjadi tempat pulang.';
  if(hour<20)return'Senja mengubah langit, sementara kenangan kalian tetap menyala.';
  return'Malam ini, setiap planet menunggu untuk dikunjungi kembali.';
}

function initials(value){
  return String(value||'♡').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()||'♡';
}
function formatNumber(value){return new Intl.NumberFormat('id-ID').format(Number(value)||0);}
function setText(selector,value){const node=document.querySelector(selector);if(node)node.textContent=value;}
function delay(ms){return new Promise(resolve=>window.setTimeout(resolve,ms));}
