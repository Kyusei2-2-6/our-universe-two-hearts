import { state } from '../core/state.js';
import { repository } from '../core/repository.js';
import { detectFileKind,suggestedEntryType,uploadEntryFile,removeFiles } from '../core/storage.js';
import { notificationService } from '../core/notifications.js';
import { openModal } from './modal.js';
import { openPlanetComposer } from './planet-composer.js';
import { toast } from './toast.js';

const ACTIONS=[
  ['camera','◎','Ambil foto','image/*','environment'],
  ['gallery','▧','Pilih foto','image/*',''],
  ['video','▶','Pilih video','video/*','environment'],
  ['audio','♫','Pilih audio','audio/*',''],
  ['file','⌑','Pilih dokumen','.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.zip,.rar,.7z',''],
  ['write','✎','Tulis sesuatu','','']
];

export async function openStoryComposer({planetId=null,onSaved}={}){
  let files=[];let chosenPlanet=planetId;let inferredType='memory';let planets=[];
  const shell=document.createElement('form');shell.className='story-composer';
  shell.innerHTML=`<header class="story-composer__header"><div><p class="eyebrow">UPDATE SEMESTA</p><h2>Tambahkan sesuatu.</h2></div><button class="icon-button" type="button" data-close>×</button></header>
  <div class="story-composer__actions" data-actions></div>
  <input data-file-input type="file" multiple hidden>
  <section class="story-composer__preview"><div data-preview-empty><span>✦</span><strong>Pilih foto, video, musik, dokumen, atau mulai menulis.</strong></div><div data-preview-list></div></section>
  <section class="story-composer__copy"><div class="field"><label>Judul</label><input class="input" name="title" maxlength="180" required placeholder="Beri nama pada momen ini"></div><div class="field"><label>Cerita atau keterangan</label><textarea class="textarea" name="body" maxlength="100000" placeholder="Apa yang ingin kalian ingat?"></textarea></div><div class="field"><label>Tanggal kejadian</label><input class="input" name="event_date" type="datetime-local"></div></section>
  <section class="story-composer__destination"><div><p class="eyebrow">TUJUAN</p><h3>Kirim ke planet mana?</h3><p class="muted" data-suggestion>Jenis isi akan dideteksi otomatis.</p></div><div class="destination-planets" data-planets></div><button class="button button--ghost" type="button" data-new-planet>＋ Ciptakan planet baru</button></section>
  <section class="story-composer__visibility"><label><input type="radio" name="visibility" value="permanent" checked><span><strong>Simpan permanen</strong><small>Masuk ke planet tanpa story 24 jam.</small></span></label><label><input type="radio" name="visibility" value="both"><span><strong>Story + permanen</strong><small>Tampil sebagai story dan tetap tersimpan.</small></span></label><label><input type="radio" name="visibility" value="story"><span><strong>Story 24 jam</strong><small>Isi dihapus otomatis setelah story kedaluwarsa.</small></span></label></section>
  <footer class="story-composer__footer"><span data-detected>Belum ada isi</span><button class="button button--primary" type="submit">Bagikan ke semesta</button></footer>`;
  const modal=openModal({title:'',content:shell,className:'story-composer-modal'});shell.querySelector('[data-close]').onclick=()=>modal.close();
  const actionHost=shell.querySelector('[data-actions]');const fileInput=shell.querySelector('[data-file-input]');
  for(const [key,icon,label,accept,capture] of ACTIONS){const button=document.createElement('button');button.type='button';button.innerHTML=`<span>${icon}</span><strong>${label}</strong>`;button.onclick=()=>{if(key==='write'){files=[];inferredType='note';renderPreview();shell.elements.title.focus();return;}fileInput.accept=accept;fileInput.capture=capture||'';fileInput.multiple=!['camera','video'].includes(key);fileInput.click();};actionHost.append(button);}
  fileInput.onchange=()=>{files=[...fileInput.files];inferredType=inferType(files);renderPreview();renderPlanets();};
  shell.querySelector('[data-new-planet]').onclick=()=>openPlanetComposer({onSaved:async planet=>{planets=await repository.listPlanets();chosenPlanet=planet.id;renderPlanets();}});
  planets=await repository.listPlanets();renderPlanets();renderPreview();

  function inferType(items){if(!items.length)return shell.elements.body.value.trim()?'note':'memory';const kinds=items.map(detectFileKind);if(kinds.every(k=>k==='image'||k==='video'))return 'gallery';if(kinds.every(k=>k==='audio'))return 'music';if(kinds.every(k=>['pdf','document','archive','text','other'].includes(k)))return 'file';return suggestedEntryType(items[0]);}
  function renderPreview(){const empty=shell.querySelector('[data-preview-empty]');const list=shell.querySelector('[data-preview-list]');list.innerHTML='';empty.hidden=Boolean(files.length||shell.elements.body.value.trim());if(!files.length&&shell.elements.body.value.trim()){const note=document.createElement('article');note.className='story-preview story-preview--text';note.textContent=shell.elements.body.value;list.append(note);}for(const file of files){const card=document.createElement('article');card.className='story-preview';const kind=detectFileKind(file);if(kind==='image'||kind==='video'){const url=URL.createObjectURL(file);const media=document.createElement(kind==='image'?'img':'video');media.src=url;media.muted=true;if(kind==='video')media.playsInline=true;card.append(media);}else card.innerHTML=`<span>${kindIcon(kind)}</span><strong></strong><small></small>`,card.querySelector('strong').textContent=file.name,card.querySelector('small').textContent=kind;list.append(card);}shell.querySelector('[data-detected]').textContent=`Terdeteksi: ${typeLabel(inferredType)}${files.length?` · ${files.length} file`:''}`;if(!shell.elements.title.value&&files[0])shell.elements.title.value=files[0].name.replace(/\.[^.]+$/,'').slice(0,180);}
  function renderPlanets(){const host=shell.querySelector('[data-planets]');host.innerHTML='';const compatible=planets.filter(p=>p.mode==='free'||(p.accepted_content_types||[]).includes(inferredType));const ordered=[...compatible,...planets.filter(p=>!compatible.includes(p))];if(!ordered.length){host.innerHTML='<p class="muted">Belum ada planet. Ciptakan planet pertama untuk melanjutkan.</p>';chosenPlanet=null;return;}if(!ordered.some(p=>p.id===chosenPlanet))chosenPlanet=ordered[0].id;shell.querySelector('[data-suggestion]').textContent=compatible.length?`Saran berdasarkan ${typeLabel(inferredType)}: ${compatible.slice(0,2).map(p=>p.name).join(', ')}`:'Pilih planet tujuan secara manual.';for(const planet of ordered){const button=document.createElement('button');button.type='button';button.className='destination-planet';button.style.setProperty('--planet-accent',planet.accent_color||'#7C8CFF');button.dataset.style=planet.planet_style||'ocean';button.innerHTML='<span class="destination-planet__sphere"></span><strong></strong><small></small>';button.querySelector('strong').textContent=planet.name;button.querySelector('small').textContent=(planet.accepted_content_types||[]).includes(inferredType)||planet.mode==='free'?'Cocok':'Tetap bisa dipilih';button.classList.toggle('is-selected',planet.id===chosenPlanet);button.onclick=()=>{chosenPlanet=planet.id;renderPlanets();};host.append(button);}}
  shell.elements.body.addEventListener('input',()=>{if(!files.length){inferredType='note';renderPreview();renderPlanets();}});
  shell.onsubmit=async event=>{
    event.preventDefault();
    const submit=shell.querySelector('[type=submit]');const originalLabel=submit.textContent;const detected=shell.querySelector('[data-detected]');submit.disabled=true;submit.textContent='Menyimpan…';detected.textContent='Menyimpan isi ke planet…';
    const uploaded=[];let entry=null;
    try{
      if(!chosenPlanet)throw new Error('Ciptakan atau pilih planet tujuan terlebih dahulu.');
      if(!files.length&&!shell.elements.body.value.trim())throw new Error('Pilih file atau tulis sesuatu terlebih dahulu.');
      inferredType=inferType(files);
      entry=await repository.createEntry({type:inferredType,title:shell.elements.title.value||defaultTitle(inferredType),body:shell.elements.body.value,event_date:shell.elements.event_date.value?new Date(shell.elements.event_date.value).toISOString():new Date().toISOString(),metadata:{source:'story-composer-v4',detected_type:inferredType}});
      for(let i=0;i<files.length;i++){detected.textContent=`Mengunggah file ${i+1} dari ${files.length}…`;const record=await uploadEntryFile({universeId:state.get('universe').id,entryId:entry.id,file:files[i]});uploaded.push(record.path);await repository.addAttachment(entry.id,record,i);}
      await repository.addEntryToPlanet(chosenPlanet,entry.id);
      const visibility=shell.elements.visibility.value;if(visibility!=='permanent')await repository.createStory({planetId:chosenPlanet,entryId:entry.id,keepPermanently:visibility==='both'});
    }catch(error){
      if(entry){await removeFiles(uploaded).catch(()=>{});await repository.deleteEntry(entry.id).catch(()=>{});}
      detected.textContent=error.message;toast(error.message,{type:'error',duration:7000});submit.disabled=false;submit.textContent=originalLabel;return;
    }
    notificationService.send('entry_created',{resourceId:entry.id}).catch(error=>console.warn('Notifikasi pasangan gagal:',error));
    toast('Berhasil disimpan. Isi planet sedang diperbarui.',{type:'success',duration:4500});modal.close();
    try{await onSaved?.(entry);}catch(error){console.warn('Penyegaran isi tertunda:',error);}
    window.dispatchEvent(new CustomEvent('our-universe:refresh',{detail:{source:'entry',id:entry.id,planetId:chosenPlanet}}));
  };
  return modal;
}
function kindIcon(kind){return({audio:'♫',pdf:'PDF',document:'DOC',archive:'ZIP',text:'TXT',other:'⌑'})[kind]||'⌑';}
function typeLabel(type){return({gallery:'foto/video',music:'musik/audio',file:'dokumen',note:'catatan',memory:'kenangan'})[type]||type;}
function defaultTitle(type){return `${typeLabel(type)} · ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}`;}
