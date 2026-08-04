import { ENTRY_TYPES } from '../config.js';
import { repository } from '../core/repository.js';
import { uploadEntryFile, removeFiles, signedUrl } from '../core/storage.js';
import { encryptPayload } from '../core/crypto.js';
import { events } from '../core/event-bus.js';
import { formatBytes, parseTags } from '../core/utils.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

export function openTypePicker({ onChoose } = {}) {
  const content=document.createElement('div');content.className='type-picker';
  for(const [type,config] of Object.entries(ENTRY_TYPES)){
    const button=document.createElement('button');button.type='button';button.innerHTML='<span class="type-picker__icon"></span><div><strong></strong><br><small></small></div>';button.querySelector('.type-picker__icon').textContent=config.icon;button.querySelector('strong').textContent=config.label;button.querySelector('small').textContent=config.hint;button.onclick=()=>{modal.close();onChoose?.(type);};content.append(button);
  }
  const modal=openModal({title:'Apa yang ingin kalian tambahkan?',content,className:'composer-picker'});return modal;
}

export function openComposer({ type='memory', entry=null, initialPeriodId=null, onSaved } = {}) {
  const definition=ENTRY_TYPES[type]||ENTRY_TYPES.memory;
  const wrapper=document.createElement('div');wrapper.className='composer';
  const form=document.createElement('form');form.className='composer';
  const files=[];const deletedAttachments=[];let recorder=null;let chunks=[];let recordingStarted=0;
  form.innerHTML=`
    <div class="composer-section">
      <div class="field"><label>Judul</label><input class="input" name="title" required maxlength="180" placeholder="Beri nama pada bagian semesta ini"></div>
      <div class="field"><label data-body-label>Isi atau cerita</label><textarea class="textarea" name="body" maxlength="100000" placeholder="Tulis dengan cara kalian sendiri…"></textarea></div>
    </div>
    <div class="form-grid">
      <div class="field"><label>Tanggal kejadian</label><input class="input" name="event_date" type="datetime-local"></div>
      <div class="field" data-unlock hidden><label>Tanggal dibuka</label><input class="input" name="unlock_at" type="datetime-local"></div>
      <div class="field"><label>Lokasi</label><input class="input" name="location" maxlength="300" placeholder="Opsional"></div>
      <div class="field"><label>Mood</label><input class="input" name="mood" maxlength="80" placeholder="Bahagia, rindu, tenang…"></div>
      <div class="field"><label>Cuaca</label><input class="input" name="weather" maxlength="80" placeholder="Cerah, hujan, berawan…"></div>
      <div class="field"><label>Tag</label><input class="input" name="tags" maxlength="500" placeholder="Pisahkan dengan koma"></div>
    </div>
    <div class="field composer-period-field"><label>Orbit Kenangan</label><select class="select" name="period_id"><option value="">Tanpa orbit / belum dikelompokkan</option></select><small class="muted" data-period-help>Pilih periode agar foto, video, musik, catatan, dan cerita tampil sebagai satu perjalanan.</small></div>
    <div class="form-grid" data-wish-fields hidden>
      <div class="field"><label>Progres</label><input class="input" name="progress" type="number" min="0" max="100" value="0"></div>
      <div class="field"><label>Status</label><select class="select" name="status"><option value="active">Direncanakan</option><option value="in_progress">Sedang dijalani</option><option value="completed">Sudah tercapai</option><option value="archived">Diarsipkan</option></select></div>
    </div>
    <div class="field" data-password-field hidden><label>Kata sandi tambahan</label><input class="input" name="password" type="password" minlength="4" autocomplete="new-password" placeholder="Kosongkan jika tidak perlu"><small class="muted">Isi akan dienkripsi di browser. Kata sandi tidak disimpan dan tidak bisa dipulihkan.</small></div>
    <label class="chip"><input name="favorite" type="checkbox"> Tandai sebagai favorit</label>
    <div class="composer-section music-thumbnail-picker" data-music-thumbnail hidden>
      <div class="music-thumbnail-copy"><strong>Thumbnail musik</strong><p class="muted" style="margin:.3rem 0 0">Pilih cover khusus yang tampil pada kartu lagu dan pemutar musik.</p></div>
      <div class="music-thumbnail-control">
        <div class="music-thumbnail-preview" data-thumbnail-preview><span>♫</span></div>
        <div class="toolbar"><label class="button button--ghost" style="cursor:pointer"><input type="file" accept="image/*" data-thumbnail-input hidden>Pilih thumbnail</label><button class="button button--ghost" type="button" data-thumbnail-clear>Hapus pilihan</button></div>
      </div>
    </div>
    <div class="composer-section"><div><strong>Lampiran</strong><p class="muted" style="margin:.3rem 0 0">Foto, video, musik, voice note, PDF, dokumen, teks, atau file lainnya.</p></div><label class="drop-zone" data-drop-zone><input type="file" name="files" multiple hidden><div><strong>Ketuk untuk memilih file</strong><p>Atau seret beberapa file ke sini. Maksimum per file mengikuti konfigurasi proyek.</p></div></label><div class="voice-recorder"><button class="button button--ghost" type="button" data-record>● Rekam voice note</button><span class="muted" data-record-status>Belum merekam</span></div><div class="upload-list" data-upload-list></div></div>
    <div class="toolbar" style="justify-content:flex-end"><button class="button button--ghost" type="button" data-cancel>Batal</button><button class="button button--primary" type="submit">${entry?'Simpan perubahan':'Tambahkan ke semesta'}</button></div>`;
  wrapper.append(form);
  const modal=openModal({title:`${entry?'Edit':'Tambah'} ${definition.label}`,content:wrapper,className:'composer-modal',onClose:()=>stopRecorder()});
  form.querySelector('[data-cancel]').onclick=()=>modal.close();
  configureFields();hydrate();bindFiles();bindThumbnail();renderFileList();loadPeriodOptions();renderThumbnail();

  function configureFields(){
    form.querySelector('[data-body-label]').textContent=type==='music'?'Cerita atau makna lagu':type==='wish'?'Deskripsi impian':type==='note'?'Isi catatan':type==='letter'?'Isi surat':type==='capsule'?'Pesan untuk masa depan':'Isi atau cerita';
    form.querySelector('[data-unlock]').hidden=type!=='capsule';if(type==='capsule')form.elements.unlock_at.required=true;
    form.querySelector('[data-wish-fields]').hidden=type!=='wish';
    form.querySelector('[data-password-field]').hidden=!['letter','capsule'].includes(type);
    form.querySelector('[data-music-thumbnail]').hidden=type!=='music';
  }
  function hydrate(){
    if(!entry){form.elements.period_id.dataset.selected=initialPeriodId||'';return;}form.elements.title.value=entry.title||'';form.elements.body.value=entry.body||'';form.elements.event_date.value=toLocal(entry.event_date);form.elements.unlock_at.value=toLocal(entry.unlock_at);form.elements.location.value=entry.location||'';form.elements.mood.value=entry.mood||'';form.elements.weather.value=entry.weather||'';form.elements.tags.value=(entry.tags||[]).join(', ');form.elements.favorite.checked=Boolean(entry.favorite);form.elements.progress.value=entry.progress||0;form.elements.status.value=entry.status||'active';form.elements.period_id.dataset.selected=entry.period_id||'';
  }

  async function loadPeriodOptions(){
    const select=form.elements.period_id;const help=form.querySelector('[data-period-help]');
    try{
      const periods=await repository.listPeriods();
      for(const period of periods){const option=document.createElement('option');option.value=period.id;option.textContent=period.title;select.append(option);}
      select.value=select.dataset.selected||'';
      if(!periods.length)help.textContent='Belum ada Orbit Kenangan. Simpan tanpa orbit atau buat orbit melalui menu Orbit Kenangan.';
    }catch(error){select.disabled=true;help.textContent='Aktifkan migrasi Orbit Kenangan terlebih dahulu agar pengelompokan periode tersedia.';}
  }
  function bindFiles(){
    const input=form.elements.files;const zone=form.querySelector('[data-drop-zone]');input.onchange=()=>addFiles([...input.files]);
    zone.addEventListener('dragover',event=>{event.preventDefault();zone.classList.add('is-dragging');});zone.addEventListener('dragleave',()=>zone.classList.remove('is-dragging'));zone.addEventListener('drop',event=>{event.preventDefault();zone.classList.remove('is-dragging');addFiles([...event.dataTransfer.files]);});
    form.querySelector('[data-record]').onclick=toggleRecording;
  }
  function addFiles(incoming,metadata={}){for(const file of incoming){if(!files.some(item=>item.file.name===file.name&&item.file.size===file.size&&item.metadata?.role===metadata.role))files.push({id:crypto.randomUUID(),file,progress:0,status:'ready',metadata:{...metadata}});}renderFileList();renderThumbnail();}
  function bindThumbnail(){
    if(type!=='music')return;
    const input=form.querySelector('[data-thumbnail-input]');
    input.onchange=()=>{
      const file=input.files?.[0];if(!file)return;
      if(!file.type.startsWith('image/')){toast('Thumbnail harus berupa gambar.',{type:'error'});return;}
      for(let i=files.length-1;i>=0;i--)if(files[i].metadata?.role==='thumbnail')files.splice(i,1);
      const existing=(entry?.attachments||[]).find(item=>item.metadata?.role==='thumbnail');
      if(existing&&!deletedAttachments.includes(existing.id))deletedAttachments.push(existing.id);
      addFiles([file],{role:'thumbnail'});input.value='';
    };
    form.querySelector('[data-thumbnail-clear]').onclick=()=>{
      for(let i=files.length-1;i>=0;i--)if(files[i].metadata?.role==='thumbnail')files.splice(i,1);
      const existing=(entry?.attachments||[]).find(item=>item.metadata?.role==='thumbnail');
      if(existing&&!deletedAttachments.includes(existing.id))deletedAttachments.push(existing.id);
      renderFileList();renderThumbnail();
    };
  }
  async function renderThumbnail(){
    if(type!=='music')return;
    const preview=form.querySelector('[data-thumbnail-preview]');if(!preview)return;
    preview.style.backgroundImage='';preview.innerHTML='<span>♫</span>';
    const pending=files.find(item=>item.metadata?.role==='thumbnail');
    if(pending){preview.style.backgroundImage=`url("${URL.createObjectURL(pending.file)}")`;preview.innerHTML='';return;}
    const existing=(entry?.attachments||[]).find(item=>item.metadata?.role==='thumbnail'&&!deletedAttachments.includes(item.id));
    if(existing){try{preview.style.backgroundImage=`url("${await signedUrl(existing.file_path)}")`;preview.innerHTML='';}catch{}}
  }
  function renderFileList(){
    const host=form.querySelector('[data-upload-list]');host.innerHTML='';
    for(const attachment of entry?.attachments||[]){if(deletedAttachments.includes(attachment.id))continue;const row=fileRow(attachment.file_name,formatBytes(attachment.size_bytes),attachment.metadata?.role==='thumbnail'?'Thumbnail tersimpan':'Tersimpan');const remove=row.querySelector('button');remove.onclick=()=>{deletedAttachments.push(attachment.id);renderFileList();renderThumbnail();};host.append(row);}
    for(const item of files){const row=fileRow(item.file.name,formatBytes(item.file.size),item.metadata?.role==='thumbnail'?'Thumbnail siap':item.status==='uploading'?`${item.progress}%`:item.status==='done'?'Terunggah':'Siap');const bar=document.createElement('div');bar.className='upload-progress';bar.innerHTML='<span></span>';bar.querySelector('span').style.width=`${item.progress}%`;row.querySelector('div:nth-child(2)').append(bar);row.querySelector('button').onclick=()=>{const index=files.indexOf(item);if(index>=0)files.splice(index,1);renderFileList();renderThumbnail();};host.append(row);}
    if(!host.children.length){const p=document.createElement('p');p.className='muted';p.textContent='Belum ada lampiran.';host.append(p);}
  }
  function fileRow(name,size,status){const row=document.createElement('div');row.className='upload-item';row.innerHTML='<span>⌑</span><div><div class="upload-item__name"></div><div class="upload-item__meta"></div></div><button class="icon-button" type="button" aria-label="Hapus">×</button>';row.querySelector('.upload-item__name').textContent=name;row.querySelector('.upload-item__meta').textContent=`${size} · ${status}`;return row;}
  async function toggleRecording(){
    const button=form.querySelector('[data-record]');const status=form.querySelector('[data-record-status]');
    if(recorder?.state==='recording'){recorder.stop();button.textContent='● Rekam voice note';status.textContent='Memproses rekaman…';return;}
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];recorder=new MediaRecorder(stream);recordingStarted=Date.now();recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});const file=new File([blob],`voice-note-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`,{type:blob.type});addFiles([file]);status.textContent=`Rekaman ${Math.max(1,Math.round((Date.now()-recordingStarted)/1000))} detik siap diunggah.`;};recorder.start();button.textContent='■ Hentikan rekaman';status.innerHTML='<span class="recording-dot"></span> Sedang merekam…';
    }catch(error){toast(`Mikrofon tidak dapat digunakan: ${error.message}`,{type:'error'});}
  }
  function stopRecorder(){if(recorder?.state==='recording')recorder.stop();}

  form.onsubmit=async event=>{
    event.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;const original=submit.textContent;
    try{
      const values=Object.fromEntries(new FormData(form));const password=String(values.password||'');const secretRequested=type==='capsule'||(type==='letter'&&password)||Boolean(entry?.metadata?.secret);
      const metadata={...(entry?.metadata||{}),secret:secretRequested,password_protected:Boolean(password)||Boolean(entry?.metadata?.password_protected)};
      const payload={type,title:values.title,body:secretRequested?null:values.body,event_date:toIso(values.event_date),unlock_at:type==='capsule'?toIso(values.unlock_at):null,period_id:values.period_id||null,location:values.location,mood:values.mood,weather:values.weather,tags:parseTags(values.tags),favorite:form.elements.favorite.checked,progress:type==='wish'?Number(values.progress||0):0,status:type==='wish'?values.status:'active',metadata};
      submit.textContent='Menyimpan tulisan…';const saved=entry?await repository.updateEntry(entry.id,payload):await repository.createEntry(payload);
      if(secretRequested&&String(values.body||'').trim()){
        submit.textContent='Mengunci isi…';const secretBody={body:String(values.body).trim()};if(password){await repository.setSecret(saved.id,{encryptedPayload:await encryptPayload(secretBody,password),passwordProtected:true});}else{await repository.setSecret(saved.id,{payload:secretBody,passwordProtected:false});}
      }
      if(deletedAttachments.length){submit.textContent='Menghapus lampiran lama…';for(const id of deletedAttachments){const old=entry.attachments.find(item=>item.id===id);if(old){await removeFiles([old.file_path]);await repository.deleteAttachment(id);}}}
      let order=(entry?.attachments?.length||0)-deletedAttachments.length;
      for(const item of files){item.status='uploading';renderFileList();submit.textContent=`Mengunggah ${item.file.name}…`;const uploaded=await uploadEntryFile({universeId:repository.universeId,entryId:saved.id,file:item.file,onProgress:value=>{item.progress=value;renderFileList();}});uploaded.metadata={...(item.metadata||{})};await repository.addAttachment(saved.id,uploaded,order++);item.progress=100;item.status='done';renderFileList();}
      events.emit('data:changed',{entryId:saved.id,type});toast(entry?'Perubahan tersimpan.':'Sebuah bagian baru telah lahir di semesta kalian.');modal.close();await onSaved?.(saved);
    }catch(error){toast(error.message,{type:'error',duration:6500});}
    finally{submit.disabled=false;submit.textContent=original;}
  };
  return modal;
}

function toLocal(value){if(!value)return'';const date=new Date(value);const pad=n=>String(n).padStart(2,'0');return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;}
function toIso(value){return value?new Date(value).toISOString():null;}
