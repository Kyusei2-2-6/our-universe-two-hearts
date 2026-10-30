import { state } from '../core/state.js';
import { repository } from '../core/repository.js';
import { detectFileKind,suggestedEntryType,uploadEntryFile,removeFiles } from '../core/storage.js';
import { notificationService } from '../core/notifications.js';
import { openModal } from './modal.js';
import { openPlanetComposer } from './planet-composer.js';
import { toast } from './toast.js';

const ACTIONS=[
  {key:'camera',icon:'◎',label:'Ambil foto',accept:'image/*',capture:'environment',multiple:false},
  {key:'gallery',icon:'▧',label:'Pilih foto',accept:'image/*',multiple:true},
  {key:'video',icon:'▶',label:'Pilih video',accept:'video/*',multiple:true},
  {key:'audio',icon:'♫',label:'Pilih audio',accept:'audio/*',multiple:true},
  {key:'file',icon:'⌑',label:'Pilih dokumen',accept:'.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.zip,.rar,.7z',multiple:true},
  {key:'write',icon:'✎',label:'Tulis sesuatu'}
];

const NOTEPAD_DRAFT_KEY='ou:notepad-draft:v1';
function readNotepadDraft(){try{const raw=localStorage.getItem(NOTEPAD_DRAFT_KEY);if(!raw)return null;const data=JSON.parse(raw);return data&&typeof data.b==='string'?data:null;}catch{return null;}}
function clearNotepadDraft(){try{localStorage.removeItem(NOTEPAD_DRAFT_KEY);}catch{}}

export async function openStoryComposer({planetId=null,onSaved}={}){
  let files=[];
  let previewUrls=[];
  let lastFileAction=ACTIONS.find(action=>action.key==='gallery');
  let chosenPlanet=planetId;
  let inferredType='memory';
  let planets=[];
  let saving=false;
  let bodyTimer=0;
  const shell=document.createElement('form');
  shell.className='story-composer';
  shell.innerHTML=`
    <header class="story-composer__header">
      <div><p class="eyebrow">UPDATE SEMESTA</p><h2>Tambahkan sesuatu.</h2></div>
      <button class="icon-button" type="button" data-close>×</button>
    </header>
    <div class="story-composer__scroll">
    <div class="story-composer__actions" data-actions aria-label="Pilih jenis isi"></div>
    <section class="story-composer__preview">
      <div class="story-composer__batch-toolbar" data-batch-toolbar hidden>
        <strong data-selected-count>0 file dipilih</strong>
        <div><button class="button button--ghost" type="button" data-add-more>＋ Tambah lagi</button><button class="button button--ghost" type="button" data-clear-files>Hapus semua</button></div>
      </div>
      <div data-preview-empty><span>✦</span><strong>Pilih foto, video, musik, dokumen, atau mulai menulis.</strong></div>
      <div data-preview-list></div>
    </section>
    <section class="story-composer__copy">
      <div class="field"><label>Judul</label><input class="input" name="title" maxlength="180" required placeholder="Beri nama pada momen ini"></div>
      <div class="field"><label>Cerita atau keterangan</label><textarea class="textarea" name="body" maxlength="100000" placeholder="Apa yang ingin kalian ingat?"></textarea></div>
      <button class="button button--ghost story-composer__open-notepad" type="button" data-open-notepad>✎ Buka notepad panjang</button>
      <div class="field"><label>Tanggal kejadian</label><input class="input" name="event_date" type="datetime-local"></div>
    </section>
    <section class="story-composer__destination">
      <div><p class="eyebrow">TUJUAN</p><h3>Kirim ke planet mana?</h3><p class="muted" data-suggestion>Jenis isi akan dideteksi otomatis.</p></div>
      <div class="destination-planets" data-planets></div>
      <button class="button button--ghost" type="button" data-new-planet>＋ Ciptakan planet baru</button>
    </section>
    <section class="story-composer__visibility">
      <label><input type="radio" name="visibility" value="permanent" checked><span><strong>Simpan permanen</strong><small>Masuk ke planet tanpa story 24 jam.</small></span></label>
      <label><input type="radio" name="visibility" value="both"><span><strong>Story + permanen</strong><small>Tampil sebagai story dan tetap tersimpan.</small></span></label>
      <label><input type="radio" name="visibility" value="story"><span><strong>Story 24 jam</strong><small>Isi dihapus otomatis setelah story kedaluwarsa.</small></span></label>
    </section>
    </div>
    <footer class="story-composer__footer"><span data-detected>Belum ada isi</span><button class="button button--primary" type="submit">Bagikan ke semesta</button></footer>`;

  const modal=openModal({title:'',content:shell,className:'story-composer-modal',onClose:()=>{clearTimeout(bodyTimer);clearPreviewUrls();},confirmClose:()=>{
    if(saving)return'Penyimpanan sedang berjalan. Tetap tutup layar ini?';
    const hasDraft=files.length>0||shell.elements.title.value.trim()||shell.elements.body.value.trim();
    return hasDraft?'Buang draft ini? Tulisan dan file yang sudah dipilih akan hilang.':null;
  }});
  const actionHost=shell.querySelector('[data-actions]');

  for(const action of ACTIONS){
    const button=document.createElement('button');
    button.type='button';
    button.dataset.action=action.key;
    button.innerHTML=`<span>${action.icon}</span><strong>${action.label}</strong>`;
    button.onclick=()=>{
      if(action.key==='write'){
        openWritingNotepad();
        return;
      }
      openFilePicker(action);
    };
    actionHost.append(button);
  }
  const batchHelp=document.createElement('p');
  batchHelp.className='story-composer__batch-help';
  batchHelp.textContent='Bisa pilih banyak file sekaligus. Jika pemilih file HP hanya memberi satu file, ketuk lagi. Pilihan sebelumnya tetap tersimpan.';
  actionHost.append(batchHelp);

  shell.querySelector('[data-add-more]').onclick=()=>openFilePicker(lastFileAction||ACTIONS[1]);
  shell.querySelector('[data-clear-files]').onclick=()=>{
    if(!files.length)return;
    files=[];
    inferredType=shell.elements.body.value.trim()?'note':'memory';
    renderPreview();
    renderPlanets();
    toast('Semua file dihapus dari draft.');
  };
  shell.querySelector('[data-open-notepad]').onclick=openWritingNotepad;
  shell.querySelector('[data-new-planet]').onclick=()=>openPlanetComposer({onSaved:async planet=>{
    planets=await repository.listPlanets();
    chosenPlanet=planet.id;
    renderPlanets();
  }});

  planets=await repository.listPlanets();
  renderPlanets();
  renderPreview();

  function openFilePicker(action){
    lastFileAction=action;
    const picker=document.createElement('input');
    picker.type='file';
    picker.accept=action.accept||'';
    picker.multiple=Boolean(action.multiple);
    if(action.multiple)picker.setAttribute('multiple','');
    picker.tabIndex=-1;
    picker.style.position='fixed';
    picker.style.left='-10000px';
    picker.style.width='1px';
    picker.style.height='1px';
    if(action.capture)picker.setAttribute('capture',action.capture);
    else picker.removeAttribute('capture');
    shell.append(picker);
    picker.addEventListener('change',()=>{
      const selected=[...(picker.files||[])];
      picker.remove();
      if(!selected.length)return;
      appendFiles(selected);
    },{once:true});
    picker.click();
    window.addEventListener('focus',()=>setTimeout(()=>{if(picker.isConnected&&!picker.files?.length)picker.remove();},900),{once:true});
  }

  function appendFiles(selected=[]){
    const known=new Set(files.map(fileIdentity));
    const added=[];
    for(const file of selected){
      const identity=fileIdentity(file);
      if(known.has(identity))continue;
      known.add(identity);
      added.push(file);
    }
    if(!added.length){
      toast('File yang dipilih sudah ada di draft.');
      return;
    }
    files=[...files,...added];
    inferredType=inferType(files);
    renderPreview();
    renderPlanets();
    toast(`${added.length} file ditambahkan. Total ${files.length} file.`,{type:'success'});
  }

  function removeFileAt(index){
    if(index<0||index>=files.length)return;
    files=files.filter((_,itemIndex)=>itemIndex!==index);
    inferredType=inferType(files);
    renderPreview();
    renderPlanets();
  }

  function clearPreviewUrls(){
    for(const url of previewUrls)URL.revokeObjectURL(url);
    previewUrls=[];
  }

  function openWritingNotepad(){
    const editor=document.createElement('form');
    editor.className='story-notepad';
    editor.innerHTML=`
      <div class="story-notepad__intro"><p class="eyebrow">CATATAN PANJANG</p><h3>Tulis ceritamu dengan tenang.</h3><p>Teks akan disimpan sebagai catatan di planet yang kamu pilih.</p></div>
      <div class="story-notepad__paper">
        <input name="note_title" maxlength="180" placeholder="Judul cerita">
        <textarea name="note_body" maxlength="100000" required placeholder="Mulai menulis di sini…"></textarea>
      </div>
      <div class="story-notepad__status"><span data-count>0 karakter</span><span>Draft tetap berada di layar ini sampai disimpan atau dibatalkan.</span></div>
      <div class="toolbar story-notepad__actions"><button class="button button--ghost" type="button" data-cancel>Batal</button><button class="button button--primary" type="submit">Gunakan tulisan ini</button></div>`;
    editor.elements.note_title.value=shell.elements.title.value||'';
    editor.elements.note_body.value=shell.elements.body.value||'';
    const count=editor.querySelector('[data-count]');
    const initialTitle=editor.elements.note_title.value;
    const initialBody=editor.elements.note_body.value;
    const leftover=readNotepadDraft();
    const restored=Boolean(leftover&&leftover.b&&!initialBody.trim());
    if(restored){editor.elements.note_body.value=leftover.b;if(leftover.t&&!initialTitle)editor.elements.note_title.value=leftover.t;}
    const syncCount=()=>count.textContent=`${editor.elements.note_body.value.length.toLocaleString('id-ID')} karakter`;
    editor.elements.note_body.addEventListener('input',syncCount);
    syncCount();
    let draftTimer=0;
    const saveDraft=()=>{try{localStorage.setItem(NOTEPAD_DRAFT_KEY,JSON.stringify({t:editor.elements.note_title.value,b:editor.elements.note_body.value,at:Date.now()}));}catch{}};
    const scheduleDraft=()=>{clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,900);};
    const flushDraft=()=>{if(document.visibilityState==='hidden'){clearTimeout(draftTimer);saveDraft();}};
    editor.elements.note_body.addEventListener('input',scheduleDraft);
    editor.elements.note_title.addEventListener('input',scheduleDraft);
    document.addEventListener('visibilitychange',flushDraft);
    const noteModal=openModal({title:'',content:editor,className:'story-notepad-modal',
      onClose:()=>{clearTimeout(draftTimer);document.removeEventListener('visibilitychange',flushDraft);clearNotepadDraft();},
      confirmClose:()=>(editor.elements.note_body.value!==initialBody||editor.elements.note_title.value!==initialTitle)?'Buang perubahan tulisan ini? Teks yang belum dipakai akan hilang.':null});
    if(restored)toast('Draft sebelumnya dipulihkan.');
    editor.querySelector('[data-cancel]').onclick=()=>noteModal.close();
    editor.onsubmit=event=>{
      event.preventDefault();
      const body=editor.elements.note_body.value.trim();
      if(!body){toast('Tuliskan isi catatan terlebih dahulu.',{type:'error'});return;}
      files=[];
      inferredType='note';
      shell.elements.body.value=body;
      if(editor.elements.note_title.value.trim())shell.elements.title.value=editor.elements.note_title.value.trim();
      else if(!shell.elements.title.value.trim())shell.elements.title.value=defaultTitle('note');
      noteModal.close();
      renderPreview();
      renderPlanets();
      toast('Tulisan masuk ke draft. Pilih planet lalu simpan.',{type:'success'});
    };
    setTimeout(()=>editor.elements.note_body.focus({preventScroll:true}),360);
  }

  function inferType(items){
    if(!items.length)return shell.elements.body.value.trim()?'note':'memory';
    const kinds=items.map(detectFileKind);
    if(kinds.every(kind=>kind==='image'||kind==='video'))return 'gallery';
    if(kinds.every(kind=>kind==='audio'))return 'music';
    if(kinds.every(kind=>['pdf','document','archive','text','other'].includes(kind)))return 'file';
    return suggestedEntryType(items[0]);
  }

  function renderPreview(){
    clearPreviewUrls();
    const empty=shell.querySelector('[data-preview-empty]');
    const list=shell.querySelector('[data-preview-list]');
    list.innerHTML='';
    const toolbar=shell.querySelector('[data-batch-toolbar]');
    toolbar.hidden=!files.length;
    shell.querySelector('[data-selected-count]').textContent=`${files.length} file dipilih`;
    empty.hidden=Boolean(files.length||shell.elements.body.value.trim());
    if(!files.length&&shell.elements.body.value.trim()){
      const note=document.createElement('article');
      note.className='story-preview story-preview--text';
      const fullText=shell.elements.body.value;
      note.textContent=fullText.length>1200?`${fullText.slice(0,1200).replace(/[\uD800-\uDBFF]$/,'')}…`:fullText;
      list.append(note);
    }
    for(const [index,file] of files.entries()){
      const card=document.createElement('article');
      card.className='story-preview';
      const kind=detectFileKind(file);
      if(kind==='image'||kind==='video'){
        const url=URL.createObjectURL(file);
        previewUrls.push(url);
        const media=document.createElement(kind==='image'?'img':'video');
        media.src=url;
        media.muted=true;
        if(kind==='video')media.playsInline=true;
        card.append(media);
      }else{
        card.innerHTML='<span></span><strong></strong><small></small>';
        card.querySelector('span').textContent=kindIcon(kind);
        card.querySelector('strong').textContent=file.name;
        card.querySelector('small').textContent=kind;
      }
      const remove=document.createElement('button');
      remove.type='button';
      remove.className='story-preview__remove';
      remove.setAttribute('aria-label',`Hapus ${file.name||`file ${index+1}`}`);
      remove.textContent='×';
      remove.onclick=()=>removeFileAt(index);
      card.append(remove);
      const number=document.createElement('span');
      number.className='story-preview__number';
      number.textContent=String(index+1);
      card.append(number);
      list.append(card);
    }
    shell.querySelector('[data-detected]').textContent=`Terdeteksi: ${typeLabel(inferredType)}${files.length?` · ${files.length} file`:''}`;
    if(!shell.elements.title.value&&files[0])shell.elements.title.value=files[0].name.replace(/\.[^.]+$/,'').slice(0,180);
  }

  function renderPlanets(){
    const host=shell.querySelector('[data-planets]');
    host.innerHTML='';
    const compatible=planets.filter(planet=>planet.mode==='free'||(planet.accepted_content_types||[]).includes(inferredType));
    const ordered=[...compatible,...planets.filter(planet=>!compatible.includes(planet))];
    if(!ordered.length){
      host.innerHTML='<p class="muted">Belum ada planet. Ciptakan planet pertama untuk melanjutkan.</p>';
      chosenPlanet=null;
      return;
    }
    if(!ordered.some(planet=>planet.id===chosenPlanet))chosenPlanet=ordered[0].id;
    shell.querySelector('[data-suggestion]').textContent=compatible.length?`Saran berdasarkan ${typeLabel(inferredType)}: ${compatible.slice(0,2).map(planet=>planet.name).join(', ')}`:'Pilih planet tujuan secara manual.';
    for(const planet of ordered){
      const button=document.createElement('button');
      button.type='button';
      button.className='destination-planet';
      button.style.setProperty('--planet-accent',planet.accent_color||'#7C8CFF');
      button.dataset.style=planet.planet_style||'ocean';
      button.innerHTML='<span class="destination-planet__sphere"></span><strong></strong><small></small>';
      button.querySelector('strong').textContent=planet.name;
      button.querySelector('small').textContent=(planet.accepted_content_types||[]).includes(inferredType)||planet.mode==='free'?'Cocok':'Tetap bisa dipilih';
      button.classList.toggle('is-selected',planet.id===chosenPlanet);
      button.onclick=()=>{chosenPlanet=planet.id;renderPlanets();};
      host.append(button);
    }
  }

  shell.elements.body.addEventListener('input',()=>{
    if(files.length)return;
    clearTimeout(bodyTimer);
    bodyTimer=setTimeout(()=>{
      if(files.length)return;
      if(inferredType!=='note'){inferredType='note';renderPlanets();}
      renderPreview();
    },350);
  });

  shell.onsubmit=async event=>{
    event.preventDefault();
    if(saving)return;
    saving=true;
    const submit=shell.querySelector('[type=submit]');
    const originalLabel=submit.textContent;
    const detected=shell.querySelector('[data-detected]');
    submit.disabled=true;
    submit.textContent='Menyimpan…';
    detected.textContent='Menyimpan isi ke planet…';
    const uploaded=[];
    let entry=null;
    try{
      if(!chosenPlanet)throw new Error('Ciptakan atau pilih planet tujuan terlebih dahulu.');
      if(!files.length&&!shell.elements.body.value.trim())throw new Error('Pilih file atau tulis sesuatu terlebih dahulu.');
      inferredType=inferType(files);
      entry=await repository.createEntry({
        type:inferredType,
        title:shell.elements.title.value||defaultTitle(inferredType),
        body:shell.elements.body.value,
        event_date:shell.elements.event_date.value?new Date(shell.elements.event_date.value).toISOString():new Date().toISOString(),
        metadata:{source:'story-composer-v4-9-1-multi-upload',detected_type:inferredType,file_count:files.length}
      });
      for(let index=0;index<files.length;index++){
        detected.textContent=`Mengunggah file ${index+1} dari ${files.length}…`;
        const record=await uploadEntryFile({universeId:state.get('universe').id,entryId:entry.id,file:files[index]});
        uploaded.push(record.path);
        await repository.addAttachment(entry.id,record,index);
      }
      await repository.addEntryToPlanet(chosenPlanet,entry.id);
      const visibility=shell.elements.visibility.value;
      if(visibility!=='permanent')await repository.createStory({planetId:chosenPlanet,entryId:entry.id,keepPermanently:visibility==='both'});
    }catch(error){
      if(entry){
        await removeFiles(uploaded).catch(()=>{});
        await repository.deleteEntry(entry.id).catch(()=>{});
      }
      detected.textContent=error.message;
      toast(error.message,{type:'error',duration:7000});
      saving=false;
      submit.disabled=false;
      submit.textContent=originalLabel;
      return;
    }
    notificationService.send('entry_created',{resourceId:entry.id}).catch(error=>console.warn('Notifikasi pasangan gagal:',error));
    toast('Berhasil disimpan. Halaman akan dimuat ulang.',{type:'success',duration:4500});
    modal.close();
    try{await onSaved?.(entry);}catch(error){console.warn('Penyegaran isi tertunda:',error);}
    window.dispatchEvent(new CustomEvent('our-universe:refresh',{detail:{source:'entry',id:entry.id,planetId:chosenPlanet,message:'Isi baru berhasil disimpan.'}}));
  };
  return modal;
}

function fileIdentity(file){return [file.name||'',file.size||0,file.lastModified||0,file.type||''].join('::');}
function kindIcon(kind){return({audio:'♫',pdf:'PDF',document:'DOC',archive:'ZIP',text:'TXT',other:'⌑'})[kind]||'⌑';}
function typeLabel(type){return({gallery:'foto/video',music:'musik/audio',file:'dokumen',note:'catatan',memory:'kenangan'})[type]||type;}
function defaultTitle(type){return `${typeLabel(type)} · ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}`;}
