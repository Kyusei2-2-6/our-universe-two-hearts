import { state } from '../core/state.js';
import { auth } from '../core/auth.js';
import { uploadAvatar, signedUrl } from '../core/storage.js';
import { initials } from '../core/utils.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

export function openProfileMenu({ onRefresh, onNavigate, onSignOut } = {}) {
  const snapshot=state.snapshot;const content=document.createElement('div');content.className='profile-menu';
  const summary=document.createElement('div');summary.className='profile-summary';summary.innerHTML='<div class="profile-summary__avatar"></div><div><strong></strong><p class="muted" style="margin:.3rem 0 0"></p></div>';
  summary.querySelector('strong').textContent=snapshot.profile?.display_name||snapshot.user?.email||'Seseorang';summary.querySelector('p').textContent=snapshot.universe?.name||'Our Universe';
  const avatar=summary.querySelector('.profile-summary__avatar');avatar.textContent=initials(snapshot.profile?.display_name);if(snapshot.profile?.avatar_path)signedUrl(snapshot.profile.avatar_path).then(url=>{avatar.innerHTML='';const img=document.createElement('img');img.src=url;img.alt='';avatar.append(img);}).catch(()=>{});
  const memberCount=snapshot.members?.length||0;const invite=document.createElement('div');invite.className='invite-code';
  if(memberCount<2){invite.innerHTML='<div><small class="muted">Kode untuk pasangan</small><br><code></code></div><button class="button button--ghost" type="button">Salin</button>';invite.querySelector('code').textContent=snapshot.universe?.invite_code||'-';invite.querySelector('button').onclick=async()=>{await navigator.clipboard.writeText(snapshot.universe?.invite_code||'');toast('Kode undangan disalin.');};}
  else invite.innerHTML='<div><strong>Semesta sudah lengkap</strong><br><small class="muted">Dua dari dua penjaga telah bergabung.</small></div><span>♡</span>';
  const actions=document.createElement('div');actions.className='toolbar';
  const studio=button('＋ Universe Studio');studio.onclick=()=>{modal.close();onNavigate?.('studio');};
  const settings=button('⚙ Pengaturan');settings.onclick=()=>{modal.close();onNavigate?.('settings');};
  const edit=button('✎ Edit profil');edit.onclick=()=>openProfileEditor({onRefresh});
  const logout=button('Keluar','button--danger');logout.onclick=async()=>{logout.disabled=true;try{await auth.signOut();modal.close();await onSignOut?.();}catch(error){toast(error.message,{type:'error'});}finally{logout.disabled=false;}};
  actions.append(studio,settings,edit,logout);content.append(summary,invite,actions);
  const modal=openModal({title:'Kalian di semesta ini',content});return modal;
}

function button(label,variant='button--ghost'){const node=document.createElement('button');node.type='button';node.className=`button ${variant}`;node.textContent=label;return node;}

function openProfileEditor({onRefresh}={}){
  const snapshot=state.snapshot;const form=document.createElement('form');form.className='auth-form';form.innerHTML='<div class="field"><label>Nama tampilan</label><input class="input" name="display_name" required maxlength="80"></div><div class="field"><label>Bio singkat</label><textarea class="textarea" name="bio" maxlength="500"></textarea></div><div class="field"><label>Foto profil</label><input class="input" name="avatar" type="file" accept="image/*"></div><button class="button button--primary" type="submit">Simpan profil</button>';
  form.elements.display_name.value=snapshot.profile?.display_name||'';form.elements.bio.value=snapshot.profile?.bio||'';
  const modal=openModal({title:'Edit profil',content:form});form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{let avatarPath=snapshot.profile?.avatar_path||null;const file=form.elements.avatar.files[0];if(file)avatarPath=await uploadAvatar({universeId:snapshot.universe.id,userId:snapshot.user.id,file});await auth.updateProfile({display_name:form.elements.display_name.value,bio:form.elements.bio.value,avatar_path:avatarPath,accent:snapshot.profile?.accent});toast('Profil diperbarui.');modal.close();await onRefresh?.();}catch(error){toast(error.message,{type:'error'});}finally{button.disabled=false;}};
}
