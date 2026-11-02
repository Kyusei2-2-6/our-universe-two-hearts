/* Satu tombol menu yang membuka semua menu utama (Chat, Lokasi, Kalender, Our Bond).
   Menggantikan tumpukan tombol mengambang: tombol aslinya tetap ada (tersembunyi) dan dipanggil lewat klik.
   Tampil sebagai tombol ⋮ di header (seperti WhatsApp) bila header ada; jika tidak, sebagai tombol ✦ mengambang. */

const SOURCES=[
  {key:'chat',selector:'.couple-connect-launcher',icon:'💬',label:'Chat',hint:'Pesan berdua'},
  {key:'map',selector:'#couple-life-dock .couple-life-button--map',icon:'📍',label:'Lokasi',hint:'Peta berdua'},
  {key:'calendar',selector:'#couple-life-dock .couple-life-button--calendar',icon:'📅',label:'Kalender',hint:'Agenda kalian'},
  {key:'bond',selector:'#couple-life-dock .couple-life-button--bond',icon:'💞',label:'Our Bond',hint:'Ruang ikatan kalian'}
];

const attention={unread:0,daily:false,game:false};
let root=null,trigger=null,menu=null,badge=null,topMode=false,isOpen=false,raf=0,started=false;

function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}

function loadStyles(){
  return new Promise(resolve=>{
    const link=document.createElement('link');link.rel='stylesheet';
    link.href=new URL('../../css/speed-dial.css?v=4.9.11',import.meta.url).href;
    link.onload=()=>resolve();link.onerror=()=>resolve();
    document.head.append(link);setTimeout(resolve,1800);
  });
}

function available(){
  const found=[];
  for(const def of SOURCES){
    const node=document.querySelector(def.selector);
    if(!node||node.hidden||getComputedStyle(node).display==='none')continue;
    found.push({...def,node});
  }
  return found;
}

function renderBadge(){
  if(!badge)return;
  const count=attention.unread>0?Math.min(attention.unread,99):0;
  const dot=!count&&(attention.daily||attention.game);
  badge.hidden=!count&&!dot;
  badge.classList.toggle('is-dot',dot);
  badge.textContent=count?String(count):'';
}

function sync(){
  raf=0;
  if(!root)return;
  const list=available();
  root.hidden=list.length===0;
  if(topMode)trigger.hidden=list.length===0;
  document.documentElement.classList.toggle('ou-dial-on',list.length>0);
  if(!list.length&&isOpen)closeMenu();
  renderBadge();
}
function schedule(){if(!raf)raf=requestAnimationFrame(sync);}

function closeMenu(){
  isOpen=false;
  if(!root)return;
  root.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');
  menu.setAttribute('aria-hidden','true');
}

function buildItems(){
  const list=available();
  menu.replaceChildren(...list.map((item,index)=>{
    const button=el('button','ou-dial__item');button.type='button';button.setAttribute('role','menuitem');button.style.setProperty('--i',String(index));
    const icon=el('span','ou-dial__icon',item.icon);
    const text=el('span','ou-dial__text');
    const hint=item.node.querySelector('small')?.textContent?.trim()||item.hint;
    text.append(el('strong','',item.label),el('small','',hint));
    button.append(icon,text);
    if(item.key==='chat'){
      const count=Math.min(attention.unread,99);
      if(count>0)button.append(el('i','ou-dial__item-badge',String(count)));
      else if(attention.daily||attention.game)button.append(el('i','ou-dial__item-badge is-dot'));
    }
    button.onclick=()=>{closeMenu();setTimeout(()=>item.node.click(),130);};
    return button;
  }));
}

function placeTopMenu(){
  const bar=document.querySelector('.topbar')||trigger;
  const rect=bar.getBoundingClientRect();
  menu.style.top=`${Math.round(rect.bottom+8)}px`;
}

function openMenu(){
  buildItems();
  if(!menu.children.length)return;
  if(topMode)placeTopMenu();
  isOpen=true;
  root.classList.add('is-open');trigger.setAttribute('aria-expanded','true');
  menu.setAttribute('aria-hidden','false');
}

function build(){
  const actions=document.querySelector('.topbar__actions');
  topMode=Boolean(actions);
  root=el('div',`ou-dial${topMode?' ou-dial--top':''}`);root.hidden=true;root.setAttribute('data-capture-ignore','true');
  const scrim=el('div','ou-dial__scrim');scrim.onclick=closeMenu;
  menu=el('div','ou-dial__menu');menu.setAttribute('role','menu');menu.setAttribute('aria-hidden','true');
  if(topMode){
    trigger=el('button','icon-button ou-dial__top');trigger.hidden=true;trigger.append(el('span','ou-dial__glyph','⋮'));
    actions.insertBefore(trigger,actions.querySelector('#profile-button')||null);
    root.append(scrim,menu);
  }else{
    trigger=el('button','ou-dial__fab');trigger.append(el('span','ou-dial__glyph','✦'));
    root.append(scrim,menu,trigger);
  }
  trigger.type='button';trigger.setAttribute('aria-label','Menu semesta');trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
  badge=el('i','ou-dial__badge');badge.hidden=true;trigger.append(badge);
  trigger.onclick=()=>{isOpen?closeMenu():openMenu();};
  document.body.append(root);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen){event.stopPropagation();closeMenu();}},true);
  window.addEventListener('ou:couple-attention',event=>{
    const detail=event.detail||{};
    attention.unread=Number(detail.unread)||0;attention.daily=Boolean(detail.daily);attention.game=Boolean(detail.game);
    renderBadge();
  });
  window.addEventListener('resize',()=>{if(isOpen&&topMode)placeTopMenu();});
}

async function start(){
  if(started)return;started=true;
  await loadStyles();
  build();
  const watchDock=()=>{const dock=document.getElementById('couple-life-dock');if(dock&&!dock.dataset.dialWatched){dock.dataset.dialWatched='1';new MutationObserver(schedule).observe(dock,{childList:true});}};
  new MutationObserver(()=>{watchDock();schedule();}).observe(document.body,{childList:true});
  watchDock();sync();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
