import { openModal } from './modal.js';

export function confirmAction({ title='Yakin?', message='', confirmLabel='Lanjutkan', danger=false } = {}) {
  return new Promise(resolve => {
    const content=document.createElement('div');
    content.innerHTML=`<p class="muted" style="line-height:1.65"></p><div class="toolbar" style="justify-content:flex-end;margin-top:20px"><button class="button button--ghost" type="button" data-cancel>Batal</button><button class="button ${danger?'button--danger':'button--primary'}" type="button" data-confirm>${confirmLabel}</button></div>`;
    content.querySelector('p').textContent=message;
    const modal=openModal({title,content,onClose:()=>resolve(false)});
    content.querySelector('[data-cancel]').onclick=()=>{resolve(false);modal.close();};
    content.querySelector('[data-confirm]').onclick=()=>{resolve(true);modal.close();};
  });
}
