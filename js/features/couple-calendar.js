import { supabase } from '../core/supabase.js';
import { state } from '../core/state.js';
import { events } from '../core/event-bus.js';
import { toast } from '../components/toast.js';

const DAY_NAMES=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
let launcher=null;
let sheet=null;
let monthLabel=null;
let gridHost=null;
let selectedLabel=null;
let agendaHost=null;
let formHost=null;
let form=null;
let channel=null;
let activeUniverseId='';
let activeUserId='';
let partnerId='';
let viewMonth=startOfMonth(new Date());
let selectedDate=dateKey(new Date());
let editingId='';
let isOpen=false;
let reloadTimer=null;
let rows=[];
let todayCount=0;

function context(){
  const snapshot=state.snapshot;
  const universeId=snapshot.universe?.id||'';
  const userId=snapshot.user?.id||'';
  const partner=(snapshot.members||[]).find(member=>member.user_id!==userId)||null;
  return{snapshot,universeId,userId,partner};
}

function appReady(){
  const shell=document.querySelector('#app-shell');
  return Boolean(shell&&!shell.hidden);
}

function ensureUI(){
  if(launcher)return;
  launcher=document.createElement('button');
  launcher.type='button';
  launcher.className='couple-calendar-launcher';
  launcher.hidden=true;
  launcher.setAttribute('aria-label','Buka kalender pasangan');
  launcher.setAttribute('title','Kalender pasangan');
  launcher.setAttribute('data-capture-ignore','true');
  launcher.innerHTML='<span aria-hidden="true">▦</span><i data-calendar-today></i>';
  launcher.addEventListener('click',openCalendar);
  document.body.append(launcher);

  sheet=document.createElement('section');
  sheet.className='couple-calendar-sheet';
  sheet.hidden=true;
  sheet.setAttribute('data-capture-ignore','true');
  sheet.innerHTML=`
    <div class="couple-calendar-panel" role="dialog" aria-modal="true" aria-labelledby="couple-calendar-title">
      <header class="couple-tool-header">
        <div>
          <small>KALENDER KALIAN</small>
          <strong id="couple-calendar-title">Jadwal bersama</strong>
        </div>
        <button type="button" class="couple-tool-close" data-close-calendar aria-label="Tutup kalender">×</button>
      </header>
      <div class="couple-calendar-nav">
        <button type="button" data-prev-month aria-label="Bulan sebelumnya">‹</button>
        <strong data-month-label></strong>
        <button type="button" data-next-month aria-label="Bulan berikutnya">›</button>
      </div>
      <div class="couple-calendar-weekdays">${DAY_NAMES.map(day=>`<span>${day}</span>`).join('')}</div>
      <div class="couple-calendar-grid" data-calendar-grid></div>
      <div class="couple-calendar-agenda-head">
        <div><small>JADWAL TERPILIH</small><strong data-selected-label></strong></div>
        <button type="button" class="couple-tool-button is-primary" data-add-event>+ Tambah</button>
      </div>
      <div class="couple-calendar-agenda" data-agenda></div>
      <div class="couple-calendar-form" data-event-form-host hidden>
        <form data-event-form>
          <div class="couple-calendar-form-head"><strong data-form-title>Tambah jadwal</strong><button type="button" data-cancel-event aria-label="Tutup formulir">×</button></div>
          <label>Judul<input name="title" maxlength="120" required placeholder="Contoh: Video call malam"></label>
          <label>Tanggal<input name="event_date" type="date" required></label>
          <label class="couple-tool-switch is-inline"><input name="all_day" type="checkbox"><span>Sepanjang hari</span></label>
          <div class="couple-calendar-time-row" data-time-row>
            <label>Mulai<input name="start_time" type="time" required></label>
            <label>Selesai<input name="end_time" type="time"></label>
          </div>
          <label>Catatan<textarea name="notes" maxlength="1000" rows="2" placeholder="Catatan kecil untuk kalian"></textarea></label>
          <button class="couple-tool-button is-primary is-wide" type="submit">Simpan jadwal</button>
        </form>
      </div>
      <p class="couple-tool-note">Kalian dapat melihat semua jadwal. Setiap orang hanya dapat mengubah atau menghapus jadwal miliknya sendiri.</p>
    </div>`;

  monthLabel=sheet.querySelector('[data-month-label]');
  gridHost=sheet.querySelector('[data-calendar-grid]');
  selectedLabel=sheet.querySelector('[data-selected-label]');
  agendaHost=sheet.querySelector('[data-agenda]');
  formHost=sheet.querySelector('[data-event-form-host]');
  form=sheet.querySelector('[data-event-form]');

  sheet.querySelector('[data-close-calendar]').addEventListener('click',closeCalendar);
  sheet.querySelector('[data-prev-month]').addEventListener('click',()=>changeMonth(-1));
  sheet.querySelector('[data-next-month]').addEventListener('click',()=>changeMonth(1));
  sheet.querySelector('[data-add-event]').addEventListener('click',()=>openEventForm());
  sheet.querySelector('[data-cancel-event]').addEventListener('click',closeEventForm);
  form.elements.all_day.addEventListener('change',syncAllDay);
  form.addEventListener('submit',saveEvent);
  sheet.addEventListener('click',event=>{
    if(event.target===sheet)closeCalendar();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&isOpen){
      if(!formHost.hidden)closeEventForm();
      else closeCalendar();
    }
  });
  window.addEventListener('our-universe:overlay-open',event=>{
    if(event.detail?.source!=='couple-calendar'&&isOpen)closeCalendar();
  });
  document.body.append(sheet);
}

async function ensureStarted(){
  const next=context();
  if(!appReady()||!next.universeId||!next.userId){
    if(launcher)launcher.hidden=true;
    if(isOpen)closeCalendar();
    return;
  }
  ensureUI();
  launcher.hidden=false;
  const changed=activeUniverseId!==next.universeId||activeUserId!==next.userId;
  activeUniverseId=next.universeId;
  activeUserId=next.userId;
  partnerId=next.partner?.user_id||'';
  if(changed){
    rows=[];
    await disconnectRealtime();
    await subscribeRealtime();
    await Promise.all([loadMonth(),loadTodayCount()]);
  }
  renderLauncherBadge();
}

async function openCalendar(){
  await ensureStarted();
  if(!sheet)return;
  window.dispatchEvent(new CustomEvent('our-universe:overlay-open',{detail:{source:'couple-calendar'}}));
  sheet.hidden=false;
  isOpen=true;
  await Promise.all([loadMonth(),loadTodayCount()]);
  renderAll();
}

function closeCalendar(){
  if(!sheet)return;
  closeEventForm();
  sheet.hidden=true;
  isOpen=false;
}

async function changeMonth(delta){
  viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+delta,1);
  const today=dateKey(new Date());
  selectedDate=today.startsWith(monthKey(viewMonth))?today:dateKey(viewMonth);
  closeEventForm();
  await loadMonth();
}

async function loadMonth(){
  if(!activeUniverseId)return;
  const first=dateKey(startOfMonth(viewMonth));
  const last=dateKey(endOfMonth(viewMonth));
  const{data,error}=await supabase().from('couple_calendar_events')
    .select('*')
    .eq('universe_id',activeUniverseId)
    .gte('event_date',first)
    .lte('event_date',last)
    .order('event_date',{ascending:true})
    .order('all_day',{ascending:false})
    .order('start_time',{ascending:true});
  if(error){
    rows=[];
    renderAll();
    const missing=String(error.message||'').includes('couple_calendar_events');
    if(missing&&agendaHost)agendaHost.innerHTML='<div class="couple-calendar-empty">Database kalender belum aktif. Jalankan migrasi SQL v4.4.</div>';
    else console.warn(error);
    return;
  }
  rows=data||[];
  if(monthKey(viewMonth)===monthKey(new Date()))todayCount=rows.filter(row=>row.event_date===dateKey(new Date())).length;
  renderAll();
}

async function loadTodayCount(){
  if(!activeUniverseId)return;
  const today=dateKey(new Date());
  const{count,error}=await supabase().from('couple_calendar_events')
    .select('id',{count:'exact',head:true})
    .eq('universe_id',activeUniverseId)
    .eq('event_date',today);
  if(!error)todayCount=Number(count||0);
  renderLauncherBadge();
}

function renderAll(){
  if(!gridHost)return;
  renderGrid();
  renderAgenda();
  renderLauncherBadge();
}

function renderGrid(){
  monthLabel.textContent=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(viewMonth);
  gridHost.innerHTML='';
  const first=startOfMonth(viewMonth);
  const firstWeekday=first.getDay();
  const totalDays=endOfMonth(viewMonth).getDate();
  const previous=endOfMonth(new Date(viewMonth.getFullYear(),viewMonth.getMonth()-1,1)).getDate();
  const cells=Math.ceil((firstWeekday+totalDays)/7)*7;
  const today=dateKey(new Date());

  for(let index=0;index<cells;index+=1){
    let cellDate;
    let outside=false;
    if(index<firstWeekday){
      cellDate=new Date(viewMonth.getFullYear(),viewMonth.getMonth()-1,previous-firstWeekday+index+1);
      outside=true;
    }else if(index>=firstWeekday+totalDays){
      cellDate=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,index-firstWeekday-totalDays+1);
      outside=true;
    }else cellDate=new Date(viewMonth.getFullYear(),viewMonth.getMonth(),index-firstWeekday+1);

    const key=dateKey(cellDate);
    const dayRows=rows.filter(row=>row.event_date===key);
    const button=document.createElement('button');
    button.type='button';
    button.className='couple-calendar-day';
    if(outside)button.classList.add('is-outside');
    if(key===today)button.classList.add('is-today');
    if(key===selectedDate)button.classList.add('is-selected');
    button.setAttribute('aria-label',new Intl.DateTimeFormat('id-ID',{dateStyle:'full'}).format(cellDate));
    button.innerHTML=`<span>${cellDate.getDate()}</span><i>${dayRows.slice(0,3).map(row=>`<b class="${row.owner_id===activeUserId?'is-mine':'is-partner'}"></b>`).join('')}</i>`;
    button.addEventListener('click',async()=>{
      if(outside){
        viewMonth=startOfMonth(cellDate);
        selectedDate=key;
        await loadMonth();
      }else{
        selectedDate=key;
        renderAll();
      }
    });
    gridHost.append(button);
  }
}

function renderAgenda(){
  const date=parseDateKey(selectedDate);
  selectedLabel.textContent=new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long'}).format(date);
  agendaHost.innerHTML='';
  const dayRows=rows.filter(row=>row.event_date===selectedDate);
  if(!dayRows.length){
    agendaHost.innerHTML='<div class="couple-calendar-empty">Belum ada jadwal pada tanggal ini.</div>';
    return;
  }
  const ctx=context();
  for(const row of dayRows){
    const mine=row.owner_id===activeUserId;
    const member=(ctx.snapshot.members||[]).find(item=>item.user_id===row.owner_id);
    const owner=mine?'Kamu':(member?.profile?.display_name||'Pasangan');
    const card=document.createElement('article');
    card.className=`couple-calendar-event${mine?' is-mine':' is-partner'}`;
    card.innerHTML=`
      <div class="couple-calendar-event-time">${escapeHtml(timeLabel(row))}</div>
      <div class="couple-calendar-event-copy">
        <strong>${escapeHtml(row.title)}</strong>
        <small>${escapeHtml(owner)}${row.notes?` · ${escapeHtml(row.notes)}`:''}</small>
      </div>
      ${mine?'<div class="couple-calendar-event-actions"><button type="button" data-edit aria-label="Edit jadwal">✎</button><button type="button" data-delete aria-label="Hapus jadwal">×</button></div>':''}`;
    if(mine){
      card.querySelector('[data-edit]').addEventListener('click',()=>openEventForm(row));
      card.querySelector('[data-delete]').addEventListener('click',()=>deleteEvent(row));
    }
    agendaHost.append(card);
  }
}

function openEventForm(row=null){
  editingId=row?.id||'';
  form.reset();
  formHost.hidden=false;
  formHost.querySelector('[data-form-title]').textContent=row?'Edit jadwal':'Tambah jadwal';
  form.elements.title.value=row?.title||'';
  form.elements.event_date.value=row?.event_date||selectedDate;
  form.elements.all_day.checked=Boolean(row?.all_day);
  form.elements.start_time.value=normalizeTime(row?.start_time)||(row?.all_day?'':'19:00');
  form.elements.end_time.value=normalizeTime(row?.end_time)||'';
  form.elements.notes.value=row?.notes||'';
  syncAllDay();
  setTimeout(()=>form.elements.title.focus(),80);
}

function closeEventForm(){
  editingId='';
  if(formHost)formHost.hidden=true;
  form?.reset?.();
}

function syncAllDay(){
  const allDay=form.elements.all_day.checked;
  const row=formHost.querySelector('[data-time-row]');
  row.classList.toggle('is-disabled',allDay);
  form.elements.start_time.disabled=allDay;
  form.elements.end_time.disabled=allDay;
  form.elements.start_time.required=!allDay;
}

async function saveEvent(event){
  event.preventDefault();
  if(!activeUniverseId||!activeUserId)return;
  const values=new FormData(form);
  const allDay=form.elements.all_day.checked;
  const startTime=allDay?null:String(values.get('start_time')||'').trim();
  const endTime=allDay?null:String(values.get('end_time')||'').trim()||null;
  if(!allDay&&!startTime){
    toast('Jam mulai perlu diisi.',{type:'error'});
    return;
  }
  if(startTime&&endTime&&endTime<startTime){
    toast('Jam selesai tidak boleh lebih awal dari jam mulai.',{type:'error'});
    return;
  }
  const payload={
    universe_id:activeUniverseId,
    owner_id:activeUserId,
    title:String(values.get('title')||'').trim(),
    event_date:String(values.get('event_date')||selectedDate),
    all_day:allDay,
    start_time:startTime,
    end_time:endTime,
    notes:String(values.get('notes')||'').trim()||null,
    updated_at:new Date().toISOString()
  };
  if(!payload.title)return;

  const button=form.querySelector('button[type="submit"]');
  const wasEditing=Boolean(editingId);
  button.disabled=true;
  try{
    let result;
    if(editingId){
      result=await supabase().from('couple_calendar_events').update(payload).eq('id',editingId).eq('owner_id',activeUserId).select().single();
    }else{
      result=await supabase().from('couple_calendar_events').insert(payload).select().single();
    }
    if(result.error)throw result.error;
    selectedDate=payload.event_date;
    viewMonth=startOfMonth(parseDateKey(selectedDate));
    closeEventForm();
    await Promise.all([loadMonth(),loadTodayCount()]);
    toast(wasEditing?'Jadwal diperbarui.':'Jadwal ditambahkan.',{type:'success'});
  }catch(error){
    console.warn(error);
    const missing=String(error.message||'').includes('couple_calendar_events');
    toast(missing?'Database kalender belum aktif. Jalankan migrasi SQL v4.4.':(error.message||'Jadwal belum dapat disimpan.'),{type:'error',duration:6000});
  }finally{button.disabled=false;}
}

async function deleteEvent(row){
  if(!confirm(`Hapus jadwal “${row.title}”?`))return;
  const{error}=await supabase().from('couple_calendar_events').delete().eq('id',row.id).eq('owner_id',activeUserId);
  if(error){
    toast(error.message||'Jadwal belum dapat dihapus.',{type:'error'});
    return;
  }
  rows=rows.filter(item=>item.id!==row.id);
  if(row.event_date===dateKey(new Date()))todayCount=Math.max(0,todayCount-1);
  renderAll();
  toast('Jadwal dihapus.',{type:'success'});
}

function renderLauncherBadge(){
  if(!launcher)return;
  const badge=launcher.querySelector('[data-calendar-today]');
  badge.textContent=todayCount>0?String(Math.min(9,todayCount)):'';
  badge.classList.toggle('has-events',todayCount>0);
}

async function subscribeRealtime(){
  if(!activeUniverseId)return;
  channel=supabase().channel(`couple-calendar:${activeUniverseId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'couple_calendar_events',filter:`universe_id=eq.${activeUniverseId}`},()=>{
      clearTimeout(reloadTimer);
      reloadTimer=setTimeout(()=>Promise.all([loadMonth(),loadTodayCount()]),180);
    })
    .subscribe();
}

async function disconnectRealtime(){
  if(!channel)return;
  const old=channel;
  channel=null;
  try{await supabase().removeChannel(old);}catch{}
}

function timeLabel(row){
  if(row.all_day)return'Sepanjang hari';
  const start=normalizeTime(row.start_time)||'--:--';
  const end=normalizeTime(row.end_time);
  return end?`${start} - ${end}`:start;
}

function normalizeTime(value){
  if(!value)return'';
  return String(value).slice(0,5);
}

function startOfMonth(date){return new Date(date.getFullYear(),date.getMonth(),1);}
function endOfMonth(date){return new Date(date.getFullYear(),date.getMonth()+1,0);}
function monthKey(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;}
function dateKey(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function parseDateKey(value){
  const[year,month,day]=String(value).split('-').map(Number);
  return new Date(year,month-1,day);
}
function escapeHtml(value=''){
  return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

events.on('realtime:change',event=>{
  if(['universe_members','profiles'].includes(event.detail?.table))setTimeout(()=>ensureStarted(),300);
});
window.addEventListener('pagehide',()=>disconnectRealtime());

setInterval(()=>ensureStarted().catch(error=>console.warn('Kalender pasangan menunggu konteks:',error)),1200);
ensureStarted().catch(()=>{});
