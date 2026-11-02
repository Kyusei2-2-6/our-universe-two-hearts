import { repository } from '../core/repository.js';
import { events } from '../core/event-bus.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

const STYLES=[
  ['moon','☾','Lunar'],
  ['saturn','♄','Saturn'],
  ['aurora','✦','Aurora'],
  ['ember','●','Ember'],
  ['ice','❄','Ice']
];

export function openPeriodComposer({period=null,onSaved}={}){
  const wrapper=document.createElement('div');
  const form=document.createElement('form');form.className='composer';
  form.innerHTML=`
    <div class="composer-section">
      <div class="field"><label>Nama Orbit Kenangan</label><input class="input" name="title" required maxlength="140" placeholder="Contoh: Awal Kita Bertemu"></div>
      <div class="field"><label>Cerita pembuka periode</label><textarea class="textarea" name="description" maxlength="12000" placeholder="Apa yang membuat periode ini berarti?"></textarea></div>
    </div>
    <div class="period-form-grid">
      <div class="field"><label>Tanggal mulai</label><input class="input" name="start_date" type="date"></div>
      <div class="field"><label>Tanggal selesai</label><input class="input" name="end_date" type="date"></div>
      <div class="field"><label>Warna planet</label><input class="input" name="accent_color" type="color" value="#8fb8ff"></div>
      <div class="field"><label>Urutan</label><input class="input" name="sort_order" type="number" min="0" max="999" value="0"></div>
    </div>
    <div class="field"><label>Jenis dunia</label><div class="period-style-picker" data-style-picker></div><input type="hidden" name="planet_style" value="moon"></div>
    <div class="toolbar" style="justify-content:flex-end"><button class="button button--ghost" type="button" data-cancel>Batal</button><button class="button button--primary" type="submit">${period?'Simpan orbit':'Ciptakan orbit'}</button></div>`;
  wrapper.append(form);
  const modal=openModal({title:period?'Edit Orbit Kenangan':'Buat Orbit Kenangan',content:wrapper,className:'composer-modal'});
  form.querySelector('[data-cancel]').onclick=()=>modal.close();
  const picker=form.querySelector('[data-style-picker]');
  for(const [value,icon,label] of STYLES){
    const button=document.createElement('button');button.type='button';button.className='period-style-option';button.dataset.value=value;button.innerHTML=`<span>${icon}</span>${label}`;
    button.onclick=()=>selectStyle(value);picker.append(button);
  }
  function selectStyle(value){form.elements.planet_style.value=value;for(const button of picker.children)button.classList.toggle('is-active',button.dataset.value===value);}
  if(period){
    form.elements.title.value=period.title||'';form.elements.description.value=period.description||'';
    form.elements.start_date.value=period.start_date||'';form.elements.end_date.value=period.end_date||'';
    form.elements.accent_color.value=period.accent_color||'#8fb8ff';form.elements.sort_order.value=period.sort_order||0;
    selectStyle(period.planet_style||'moon');
  }else selectStyle('moon');

  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;const original=button.textContent;
    try{
      const values=Object.fromEntries(new FormData(form));
      if(values.start_date&&values.end_date&&values.end_date<values.start_date)throw new Error('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      const payload={title:values.title,description:values.description,start_date:values.start_date||null,end_date:values.end_date||null,accent_color:values.accent_color,planet_style:values.planet_style,sort_order:Number(values.sort_order||0)};
      button.textContent=period?'Menyimpan perubahan…':'Menciptakan dunia…';
      const saved=period?await repository.updatePeriod(period.id,payload):await repository.createPeriod(payload);
      events.emit('data:changed',{table:'memory_periods',periodId:saved.id});toast(period?'Orbit Kenangan diperbarui.':'Sebuah dunia baru lahir di semesta kalian.');
      modal.close();await onSaved?.(saved);
    }catch(error){toast(error.message,{type:'error',duration:6500});}
    finally{button.disabled=false;button.textContent=original;}
  };
  return modal;
}
