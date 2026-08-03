import { signedUrl } from '../core/storage.js';
import { formatBytes } from '../core/utils.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

export async function openAttachment(attachment) {
  const content=document.createElement('div');content.className='entry-detail';content.innerHTML='<div class="skeleton" style="min-height:320px;border-radius:22px"></div>';
  const modal=openModal({title:attachment.file_name || 'Lampiran',content,className:'media-modal'});
  try{
    const url=await signedUrl(attachment.file_path);
    content.innerHTML='';
    if(attachment.kind==='image'){
      const img=document.createElement('img');img.src=url;img.alt=attachment.file_name || '';img.style.cssText='max-height:72vh;margin:auto;border-radius:20px;object-fit:contain';content.append(img);
    }else if(attachment.kind==='video'){
      const video=document.createElement('video');video.src=url;video.controls=true;video.playsInline=true;video.autoplay=true;video.style.cssText='width:100%;max-height:72vh;border-radius:20px;background:#000';content.append(video);
    }else if(attachment.kind==='audio'){
      const audio=document.createElement('audio');audio.src=url;audio.controls=true;audio.autoplay=true;audio.style.width='100%';content.append(audio);
    }else if(attachment.kind==='pdf'){
      const frame=document.createElement('iframe');frame.src=url;frame.title=attachment.file_name;frame.style.cssText='width:100%;height:72vh;border:0;border-radius:18px;background:white';content.append(frame);
    }else if(attachment.kind==='text'){
      const response=await fetch(url);if(!response.ok)throw new Error('Catatan teks tidak dapat dibuka.');const pre=document.createElement('pre');pre.textContent=await response.text();pre.style.cssText='line-height:1.7;padding:18px;border-radius:18px;background:rgba(0,0,0,.25);max-height:68vh;overflow:auto';content.append(pre);
    }else{
      const box=document.createElement('div');box.className='lock-screen';box.innerHTML='<div class="lock-screen__moon">⌑</div><h3></h3><p class="muted"></p>';box.querySelector('h3').textContent=attachment.file_name;box.querySelector('p').textContent=`${attachment.mime_type || 'File'} · ${formatBytes(attachment.size_bytes)}`;content.append(box);
    }
    const actions=document.createElement('div');actions.className='toolbar';actions.style.justifyContent='center';
    const download=document.createElement('button');download.type='button';download.className='button button--primary';download.textContent='Unduh file';download.onclick=async()=>{try{const link=document.createElement('a');link.href=await signedUrl(attachment.file_path,{download:true,force:true});link.download=attachment.file_name || '';link.click();}catch(error){toast(error.message,{type:'error'});}};
    actions.append(download);content.append(actions);
  }catch(error){content.innerHTML='';const errorBox=document.createElement('div');errorBox.className='empty-state';errorBox.textContent=error.message;content.append(errorBox);}
  return modal;
}
