import { ENTRY_TYPES } from '../config.js';
import { state } from '../core/state.js';
import { repository } from '../core/repository.js';
import { removeFiles } from '../core/storage.js';
import { decryptPayload } from '../core/crypto.js';
import { formatDate, formatDateTime, formatBytes, initials } from '../core/utils.js';
import { createEntryCard } from '../components/entry-card.js';
import { openComposer } from '../components/composer.js';
import { openAttachment } from '../components/media-viewer.js';
import { renderSocialSection } from '../components/comments.js';
import { confirmAction } from '../components/confirm.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { createMemoryViewer } from '../components/memory-viewer.js';

export function profileMap() {
  return new Map((state.get('members') || []).map(member => [member.user_id, member.profile]));
}

export function worldHeader({ eyebrow='OUR UNIVERSE', title, subtitle, actions=[] }) {
  const header=document.createElement('header');header.className='world-header';
  const copy=document.createElement('div');copy.innerHTML='<p class="eyebrow"></p><h2></h2><p class="muted" style="max-width:680px;line-height:1.65"></p>';copy.querySelector('.eyebrow').textContent=eyebrow;copy.querySelector('h2').textContent=title;copy.querySelector('.muted').textContent=subtitle;
  const actionHost=document.createElement('div');actionHost.className='section-actions';for(const action of actions){const button=document.createElement('button');button.type='button';button.className=`button ${action.primary?'button--primary':'button--ghost'}`;button.textContent=action.label;button.onclick=action.onClick;actionHost.append(button);}header.append(copy,actionHost);return header;
}

export async function renderCollection(container, { type, title, subtitle, emptyTitle, emptyText, eyebrow, filter } = {}) {
  container.innerHTML='';container.append(worldHeader({eyebrow,title,subtitle,actions:[{label:`＋ Tambah ${ENTRY_TYPES[type]?.label||''}`,primary:true,onClick:()=>openComposer({type,onSaved:()=>renderCollection(container,{type,title,subtitle,emptyTitle,emptyText,eyebrow,filter})})}]}));
  const toolbar=document.createElement('div');toolbar.className='toolbar';toolbar.innerHTML='<input class="input" style="max-width:420px" type="search" placeholder="Cari di bagian ini…"><button class="button button--ghost" type="button" data-favorites>Favorit saja</button>';
  container.append(toolbar);const grid=document.createElement('div');grid.className='content-grid';container.append(grid);
  let favorites=false;let query='';
  async function load(){grid.innerHTML='<div class="skeleton" style="grid-column:1/-1;min-height:280px;border-radius:28px"></div>';try{let entries=await repository.listEntries({type,query,favorite:favorites?true:undefined});if(filter)entries=entries.filter(filter);grid.innerHTML='';if(!entries.length){grid.append(emptyState(emptyTitle||`Belum ada ${ENTRY_TYPES[type]?.plural||'isi'}`,emptyText||'Tambahkan sesuatu dan biarkan semesta kalian mulai tumbuh.',()=>openComposer({type,onSaved:load})));return;}const map=profileMap();for(const entry of entries)grid.append(createEntryCard(entry,{profileMap:map,onOpen:(item,origin)=>openEntryDetail(item,{onChanged:load,origin}),onEdit:item=>openComposer({type:item.type,entry:item,onSaved:load}),onDelete:item=>deleteEntry(item,load)}));}catch(error){grid.innerHTML='';const node=emptyState('Bagian ini belum bisa dibuka',error.message);grid.append(node);}}
  toolbar.querySelector('input').addEventListener('input',event=>{query=event.target.value.trim();clearTimeout(toolbar._timer);toolbar._timer=setTimeout(load,280);});toolbar.querySelector('[data-favorites]').onclick=event=>{favorites=!favorites;event.currentTarget.classList.toggle('button--primary',favorites);load();};await load();
}

export function emptyState(title,text,onAction){const node=document.createElement('section');node.className='empty-state glass-panel';node.style.borderRadius='28px';node.innerHTML='<div style="font-size:3rem;margin-bottom:12px">✦</div><h3></h3><p style="max-width:540px;margin:8px auto 20px;line-height:1.65"></p>';node.querySelector('h3').textContent=title;node.querySelector('p').textContent=text;if(onAction){const button=document.createElement('button');button.type='button';button.className='button button--primary';button.textContent='Tambahkan ke semesta';button.onclick=onAction;node.append(button);}return node;}

export async function deleteEntry(entry,onChanged){const ok=await confirmAction({title:'Hapus dari semesta?',message:`“${entry.title}” beserta seluruh lampirannya akan dihapus untuk kalian berdua. Tindakan ini tidak dapat dibatalkan.`,confirmLabel:'Hapus selamanya',danger:true});if(!ok)return;try{await removeFiles((entry.attachments||[]).map(item=>item.file_path));await repository.deleteEntry(entry.id);toast('Isi telah dihapus dari semesta.');await onChanged?.();}catch(error){toast(error.message,{type:'error'});}}

export async function openEntryDetail(entry,{onChanged,origin=null}={}){
  const content=document.createElement('div');content.className='entry-detail memory-detail-root';content.innerHTML='<div class="skeleton" style="min-height:min(76vh,720px);border-radius:30px"></div>';
  const modal=openModal({title:'',content,className:'entry-modal memory-experience-modal',origin});
  async function render(){
    try{
      const fresh=await repository.getEntry(entry.id);content.innerHTML='';
      const map=profileMap();const creator=map.get(fresh.created_by)?.display_name||'Seseorang';
      const actions=document.createElement('div');actions.className='toolbar';
      const edit=actionButton('✎ Edit');edit.onclick=()=>openComposer({type:fresh.type,entry:fresh,onSaved:async()=>{await render();await onChanged?.();}});
      const favorite=actionButton(fresh.favorite?'♥ Favorit':'♡ Jadikan favorit');favorite.onclick=async()=>{await repository.updateEntry(fresh.id,{favorite:!fresh.favorite});await render();await onChanged?.();};
      const remove=actionButton('× Hapus','button--danger');remove.onclick=async()=>{await deleteEntry(fresh,async()=>{modal.close();await onChanged?.();});};actions.append(edit,favorite,remove);

      const meta=[];
      if(fresh.event_date)meta.push(`◷ ${formatDate(fresh.event_date)}`);
      if(fresh.location)meta.push(`⌖ ${fresh.location}`);
      if(fresh.mood)meta.push(`♡ ${fresh.mood}`);
      if(fresh.weather)meta.push(`☁ ${fresh.weather}`);
      for(const tag of fresh.tags||[])meta.push(`#${tag}`);
      if(fresh.type==='wish')meta.push(`${fresh.progress||0}% · ${statusLabel(fresh.status)}`);

      const locked=fresh.type==='capsule'&&fresh.unlock_at&&new Date(fresh.unlock_at)>new Date();
      let body='';let lockedContent=null;const extraContent=[];
      if(locked)lockedContent=renderLockedCapsule(fresh);
      else{
        body=await resolveBody(fresh);
        if(fresh.type==='wish')extraContent.push(progressPanel(fresh));
      }
      const socialContent=renderSocialSection(fresh,{profileMap:map,onChanged:render});
      const viewer=await createMemoryViewer({entry:fresh,body,creator,dateLabel:formatDateTime(fresh.created_at),meta,actions,lockedContent,extraContent,socialContent});
      content.append(viewer);
    }catch(error){content.innerHTML='';content.append(emptyState('Tidak dapat membuka isi ini',error.message));}
  }
  await render();return modal;
}

async function resolveBody(entry){if(!entry.metadata?.secret)return entry.body||'';const secret=await repository.getSecret(entry.id);if(!secret)return'';if(!secret.password_protected)return secret.payload?.body||'';return new Promise(resolve=>{const form=document.createElement('form');form.className='auth-form';form.innerHTML='<div class="lock-screen"><div class="lock-screen__moon">☾</div><h3>Surat ini memiliki kunci tambahan.</h3><p class="muted">Masukkan kata sandi yang dibuat saat surat disimpan.</p></div><div class="field"><label>Kata sandi</label><input class="input" name="password" type="password" required autofocus></div><button class="button button--primary" type="submit">Buka surat</button>';const modal=openModal({title:'Surat terkunci',content:form,onClose:()=>resolve('')});form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const payload=await decryptPayload(secret.encrypted_payload,form.elements.password.value);modal.close();resolve(payload.body||'');}catch(error){toast(error.message,{type:'error'});button.disabled=false;}};});}
function renderLockedCapsule(entry){const box=document.createElement('section');box.className='lock-screen';box.innerHTML='<div class="lock-screen__moon soft-float">☾</div><h3>Kapsul waktu masih terkunci.</h3><p class="muted"></p><div class="countdown"></div>';box.querySelector('p').textContent=`Semesta akan membuka isinya pada ${formatDateTime(entry.unlock_at)}.`;const host=box.querySelector('.countdown');const tick=()=>{const ms=Math.max(0,new Date(entry.unlock_at)-new Date());const days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000),minutes=Math.floor(ms%3600000/60000),seconds=Math.floor(ms%60000/1000);host.innerHTML='';for(const [value,label] of [[days,'Hari'],[hours,'Jam'],[minutes,'Menit'],[seconds,'Detik']]){const cell=document.createElement('div');cell.innerHTML='<strong></strong><span></span>';cell.querySelector('strong').textContent=String(value).padStart(2,'0');cell.querySelector('span').textContent=label;host.append(cell);}if(ms<=0)location.reload();};tick();const timer=setInterval(tick,1000);box.addEventListener('DOMNodeRemoved',()=>clearInterval(timer),{once:true});return box;}
function progressPanel(entry){const panel=document.createElement('section');panel.className='world-panel glass-panel';panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px"><strong>Perjalanan menuju impian</strong><span></span></div><div class="progress" style="margin-top:12px"><span></span></div>';panel.querySelector('div span').textContent=`${entry.progress||0}%`;panel.querySelector('.progress span').style.width=`${entry.progress||0}%`;return panel;}
function attachmentCard(attachment){const card=document.createElement('article');card.className='attachment-card';const file=document.createElement('button');file.type='button';file.className='attachment-card__file';file.style.cssText='width:100%;border:0;color:inherit;background:transparent;cursor:pointer';file.innerHTML='<span></span><strong></strong><small></small>';file.querySelector('span').textContent=kindIcon(attachment.kind);file.querySelector('strong').textContent=attachment.file_name;file.querySelector('small').textContent=`${attachment.mime_type||attachment.kind} · ${formatBytes(attachment.size_bytes)}`;file.onclick=()=>openAttachment(attachment);card.append(file);return card;}
function kindIcon(kind){return({image:'▧',video:'▶',audio:'♫',pdf:'PDF',text:'TXT',document:'DOC',archive:'ZIP',other:'⌑'})[kind]||'⌑';}
function chip(text){const node=document.createElement('span');node.className='chip';node.textContent=text;return node;}
function actionButton(text,variant='button--ghost'){const button=document.createElement('button');button.type='button';button.className=`button ${variant}`;button.textContent=text;return button;}
function statusLabel(value){return({active:'Direncanakan',in_progress:'Sedang dijalani',completed:'Tercapai',archived:'Diarsipkan'})[value]||value;}
