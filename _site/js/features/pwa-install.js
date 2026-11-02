import { setDataMode } from '../core/data-mode.js';

let deferredPrompt=null;
let chip=null;
let sheet=null;
const DISMISS_KEY='our-universe-install-dismissed-at';

const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isAndroid=()=>/Android/i.test(navigator.userAgent);

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredPrompt=event;
  renderChip(true);
});

window.addEventListener('appinstalled',()=>{
  deferredPrompt=null;
  chip?.remove();
  sheet?.remove();
  document.documentElement.dataset.installed='true';
});

function appReady(){
  const shell=document.querySelector('#app-shell');
  return shell&&!shell.hidden;
}

function recentlyDismissed(){
  const value=Number(localStorage.getItem(DISMISS_KEY)||0);
  return value&&Date.now()-value<3*24*60*60*1000;
}

function renderChip(force=false){
  if(isStandalone()||chip||!appReady())return;
  if(!force&&recentlyDismissed())return;
  chip=document.createElement('button');
  chip.type='button';
  chip.className='ou-install-chip';
  chip.setAttribute('aria-label','Pasang OUR UNIVERSE sebagai aplikasi');
  chip.innerHTML='<span class="ou-install-chip__icon">↓</span><span class="ou-install-chip__copy"><strong>Pasang App</strong><small>Buka seperti aplikasi asli</small></span>';
  chip.onclick=installOrExplain;
  document.body.append(chip);
}

async function installOrExplain(){
  if(deferredPrompt){
    chip.disabled=true;
    try{
      await deferredPrompt.prompt();
      const choice=await deferredPrompt.userChoice;
      if(choice.outcome!=='accepted')localStorage.setItem(DISMISS_KEY,String(Date.now()));
    }finally{
      deferredPrompt=null;
      chip?.remove();
      chip=null;
    }
    return;
  }
  openInstallSheet();
}

function openInstallSheet(){
  if(sheet){sheet.hidden=false;return;}
  sheet=document.createElement('section');
  sheet.className='ou-install-sheet';
  sheet.innerHTML=`
    <div class="ou-install-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="ou-install-title">
      <p class="eyebrow">OUR UNIVERSE APP</p>
      <h2 id="ou-install-title">Pasang ke layar utama</h2>
      <p>Sesudah dipasang, OUR UNIVERSE terbuka dalam jendela aplikasi tanpa bilah alamat Chrome.</p>
      <div class="ou-install-sheet__steps">
        <div class="ou-install-sheet__step"><b>1</b><span>Buka menu <strong>⋮</strong> di kanan atas Chrome.</span></div>
        <div class="ou-install-sheet__step"><b>2</b><span>Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.</span></div>
        <div class="ou-install-sheet__step"><b>3</b><span>Tekan <strong>Instal</strong>, lalu buka ikon OUR UNIVERSE dari layar utama.</span></div>
      </div>
      <div class="ou-install-sheet__actions">
        <button class="button button--primary" type="button" data-close>Mengerti</button>
        <button class="button button--ghost" type="button" data-economy>Aktifkan hemat data</button>
        <button class="button button--ghost" type="button" data-hide>Ingatkan nanti</button>
      </div>
    </div>`;
  sheet.onclick=event=>{if(event.target===sheet)closeSheet();};
  sheet.querySelector('[data-close]').onclick=closeSheet;
  sheet.querySelector('[data-economy]').onclick=event=>{
    setDataMode('economy');
    event.currentTarget.textContent='Mode hemat data aktif ✓';
  };
  sheet.querySelector('[data-hide]').onclick=()=>{
    localStorage.setItem(DISMISS_KEY,String(Date.now()));
    chip?.remove();chip=null;closeSheet();
  };
  document.body.append(sheet);
}

function closeSheet(){if(sheet)sheet.hidden=true;}

const readyTimer=setInterval(()=>{
  if(isStandalone()){clearInterval(readyTimer);return;}
  if(appReady()){
    renderChip(Boolean(deferredPrompt));
    if(isAndroid()||deferredPrompt)clearInterval(readyTimer);
  }
},500);

setTimeout(()=>clearInterval(readyTimer),30000);
