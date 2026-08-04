import { repository } from '../core/repository.js';
import { formatDateTime } from '../core/utils.js';
import { toast } from './toast.js';
import { notificationService } from '../core/notifications.js';

const EMOJIS=['❤️','✨','🥺','🌙','🫶'];

export function renderSocialSection(entry, { profileMap, onChanged } = {}) {
  const section=document.createElement('section');section.className='world-panel glass-panel';
  const title=document.createElement('h3');title.textContent='Ruang untuk kalian berdua';
  const reactions=document.createElement('div');reactions.className='reaction-bar';
  for(const emoji of EMOJIS){
    const mine=entry.reactions?.some(item=>item.user_id===repository.userId&&item.emoji===emoji);
    const count=entry.reactions?.filter(item=>item.emoji===emoji).length||0;
    const button=document.createElement('button');button.type='button';button.className=`reaction-button${mine?' is-active':''}`;button.textContent=`${emoji} ${count||''}`.trim();
    button.onclick=async()=>{button.disabled=true;try{const result=await repository.toggleReaction(entry.id,emoji);if(result.active&&result.id)notificationService.send('reaction_created',{resourceId:result.id}).catch(error=>console.warn('Notifikasi reaksi gagal:',error));await onChanged?.();}catch(error){toast(error.message,{type:'error'});}finally{button.disabled=false;}};reactions.append(button);
  }
  const list=document.createElement('div');list.className='comment-list';
  for(const comment of entry.comments||[]){
    const item=document.createElement('article');item.className='comment';const name=profileMap.get(comment.user_id)?.display_name||'Seseorang';
    item.innerHTML='<div class="comment__head"><strong></strong><span></span></div><p></p>';item.querySelector('strong').textContent=name;item.querySelector('span').textContent=formatDateTime(comment.created_at);item.querySelector('p').textContent=comment.body;
    if(comment.user_id===repository.userId){const remove=document.createElement('button');remove.type='button';remove.className='link-button';remove.textContent='Hapus';remove.onclick=async()=>{try{await repository.deleteComment(comment.id);await onChanged?.();}catch(error){toast(error.message,{type:'error'});}};item.querySelector('.comment__head').append(remove);}list.append(item);
  }
  if(!entry.comments?.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Belum ada komentar. Tulis sesuatu yang hanya kalian berdua pahami.';list.append(empty);}
  const form=document.createElement('form');form.className='comment-form';form.innerHTML='<input class="input" name="body" maxlength="5000" required placeholder="Tambahkan komentar untuk pasangan…"><button class="button button--primary" type="submit">Kirim</button>';
  form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const comment=await repository.addComment(entry.id,new FormData(form).get('body'));notificationService.send('comment_created',{resourceId:comment.id}).catch(error=>console.warn('Notifikasi komentar gagal:',error));form.reset();await onChanged?.();}catch(error){toast(error.message,{type:'error'});}finally{button.disabled=false;}};
  section.append(title,reactions,list,form);return section;
}
