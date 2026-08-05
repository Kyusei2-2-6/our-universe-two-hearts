import { supabase } from '../core/supabase.js';
import { state } from '../core/state.js';
import { events } from '../core/event-bus.js';
import { toast } from '../components/toast.js';

const MONTH_NAMES=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAY_NAMES=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const EVENT_COLORS=['rose','violet','blue','mint','amber'];

let launcher=null;
let sheet=null;
let monthCursor=startOfMonth(new Date());
let selectedDate=dateKey(new Date());
let eventsCache=[];
let activeUniverseId='';
let activeUserId='';
let partner=null;
let channel=null;
let started=false;
let refreshToken=0;
let isOpen=false;

function context(){
  const snapshot=state.snapshot;
  const universeId=snapshot.universe?.id||'';
  const userId=snapshot.user?.id||'';
  const other=(snapshot.members||[]).find(member=>member.user_id!==userId)||null;
  return{snapshot,universeId,userId,partner:other};
}

function appReady(){
  const shell=document.querySelector('#app-shell');
  return Boolean(shell&&!shell.hidden);
}

function ensureDock(){
  let dock=document.querySelector('#couple-life-dock');
  if(!dock){
    dock=document.createElement('div');
    dock.id='couple-life-dock';
    dock.className='couple-life-dock';
    dock.setAttribute('data-capture-ignore','true');
    document.body.append(dock);
  }
  return dock;
}

function ensureUI(){
  if(launcher)return;
  launcher=document.createElement('button');
  launcher.type='button';
  launcher.className='couple-life-button couple-life-button--calendar';
  launcher.setAttribute('aria-label','Buka kalender kegiatan');
  launcher.innerHTML='<span class="couple-life-button__icon">▦</span><span class="couple-life-button__copy"><strong>Kalender</strong><small>Agenda kalian</small></span>';
  launcher.onclick=openCalendar;
  ensureDock().append(launcher);

  sheet=document.createElement('section');
  sheet.className='couple-life-sheet couple-calendar-sheet';
  sheet.hidden=true;
  sheet.setAttribute('data-capture-ignore','true');
  sheet.innerHTML=`<div class="couple-life-backdrop" data-close></div>
  <div class="couple-life-panel" role="dialog" aria-modal="true" aria-labelledby="couple-calendar-title">
    <header class="couple-life-header">
      <div><p class="couple-life-eyebrow">OUR SHARED TIME</p><h2 id="couple-calendar-title">Kalender Kegiatan</h2><small>Jadwalmu dan jadwal pasangan tetap tersimpan terpisah.</small></div>
      <button class="couple-life-close" type="button" data-close aria-label="Tutup">×</button>
    </header>
    <div class="couple-calendar-toolbar">
      <button type="button" data-prev aria-label="Bulan sebelumnya">‹</button>
      <button type="button" class="couple-calendar-month" data-month></button>
      <button type="button" data-next aria-label="Bulan berikutnya">›</button>
      <button type="button" class="couple-calendar-today" data-today>Hari ini</button>
    </div>
    <div class="couple-calendar-layout">
      <section class="couple-calendar-main">
        <div class="couple-calendar-weekdays" data-weekdays></div>
        <div class="couple-calendar-grid" data-grid></div>
      </section>
      <aside class="couple-calendar-agenda">
        <div class="couple-calendar-agenda__head"><div><small>Agenda tanggal</small><strong data-selected-label></strong></div><button type="button" data-add>＋ Tambah</button></div>
        <div class="couple-calendar-legend" data-legend></div>
        <div class="couple-calendar-list" data-list></div>
      </aside>
    </div>
    <div class="couple-event-editor" data-editor hidden>
      <form data-form>
        <div class="couple-event-editor__head"><div><small>AGENDA PRIBADI</small><h3 data-form-title>Tambah kegiatan</h3></div><button type="button" data-cancel aria-label="Tutup formulir">×</button></div>
        <input type="hidden" name="event_id">
        <label>Judul kegiatan<input name="title" maxlength="120" required placeholder="Contoh: Kuliah, kerja, olahraga"></label>
        <div class="couple-event-editor__row"><label>Mulai<input name="start_at" type="datetime-local" required></label><label>Selesai<input name="end_at" type="datetime-local"></label></div>
        <label class="couple-event-check"><input name="all_day" type="checkbox"> Seharian</label>
        <label>Lokasi<input name="location" maxlength="160" placeholder="Opsional"></label>
        <label>Catatan<textarea name="notes" maxlength="1500" rows="3" placeholder="Detail yang perlu pasangan ketahui"></textarea></label>
        <fieldset><legend>Warna agenda</legend><div class="couple-event-colors">${EVENT_COLORS.map((color,index)=>`<label><input type="radio" name="color" value="${color}" ${index===0?'checked':''}><span class="is-${color}"></span></label>`).join('')}</div></fieldset>
        <div class="couple-event-editor__actions"><button type="button" class="danger" data-delete hidden>Hapus</button><span></span><button type="button" data-cancel>Batal</button><button type="submit" class="primary">Simpan</button></div>
      </form>
    </div>
  </div>`;
  document.body.append(sheet);

  sheet.querySelectorAll('[data-close]').forEach(node=>node.onclick=closeCalendar);
  sheet.querySelector('[data-prev]').onclick=()=>{monthCursor=addMonths(monthCursor,-1);selectedDate=dateKey(monthCursor);refresh();};
  sheet.querySelector('[data-next]').onclick=()=>{monthCursor=addMonths(monthCursor,1);selectedDate=dateKey(monthCursor);refresh();};
  sheet.querySelector('[data-today]').onclick=()=>{monthCursor=startOfMonth(new Date());selectedDate=dateKey(new Date());refresh();};
  sheet.querySelector('[data-month]').onclick=()=>{monthCursor=startOfMonth(new Date());selectedDate=dateKey(new Date());refresh();};
  sheet.querySelector('[data-add]').onclick=()=>openEditor();
  sheet.querySelectorAll('[data-cancel]').forEach(node=>node.onclick=closeEditor);
  sheet.querySelector('[data-form]').onsubmit=saveEvent;
  sheet.querySelector('[data-delete]').onclick=deleteCurrentEvent;
  sheet.querySelector('[name="all_day"]').onchange=syncAllDayInputs;
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen){if(!sheet.querySelector('[data-editor]').hidden)closeEditor();else closeCalendar();}});
}

async function ensureStarted(){
  const next=context();
  if(!appReady()||!next.universeId||!next.userId){
    if(launcher)launcher.hidden=true;
    return;
  }
  ensureUI();
  launcher.hidden=false;
  const changed=activeUniverseId!==next.universeId||activeUserId!==next.userId;
  activeUniverseId=next.universeId;
  activeUserId=next.userId;
  partner=next.partner;
  renderLegend();
  if(changed){
    await disconnectChannel();
    eventsCache=[];
    await subscribeRealtime();
    if(isOpen)await refresh();
  }else if(!channel){
    await subscribeRealtime();
  }
  started=true;
}

async function subscribeRealtime(){
  if(!activeUniverseId)return;
  await disconnectChannel();
  channel=supabase().channel(`couple-calendar:${activeUniverseId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'couple_calendar_events',filter:`universe_id=eq.${activeUniverseId}`},()=>{
      if(isOpen)refresh();
      else launcher?.classList.add('has-update');
    })
    .subscribe();
}

async function disconnectChannel(){
  if(!channel)return;
  const old=channel;channel=null;
  try{await supabase().removeChannel(old);}catch{}
}

async function openCalendar(){
  await ensureStarted();
  sheet.hidden=false;
  isOpen=true;
  launcher?.classList.remove('has-update');
  document.body.classList.add('couple-life-open');
  await refresh();
}

function closeCalendar(){
  if(!sheet)return;
  sheet.hidden=true;
  isOpen=false;
  closeEditor();
  document.body.classList.remove('couple-life-open');
}

async function refresh(){
  if(!sheet||!activeUniverseId)return;
  const token=++refreshToken;
  renderCalendarSkeleton();
  const range=monthGridRange(monthCursor);
  try{
    const{data,error}=await supabase().from('couple_calendar_events')
      .select('*')
      .eq('universe_id',activeUniverseId)
      .gte('start_at',range.start.toISOString())
      .lt('start_at',range.end.toISOString())
      .order('start_at',{ascending:true});
    if(error)throw error;
    if(token!==refreshToken)return;
    eventsCache=data||[];
    renderCalendar();
  }catch(error){
    if(token!==refreshToken)return;
    renderCalendar();
    const host=sheet.querySelector('[data-list]');
    host.innerHTML='<div class="couple-calendar-empty"><strong>Kalender belum tersambung</strong><span>Jalankan migrasi SQL v4.4.1 di Supabase.</span></div>';
    console.warn(error);
  }
}

function renderCalendarSkeleton(){
  sheet.querySelector('[data-month]').textContent=`${MONTH_NAMES[monthCursor.getMonth()]} ${monthCursor.getFullYear()}`;
  const grid=sheet.querySelector('[data-grid]');
  grid.innerHTML='<div class="couple-calendar-loading"></div>';
}

function renderCalendar(){
  sheet.querySelector('[data-month]').textContent=`${MONTH_NAMES[monthCursor.getMonth()]} ${monthCursor.getFullYear()}`;
  const weekdays=sheet.querySelector('[data-weekdays]');
  weekdays.innerHTML='';
  DAY_NAMES.forEach(day=>{const node=document.createElement('span');node.textContent=day;weekdays.append(node);});
  const grid=sheet.querySelector('[data-grid]');
  grid.innerHTML='';
  const range=monthGridRange(monthCursor);
  for(let cursor=new Date(range.start);cursor<range.end;cursor=addDays(cursor,1)){
    const key=dateKey(cursor);
    const dayEvents=eventsForDate(key);
    const button=document.createElement('button');
    button.type='button';
    button.className='couple-calendar-day';
    if(cursor.getMonth()!==monthCursor.getMonth())button.classList.add('is-outside');
    if(key===dateKey(new Date()))button.classList.add('is-today');
    if(key===selectedDate)button.classList.add('is-selected');
    button.dataset.date=key;
    const number=document.createElement('span');number.className='couple-calendar-day__number';number.textContent=String(cursor.getDate());button.append(number);
    const stack=document.createElement('span');stack.className='couple-calendar-day__events';
    dayEvents.slice(0,3).forEach(item=>{
      const pill=document.createElement('span');
      pill.className=`couple-calendar-pill is-${safeColor(item.color)} ${item.owner_id===activeUserId?'is-mine':'is-partner'}`;
      pill.textContent=item.title;
      stack.append(pill);
    });
    if(dayEvents.length>3){const more=document.createElement('span');more.className='couple-calendar-more';more.textContent=`+${dayEvents.length-3} lagi`;stack.append(more);}
    button.append(stack);
    button.onclick=()=>{selectedDate=key;renderCalendar();};
    grid.append(button);
  }
  renderAgenda();
  renderLegend();
}

function renderLegend(){
  if(!sheet)return;
  const host=sheet.querySelector('[data-legend]');
  host.innerHTML='';
  const people=[{id:activeUserId,name:'Jadwal saya',className:'mine'}];
  if(partner)people.push({id:partner.user_id,name:partner.profile?.display_name||'Pasangan',className:'partner'});
  people.forEach(person=>{const item=document.createElement('span');item.className=`couple-calendar-person is-${person.className}`;item.innerHTML='<i></i><b></b>';item.querySelector('b').textContent=person.name;host.append(item);});
}

function renderAgenda(){
  const labelDate=parseDateKey(selectedDate);
  sheet.querySelector('[data-selected-label]').textContent=new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(labelDate);
  const host=sheet.querySelector('[data-list]');host.innerHTML='';
  const rows=eventsForDate(selectedDate);
  if(!rows.length){host.innerHTML='<div class="couple-calendar-empty"><strong>Belum ada kegiatan</strong><span>Kamu dan pasangan dapat menambahkan agenda masing-masing pada tanggal yang sama.</span></div>';return;}
  rows.forEach(item=>host.append(renderEventCard(item)));
}

function renderEventCard(item){
  const mine=item.owner_id===activeUserId;
  const article=document.createElement('article');
  article.className=`couple-agenda-card is-${safeColor(item.color)} ${mine?'is-mine':'is-partner'}`;
  const time=document.createElement('div');time.className='couple-agenda-card__time';time.textContent=item.all_day?'Seharian':timeRange(item);
  const body=document.createElement('div');body.className='couple-agenda-card__body';
  const title=document.createElement('strong');title.textContent=item.title;
  const owner=document.createElement('small');owner.textContent=mine?'Jadwal saya':(partner?.profile?.display_name||'Jadwal pasangan');
  body.append(title,owner);
  if(item.location){const location=document.createElement('span');location.textContent=`⌖ ${item.location}`;body.append(location);}
  if(item.notes){const notes=document.createElement('p');notes.textContent=item.notes;body.append(notes);}
  article.append(time,body);
  if(mine){const edit=document.createElement('button');edit.type='button';edit.className='couple-agenda-card__edit';edit.textContent='Ubah';edit.onclick=()=>openEditor(item);article.append(edit);}
  return article;
}

function openEditor(item=null){
  const editor=sheet.querySelector('[data-editor]');
  const form=sheet.querySelector('[data-form]');
  form.reset();
  form.elements.event_id.value=item?.id||'';
  form.elements.title.value=item?.title||'';
  const base=item?new Date(item.start_at):dateAtLocalTime(selectedDate,9,0);
  const finish=item?.end_at?new Date(item.end_at):new Date(base.getTime()+60*60*1000);
  form.elements.start_at.value=toLocalInput(base);
  form.elements.end_at.value=toLocalInput(finish);
  form.elements.location.value=item?.location||'';
  form.elements.notes.value=item?.notes||'';
  form.elements.all_day.checked=Boolean(item?.all_day);
  const color=safeColor(item?.color||'rose');
  const radio=form.querySelector(`[name="color"][value="${color}"]`);if(radio)radio.checked=true;
  sheet.querySelector('[data-form-title]').textContent=item?'Ubah kegiatan':'Tambah kegiatan';
  sheet.querySelector('[data-delete]').hidden=!item;
  editor.hidden=false;
  syncAllDayInputs();
  setTimeout(()=>form.elements.title.focus(),80);
}

function closeEditor(){
  if(!sheet)return;
  sheet.querySelector('[data-editor]').hidden=true;
}

function syncAllDayInputs(){
  const form=sheet.querySelector('[data-form]');
  const checked=form.elements.all_day.checked;
  form.elements.start_at.dataset.allDay=String(checked);
  form.elements.end_at.dataset.allDay=String(checked);
}

async function saveEvent(event){
  event.preventDefault();
  const form=event.currentTarget;
  const submit=form.querySelector('[type="submit"]');
  const eventId=form.elements.event_id.value;
  const title=form.elements.title.value.trim();
  const allDay=form.elements.all_day.checked;
  let start=new Date(form.elements.start_at.value);
  let end=form.elements.end_at.value?new Date(form.elements.end_at.value):null;
  if(!title||Number.isNaN(start.getTime()))return;
  if(allDay){start=new Date(start.getFullYear(),start.getMonth(),start.getDate(),0,0,0,0);end=new Date(start.getFullYear(),start.getMonth(),start.getDate(),23,59,59,999);}
  if(end&&end<start){toast('Waktu selesai tidak boleh lebih awal dari waktu mulai.',{type:'error'});return;}
  const payload={
    universe_id:activeUniverseId,
    owner_id:activeUserId,
    title,
    notes:form.elements.notes.value.trim()||null,
    location:form.elements.location.value.trim()||null,
    start_at:start.toISOString(),
    end_at:end?end.toISOString():null,
    all_day:allDay,
    color:safeColor(form.elements.color.value)
  };
  submit.disabled=true;submit.textContent='Menyimpan…';
  try{
    let response;
    if(eventId)response=await supabase().from('couple_calendar_events').update(payload).eq('id',eventId).eq('owner_id',activeUserId);
    else response=await supabase().from('couple_calendar_events').insert(payload);
    if(response.error)throw response.error;
    closeEditor();
    selectedDate=dateKey(start);
    monthCursor=startOfMonth(start);
    await refresh();
    toast(eventId?'Kegiatan berhasil diperbarui.':'Kegiatan berhasil ditambahkan.',{type:'success'});
  }catch(error){toast(friendlyError(error),{type:'error',duration:6500});}
  finally{submit.disabled=false;submit.textContent='Simpan';}
}

async function deleteCurrentEvent(){
  const form=sheet.querySelector('[data-form]');
  const eventId=form.elements.event_id.value;
  if(!eventId||!confirm('Hapus kegiatan ini dari kalender?'))return;
  const button=sheet.querySelector('[data-delete]');button.disabled=true;
  try{
    const{error}=await supabase().from('couple_calendar_events').delete().eq('id',eventId).eq('owner_id',activeUserId);
    if(error)throw error;
    closeEditor();await refresh();toast('Kegiatan berhasil dihapus.',{type:'success'});
  }catch(error){toast(friendlyError(error),{type:'error'});}
  finally{button.disabled=false;}
}

function eventsForDate(key){
  return eventsCache.filter(item=>dateKey(new Date(item.start_at))===key).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
}
function safeColor(value){return EVENT_COLORS.includes(value)?value:'rose';}
function startOfMonth(date){return new Date(date.getFullYear(),date.getMonth(),1,0,0,0,0);}
function addMonths(date,amount){return new Date(date.getFullYear(),date.getMonth()+amount,1,0,0,0,0);}
function addDays(date,amount){const next=new Date(date);next.setDate(next.getDate()+amount);return next;}
function monthGridRange(date){const first=startOfMonth(date);const start=addDays(first,-first.getDay());const end=addDays(start,42);return{start,end};}
function dateKey(date){const year=date.getFullYear();const month=String(date.getMonth()+1).padStart(2,'0');const day=String(date.getDate()).padStart(2,'0');return`${year}-${month}-${day}`;}
function parseDateKey(value){const[y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d,12,0,0,0);}
function dateAtLocalTime(value,hour,minute){const date=parseDateKey(value);date.setHours(hour,minute,0,0);return date;}
function toLocalInput(date){const pad=value=>String(value).padStart(2,'0');return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;}
function timeRange(item){const formatter=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit'});const start=formatter.format(new Date(item.start_at));const end=item.end_at?formatter.format(new Date(item.end_at)):'';return end?`${start}–${end}`:start;}
function friendlyError(error){const message=String(error?.message||error||'');if(message.includes('couple_calendar_events')||message.includes('schema cache'))return'Kalender belum aktif di database. Jalankan migrasi SQL v4.4.1.';return message||'Kegiatan belum dapat disimpan.';}

events.on('realtime:change',event=>{if(['universe_members','profiles'].includes(event.detail?.table))setTimeout(ensureStarted,350);});
window.addEventListener('pagehide',()=>disconnectChannel());
setInterval(()=>ensureStarted().catch(()=>{}),1200);
ensureStarted().catch(()=>{});
