import { ENTRY_TYPES } from '../config.js';
import { state } from '../core/state.js';
import { repository } from '../core/repository.js';
import { uploadPlanetCover,removeFiles,signedUrl } from '../core/storage.js';
import { openModal } from './modal.js';
import { confirmAction } from './confirm.js';
import { toast } from './toast.js';

const STYLES=[['ocean','Samudra biru'],['ember','Planet bara'],['aurora','Aurora'],['rose','Rose cosmos'],['ice','Planet es'],['forest','Dunia hijau'],['desert','Gurun emas'],['lunar','Bulan gelap'],['violet','Violet dream']];

export function openPlanetComposer({planet=null,onSaved,onDeleted}={}){
  const form=document.createElement('form');form.className='planet-composer';
  form.innerHTML=`
  <section class="planet-composer__preview" data-style="${planet?.planet_style||'ocean'}" style="--planet-accent:${planet?.accent_color||'#7C8CFF'}"><div class="planet-preview__halo"></div><div class="planet-preview__sphere"><span></span></div><p data-preview-name></p></section>
  <section class="planet-composer__form">
    <div class="field"><label>Nama planet</label><input class="input" name="name" maxlength="120" required placeholder="Contoh: Gallery Berdua"></div>
    <div class="field"><label>Deskripsi</label><textarea class="textarea" name="description" maxlength="3000" placeholder="Apa yang akan kalian simpan di dunia ini?"></textarea></div>
    <div class="form-grid"><div class="field"><label>Gaya planet</label><select class="select" name="planet_style"></select></div><div class="field"><label>Warna atmosfer</label><input class="input color-input" name="accent_color" type="color"></div></div>
    <div class="field"><label>Cover opsional</label><input class="input" name="cover" type="file" accept="image/*"><small class="muted">Cover hanya memengaruhi permukaan planet ini.</small></div>
    <fieldset class="planet-mode"><legend>Jenis planet</legend><label><input type="radio" name="mode" value="free" checked><span><strong>Bebas</strong><small>Menerima semua jenis isi.</small></span></label><label><input type="radio" name="mode" value="mixed"><span><strong>Campuran</strong><small>Pilih beberapa jenis isi.</small></span></label><label><input type="radio" name="mode" value="special"><span><strong>Khusus</strong><small>Fokus pada satu jenis isi.</small></span></label></fieldset>
    <div class="planet-types" data-types hidden><strong>Jenis isi yang diterima</strong><div data-type-grid></div></div>
    <label class="chip"><input name="is_favorite" type="checkbox"> Jadikan planet utama</label>
    <p class="planet-save-status" data-save-status aria-live="polite"></p>
    <div class="toolbar planet-composer__actions"><button class="button button--ghost" type="button" data-cancel>Batal</button><button class="button button--danger" type="button" data-delete hidden>Hapus planet</button><button class="button button--primary" type="submit">${planet?'Simpan perubahan':'Lahirkan planet'}</button></div>
  </section>`;
  const styles=form.elements.planet_style;for(const [value,label] of STYLES){const option=new Option(label,value);styles.add(option);}styles.value=planet?.planet_style||'ocean';
  const typeGrid=form.querySelector('[data-type-grid]');for(const [type,config] of Object.entries(ENTRY_TYPES)){const label=document.createElement('label');label.className='planet-type-chip';label.innerHTML='<input type="checkbox"><span></span>';label.querySelector('input').value=type;label.querySelector('span').textContent=`${config.icon} ${config.label}`;typeGrid.append(label);}
  const accepted=planet?.accepted_content_types||Object.keys(ENTRY_TYPES);for(const input of typeGrid.querySelectorAll('input'))input.checked=accepted.includes(input.value);
  form.elements.name.value=planet?.name||'';form.elements.description.value=planet?.description||'';form.elements.accent_color.value=planet?.accent_color||'#7C8CFF';form.elements.mode.value=planet?.mode||'free';form.elements.is_favorite.checked=Boolean(planet?.is_favorite);
  const preview=form.querySelector('.planet-composer__preview');const previewName=form.querySelector('[data-preview-name]');previewName.textContent=planet?.name||'Planet baru';
  if(planet?.cover_path)signedUrl(planet.cover_path).then(url=>{preview.style.setProperty('--planet-cover',`url("${url}")`);preview.classList.add('has-cover');}).catch(()=>{});
  const modal=openModal({title:planet?'Atur planet':'Ciptakan planet',content:form,className:'planet-composer-modal'});
  form.querySelector('[data-cancel]').onclick=()=>modal.close();
  const deleteButton=form.querySelector('[data-delete]');deleteButton.hidden=!planet;
  const status=form.querySelector('[data-save-status]');
  function sync(){const mode=form.elements.mode.value;form.querySelector('[data-types]').hidden=mode==='free';preview.dataset.style=form.elements.planet_style.value;preview.style.setProperty('--planet-accent',form.elements.accent_color.value);previewName.textContent=form.elements.name.value.trim()||'Planet baru';if(mode==='special'){const checked=[...typeGrid.querySelectorAll('input:checked')];if(checked.length>1)checked.slice(1).forEach(input=>input.checked=false);}}
  form.addEventListener('input',sync);form.addEventListener('change',sync);sync();
  form.onsubmit=async event=>{
    event.preventDefault();
    const submit=form.querySelector('[type=submit]');const originalLabel=submit.textContent;submit.disabled=true;submit.textContent='Menyimpan…';status.className='planet-save-status is-working';status.textContent='Menyimpan planet ke semesta…';
    let saved=null;let coverWarning='';
    try{
      const mode=form.elements.mode.value;let types=[...typeGrid.querySelectorAll('input:checked')].map(input=>input.value);if(mode==='free')types=Object.keys(ENTRY_TYPES);if(!types.length)throw new Error('Pilih minimal satu jenis isi untuk planet ini.');if(mode==='special')types=types.slice(0,1);
      const payload={name:form.elements.name.value,description:form.elements.description.value,planet_style:form.elements.planet_style.value,accent_color:form.elements.accent_color.value,mode,accepted_content_types:types,is_favorite:form.elements.is_favorite.checked};
      saved=planet?await repository.updatePlanet(planet.id,payload):await repository.createPlanet(payload);
      const file=form.elements.cover.files[0];
      if(file){
        status.textContent='Planet tersimpan. Mengunggah cover…';
        try{
          const old=saved.cover_path||planet?.cover_path;const path=await uploadPlanetCover({universeId:state.get('universe').id,planetId:saved.id,file});saved=await repository.updatePlanet(saved.id,{cover_path:path});if(old&&old!==path)await removeFiles([old]).catch(()=>{});
        }catch(error){coverWarning='Planet tersimpan, tetapi cover belum berhasil diunggah. Kamu bisa mencobanya lagi dari tombol pensil.';console.warn('Cover planet tertunda:',error);}
      }
    }catch(error){status.className='planet-save-status is-error';status.textContent=humanMessage(error);toast(humanMessage(error),{type:'error',duration:7000});submit.disabled=false;submit.textContent=originalLabel;return;}

    status.className='planet-save-status is-success';status.textContent=coverWarning||'Berhasil. Tampilan semesta sedang diperbarui…';
    toast(coverWarning||(planet?`Planet “${saved.name}” berhasil diperbarui.`:`Planet “${saved.name}” berhasil diciptakan.`),{type:coverWarning?'warning':'success',duration:5200});
    modal.close();
    try{await onSaved?.(saved);}catch(error){console.warn('Penyegaran tampilan planet tertunda:',error);}
    requestViewRefresh({source:'planet',id:saved.id});
  };
  deleteButton.onclick=async()=>{const ok=await confirmAction({title:'Hapus planet ini?',message:'Isi di dalam planet juga akan dihapus permanen dari semesta karena kamu memilih mode bersih total.',confirmLabel:'Hapus planet dan isinya',danger:true});if(!ok)return;deleteButton.disabled=true;status.className='planet-save-status is-working';status.textContent='Menghapus planet dan seluruh isinya…';try{const entries=await repository.listPlanetEntries(planet.id);for(const entry of entries){const links=await repository.countEntryPlanets(entry.id);if(links<=1){await removeFiles((entry.attachments||[]).map(item=>item.file_path));await repository.deleteEntry(entry.id);}else await repository.removeEntryFromPlanet(planet.id,entry.id);}const removed=await repository.deletePlanet(planet.id);await removeFiles([removed?.cover_path,removed?.theme_song_path]);toast('Planet dan isinya telah dihapus.',{type:'success'});modal.close();await onDeleted?.();requestViewRefresh({source:'planet-delete',id:planet.id});}catch(error){status.className='planet-save-status is-error';status.textContent=humanMessage(error);toast(humanMessage(error),{type:'error',duration:6500});deleteButton.disabled=false;}};
  return modal;
}

function requestViewRefresh(detail){window.dispatchEvent(new CustomEvent('our-universe:refresh',{detail}));}
function humanMessage(error){const message=String(error?.message||'Planet belum dapat disimpan.');if(/row-level security|permission denied/i.test(message))return 'Izin penyimpanan belum sinkron. Pasang migrasi V4.1.2 lalu coba lagi.';return message;}
