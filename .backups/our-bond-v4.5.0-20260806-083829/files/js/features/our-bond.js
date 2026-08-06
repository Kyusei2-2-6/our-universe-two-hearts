import { supabase } from '../core/supabase.js';
import { state } from '../core/state.js';
import { events } from '../core/event-bus.js';
import { createHeartbeatEngine } from './heartbeat-engine.js';
import { createMemoryReplay } from './memory-replay.js';
import { createLoveCinema } from './love-cinema.js';
import { createSecretRoom } from './secret-room.js';

const TAB_DEFINITIONS=[
  {id:'heartbeat',label:'Heartbeat',icon:'♡'},
  {id:'replay',label:'Replay',icon:'↻'},
  {id:'cinema',label:'Love Cinema',icon:'▶'},
  {id:'secret',label:'Secret Room',icon:'☾'}
];
const BOND_TABLES=new Set(['bond_pulses','bond_emotions','bond_replays','bond_capsules']);

let launcher=null;
let sheet=null;
let contentHost=null;
let channel=null;
let activeUniverseId='';
let activeUserId='';
let partner=null;
let isOpen=false;
let activeTab='heartbeat';
let controllers=new Map();
let contextSignature='';
let starting=false;

function context(){
  const snapshot=state.snapshot;
  const universeId=snapshot.universe?.id||'';
  const userId=snapshot.user?.id||'';
  const other=(snapshot.members||[]).find(member=>member.user_id!==userId)||null;
  return{snapshot,universeId,userId,partner:other};
}

function appReady(){
  const shell=document.querySelector('#app-shell');
  return Boolean(shell&&!shell.hidden);
}

function ensureDock(){
  let dock=document.querySelector('#couple-life-dock');
  if(!dock){
    dock=document.createElement('div');
    dock.id='couple-life-dock';
    dock.className='couple-life-dock';
    dock.setAttribute('data-capture-ignore','true');
    document.body.append(dock);
  }
  return dock;
}

function ensureUI(){
  if(launcher)return;
  launcher=document.createElement('button');
  launcher.type='button';
  launcher.className='couple-life-button couple-life-button--bond';
  launcher.setAttribute('aria-label','Buka Our Bond');
  launcher.setAttribute('data-capture-ignore','true');
  launcher.innerHTML='<span class="couple-life-button__icon">♡</span><span class="couple-life-button__copy"><strong>Our Bond</strong><small>Ruang ikatan kalian</small></span>';
  launcher.onclick=()=>openBond();
  ensureDock().append(launcher);

  sheet=document.createElement('section');
  sheet.className='our-bond-sheet';
  sheet.hidden=true;
  sheet.setAttribute('data-capture-ignore','true');
  sheet.innerHTML=`<div class="our-bond-backdrop" data-bond-close></div>
    <div class="our-bond-panel" role="dialog" aria-modal="true" aria-labelledby="our-bond-title">
      <header class="our-bond-header">
        <div class="our-bond-heading">
          <p>ONE PANEL · TWO HEARTS</p>
          <h2 id="our-bond-title">Our Bond</h2>
          <small data-bond-subtitle>Ruang privat yang hidup bersama kalian.</small>
        </div>
        <button class="our-bond-close" type="button" data-bond-close aria-label="Tutup Our Bond">×</button>
      </header>
      <nav class="our-bond-tabs" aria-label="Fitur Our Bond">
        ${TAB_DEFINITIONS.map((tab,index)=>`<button type="button" data-bond-tab="${tab.id}" ${index===0?'class="is-active"':''}><span>${tab.icon}</span><small>${tab.label}</small></button>`).join('')}
      </nav>
      <main class="our-bond-content" data-bond-content></main>
    </div>`;
  document.body.append(sheet);
  contentHost=sheet.querySelector('[data-bond-content]');
  sheet.querySelectorAll('[data-bond-close]').forEach(node=>node.onclick=closeBond);
  sheet.querySelectorAll('[data-bond-tab]').forEach(button=>button.onclick=()=>setTab(button.dataset.bondTab));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen)closeBond();});

  const api={
    getContext:()=>({universeId:activeUniverseId,userId:activeUserId,partner,snapshot:state.snapshot}),
    notifyUpdate:()=>launcher?.classList.add('has-update'),
    clearUpdate:()=>launcher?.classList.remove('has-update'),
    setSubtitle:text=>{const node=sheet?.querySelector('[data-bond-subtitle]');if(node)node.textContent=text;},
    switchTab:setTab,
    closePanel:closeBond
  };
  controllers=new Map([
    ['heartbeat',createHeartbeatEngine(api)],
    ['replay',createMemoryReplay(api)],
    ['cinema',createLoveCinema(api)],
    ['secret',createSecretRoom(api)]
  ]);
  for(const [id,controller] of controllers){
    const section=document.createElement('section');
    section.className='our-bond-view';
    section.dataset.bondView=id;
    section.hidden=id!==activeTab;
    contentHost.append(section);
    controller.mount(section);
  }
}

async function ensureStarted(){
  if(starting)return;
  starting=true;
  try{
    const next=context();
    if(!appReady()||!next.universeId||!next.userId){
      if(launcher)launcher.hidden=true;
      if(isOpen)closeBond();
      return;
    }
    ensureUI();
    launcher.hidden=false;
    const nextSignature=`${next.universeId}|${next.userId}|${next.partner?.user_id||''}`;
    const changed=nextSignature!==contextSignature;
    activeUniverseId=next.universeId;
    activeUserId=next.userId;
    partner=next.partner;
    contextSignature=nextSignature;
    launcher.querySelector('.couple-life-button__copy small').textContent=partner?'Ruang ikatan kalian':'Menunggu pasangan';
    if(changed){
      await disconnectChannel();
      for(const controller of controllers.values())await controller.contextChanged?.();
      await subscribeRealtime();
    }else if(!channel){
      await subscribeRealtime();
    }
    if(new URL(location.href).searchParams.get('bond')==='1'){
      const url=new URL(location.href);
      const requested=TAB_DEFINITIONS.some(tab=>tab.id===url.searchParams.get('bondTab'))?url.searchParams.get('bondTab'):'heartbeat';
      url.searchParams.delete('bond');url.searchParams.delete('bondTab');
      history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);
      setTimeout(()=>openBond(requested),300);
    }
  }finally{starting=false;}
}

async function subscribeRealtime(){
  if(!activeUniverseId)return;
  await disconnectChannel();
  channel=supabase().channel(`our-bond:${activeUniverseId}`);
  for(const table of BOND_TABLES){
    channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`universe_id=eq.${activeUniverseId}`},payload=>handleRealtime(table,payload));
  }
  channel.subscribe();
}

async function disconnectChannel(){
  if(!channel)return;
  const old=channel;channel=null;
  try{await supabase().removeChannel(old);}catch{}
}

function handleRealtime(table,payload){
  const target={bond_pulses:'heartbeat',bond_emotions:'heartbeat',bond_replays:'replay',bond_capsules:'secret'}[table];
  controllers.get(target)?.realtime?.(table,payload);
  if(!isOpen||activeTab!==target)launcher?.classList.add('has-update');
}

async function openBond(tab=activeTab){
  await ensureStarted();
  if(!sheet)return;
  sheet.hidden=false;
  isOpen=true;
  document.body.classList.add('our-bond-open');
  launcher?.classList.remove('has-update');
  await setTab(tab);
}

function closeBond(){
  if(!sheet)return;
  sheet.hidden=true;
  isOpen=false;
  document.body.classList.remove('our-bond-open');
  controllers.get(activeTab)?.deactivate?.();
}

async function setTab(tab){
  if(!controllers.has(tab))tab='heartbeat';
  if(activeTab!==tab)controllers.get(activeTab)?.deactivate?.();
  activeTab=tab;
  sheet?.querySelectorAll('[data-bond-tab]').forEach(button=>button.classList.toggle('is-active',button.dataset.bondTab===tab));
  sheet?.querySelectorAll('[data-bond-view]').forEach(view=>{view.hidden=view.dataset.bondView!==tab;});
  if(isOpen)await controllers.get(tab)?.activate?.();
}

events.on('presence:sync',()=>controllers.get('heartbeat')?.presenceChanged?.());
events.on('realtime:change',event=>{if(['universe_members','profiles'].includes(event.detail?.table))setTimeout(()=>ensureStarted().catch(()=>{}),350);});
window.addEventListener('pagehide',()=>{disconnectChannel();for(const controller of controllers.values())controller.destroy?.();});
setInterval(()=>ensureStarted().catch(()=>{}),1200);
ensureStarted().catch(()=>{});
