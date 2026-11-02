const STORAGE_KEY='our-universe-data-mode';

function automaticMode(){
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  const memory=Number(navigator.deviceMemory||4);
  const cores=Number(navigator.hardwareConcurrency||4);
  if(connection?.saveData)return'economy';
  if(['slow-2g','2g','3g'].includes(connection?.effectiveType))return'economy';
  if(Number(connection?.downlink||10)<1.5)return'economy';
  if(memory<=2||cores<=2)return'economy';
  return'balanced';
}

export function getDataMode(){
  const saved=localStorage.getItem(STORAGE_KEY)||'auto';
  return saved==='auto'?automaticMode():saved;
}

export function setDataMode(mode='auto'){
  const allowed=['auto','economy','balanced'];
  const value=allowed.includes(mode)?mode:'auto';
  localStorage.setItem(STORAGE_KEY,value);
  applyDataMode();
  return value;
}

export function applyDataMode(){
  const mode=getDataMode();
  document.documentElement.dataset.dataMode=mode;
  document.documentElement.dataset.dataModePreference=localStorage.getItem(STORAGE_KEY)||'auto';
  window.dispatchEvent(new CustomEvent('our-universe:data-mode',{detail:{mode}}));
  return mode;
}

export function preferredPageSize(){
  return getDataMode()==='economy'?6:12;
}

applyDataMode();
const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
connection?.addEventListener?.('change',()=>{
  if((localStorage.getItem(STORAGE_KEY)||'auto')==='auto')applyDataMode();
});
