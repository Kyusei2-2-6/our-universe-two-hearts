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
let nextMeeting=null;
let activeUniverseId='';
let activeUserId='';
let partner=null;
let channel=null;
let refreshToken=0;
let meetingToken=0;
let isOpen=false;
let countdownTimer=null;
let startupTimer=null;
let requestedEventId='';

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

function scheduleStart(delay=0){
  clearTimeout(startupTimer);
  startupTimer=window.setTimeout(()=>ensureStarted().catch(()=>{}),delay);
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
  launcher.setAttribute('aria-label','Buka kalender kegiatan dan countdown ketemuan');
  launcher.setAttribute('data-capture-ignore','true');
  launcher.innerHTML='<span class="couple-life-button__icon">▦</span><span class="couple-life-button__copy"><strong>Kalender</strong><small data-calendar-launcher-copy>Agenda kalian</small></span>';
  launcher.onclick=openCalendar;
  ensureDock().append(launcher);

  sheet=document.createElement('section');
  sheet.className='couple-life-sheet couple-calendar-sheet';
  sheet.hidden=true;
  sheet.setAttribute('data-capture-ignore','true');
  sheet.innerHTML=`<div class="couple-life-backdrop" data-close></div>
  <div class="couple-life-panel couple-calendar-panel" role="dialog" aria-modal="true" aria-labelledby="couple-calendar-title">
    <header class="couple-life-header">
      <div><p class="couple-life-eyebrow">OUR SHARED TIME</p><h2 id="couple-calendar-title">Kalender Kegiatan</h2><small>Agenda pribadi tetap terpisah. Jadwal ketemuan dapat dihitung mundur bersama.</small></div>
      <button class="couple-life-close" type="button" data-close aria-label="Tutup">×</button>
    </header>
    <section class="couple-meeting-countdown" data-meeting-card>
      <div class="couple-meeting-countdown__mark" aria-hidden="true">♡</div>
      <div class="couple-meeting-countdown__copy">
        <small data-meeting-kicker>NEXT MEETING</small>
        <strong data-meeting-title>Belum ada jadwal ketemuan</strong>
        <span data-meeting-meta>Buat agenda lalu aktifkan pilihan “Jadwal ketemuan”.</span>
      </div>
      <div class="couple-meeting-countdown__timer" data-meeting-timer hidden>
        <span><b data-meeting-days>0</b><small>hari</small></span>
        <span><b data-meeting-hours>00</b><small>jam</small></span>
        <span><b data-meeting-minutes>00</b><small>menit</small></span>
        <span><b data-meeting-seconds>00</b><small>detik</small></span>
      </div>
      <button type="button" class="couple-meeting-countdown__action" data-meeting-action>＋ Buat jadwal</button>
    </section>
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
        <div class="couple-event-editor__head"><div><small>AGENDA KALIAN</small><h3 data-form-title>Tambah kegiatan</h3></div><button type="button" data-cancel aria-label="Tutup formulir">×</button></div>
        <input type="hidden" name="event_id">
        <label>Judul kegiatan<input name="title" maxlength="120" required placeholder="Contoh: Ketemu di taman kota"></label>
        <div class="couple-event-editor__row"><label>Mulai<input name="start_at" type="datetime-local" required></label><label>Selesai<input name="end_at" type="datetime-local"></label></div>
        <label class="couple-event-check"><input name="all_day" type="checkbox"> Seharian</label>
        <label class="couple-event-meeting"><input name="countdown_enabled" type="checkbox"><span><strong>Jadwal ketemuan</strong><small>Tampilkan countdown hari, jam, menit, dan detik untuk kalian berdua.</small></span></label>
        <label class="couple-event-timeline"><input name="timeline_enabled" type="checkbox"><span><strong>Masukkan ke Love Timeline</strong><small>Agenda ini ikut muncul sebagai momen pada perjalanan galaxy kalian.</small></span></label>
        <label>Lokasi<input name="location" maxlength="160" placeholder="Opsional"></label>
        <label>Catatan<textarea name="notes" maxlength="1500" rows="3" placeholder="Detail yang perlu pasangan ketahui"></textarea></label>
        <fieldset><legend>Warna agenda</legend><div class="couple-event-colors">${EVENT_COLORS.map((color,index)=>`<label><input type="radio" name="color" value="${color}" ${index===0?'checked':''}><span class="is-${color}"></span></label>`).join('')}</div></fieldset>
        <div class="couple-event-editor__actions"><button type="button" class="danger" data-delete hidden>Hapus</button><small data-save-status></small><button type="button" data-cancel>Batal</button><button type="submit" class="primary">Simpan</button></div>
      </form>
    </div>
  </div>`;
  document.body.append(sheet);

  sheet.querySelectorAll('[data-close]').forEach(node=>node.onclick=closeCalendar);
  sheet.querySelector('[data-prev]').onclick=()=>{monthCursor=addMonths(monthCursor,-1);selectedDate=dateKey(monthCursor);refreshMonth();};
  sheet.querySelector('[data-next]').onclick=()=>{monthCursor=addMonths(monthCursor,1);selectedDate=dateKey(monthCursor);refreshMonth();};
  sheet.querySelector('[data-today]').onclick=()=>{monthCursor=startOfMonth(new Date());selectedDate=dateKey(new Date());refreshMonth();};
  sheet.querySelector('[data-month]').onclick=()=>{monthCursor=startOfMonth(new Date());selectedDate=dateKey(new Date());refreshMonth();};
  sheet.querySelector('[data-add]').onclick=()=>openEditor();
  sheet.querySelector('[data-meeting-action]').onclick=handleMeetingAction;
  sheet.querySelectorAll('[data-cancel]').forEach(node=>node.onclick=closeEditor);
  sheet.querySelector('[data-form]').onsubmit=saveEvent;
  sheet.querySelector('[data-delete]').onclick=deleteCurrentEvent;
  sheet.querySelector('[name="all_day"]').onchange=syncAllDayInputs;
  sheet.querySelector('[name="countdown_enabled"]').onchange=event=>{if(event.currentTarget.checked)sheet.querySelector('[name="timeline_enabled"]').checked=true;};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen){if(!sheet.querySelector('[data-editor]').hidden)closeEditor();else closeCalendar();}});
  renderMeetingCard();
}

async function ensureStarted(){
  const next=context();
  if(!appReady()||!next.universeId||!next.userId){
    if(launcher)launcher.hidden=true;
    stopCountdown();
    return;
  }
  ensureUI();
  launcher.hidden=false;
  const changed=activeUniverseId!==next.universeId||activeUserId!==next.userId||partner?.user_id!==next.partner?.user_id;
  activeUniverseId=next.universeId;
  activeUserId=next.userId;
  partner=next.partner;
  renderLegend();
  if(changed){
    await disconnectChannel();
    eventsCache=[];
    nextMeeting=null;
    await subscribeRealtime();
    await refreshNextMeeting();
    if(isOpen)await refreshMonth();
  }else if(!channel){
    await subscribeRealtime();
  }
}

async function subscribeRealtime(){
  if(!activeUniverseId)return;
  await disconnectChannel();
  channel=supabase().channel(`couple-calendar:${activeUniverseId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'couple_calendar_events',filter:`universe_id=eq.${activeUniverseId}`},()=>{
      refreshNextMeeting();
      if(isOpen)refreshMonth();
      else launcher?.classList.add('has-update');
    })
    .subscribe();
}

async function disconnectChannel(){
  if(!channel)return;
  const old=channel;
  channel=null;
  try{await supabase().removeChannel(old);}catch{}
}

async function openCalendar(options={}){
  await ensureStarted();
  if(!sheet)return;
  if(options?.date){const date=new Date(options.date);if(!Number.isNaN(date.getTime())){monthCursor=startOfMonth(date);selectedDate=dateKey(date);}}
  requestedEventId=options?.eventId||'';
  sheet.hidden=false;
  isOpen=true;
  launcher?.classList.remove('has-update');
  document.body.classList.add('couple-life-open');
  await Promise.all([refreshMonth(),refreshNextMeeting()]);
}

function closeCalendar(){
  if(!sheet)return;
  sheet.hidden=true;
  isOpen=false;
  closeEditor();
  document.body.classList.remove('couple-life-open');
}

async function refreshMonth(){
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
    focusRequestedEvent();
  }catch(error){
    if(token!==refreshToken)return;
    eventsCache=[];
    renderCalendar();
    const host=sheet.querySelector('[data-list]');
    host.innerHTML='<div class="couple-calendar-empty is-error"><strong>Kalender perlu diperbaiki</strong><span>Jalankan SQL v4.9.3 ALL-IN-ONE di Supabase, lalu muat ulang aplikasi.</span></div>';
    console.warn('Couple Calendar:',error);
  }
}

async function refreshNextMeeting(){
  if(!activeUniverseId||!launcher)return;
  const token=++meetingToken;
  try{
    const{data,error}=await supabase().from('couple_calendar_events')
      .select('*')
      .eq('universe_id',activeUniverseId)
      .eq('event_type','meetup')
      .eq('countdown_enabled',true)
      .gte('start_at',new Date().toISOString())
      .order('start_at',{ascending:true})
      .limit(1)
      .maybeSingle();
    if(error)throw error;
    if(token!==meetingToken)return;
    nextMeeting=data||null;
    renderMeetingCard();
    startCountdown();
  }catch(error){
    if(token!==meetingToken)return;
    nextMeeting=null;
    renderMeetingCard({error:true});
    stopCountdown();
    console.warn('Meeting Countdown:',error);
  }
}

function renderCalendarSkeleton(){
  sheet.querySelector('[data-month]').textContent=`${MONTH_NAMES[monthCursor.getMonth()]} ${monthCursor.getFullYear()}`;
  sheet.querySelector('[data-grid]').innerHTML='<div class="couple-calendar-loading"></div>';
}

function renderCalendar(){
  if(!sheet)return;
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
    if(dayEvents.some(isMeeting))button.classList.add('has-meeting');
    button.dataset.date=key;
    const number=document.createElement('span');
    number.className='couple-calendar-day__number';
    number.textContent=String(cursor.getDate());
    button.append(number);
    const stack=document.createElement('span');
    stack.className='couple-calendar-day__events';
    dayEvents.slice(0,3).forEach(item=>{
      const pill=document.createElement('span');
      pill.className=`couple-calendar-pill is-${safeColor(item.color)} ${item.owner_id===activeUserId?'is-mine':'is-partner'}${isMeeting(item)?' is-meeting':''}`;
      pill.textContent=`${isMeeting(item)?'♡ ':''}${item.title}`;
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
  const meetup=document.createElement('span');
  meetup.className='couple-calendar-person is-meeting';
  meetup.innerHTML='<i>♡</i><b>Countdown ketemuan</b>';
  host.append(meetup);
}

function renderAgenda(){
  if(!sheet)return;
  const labelDate=parseDateKey(selectedDate);
  sheet.querySelector('[data-selected-label]').textContent=new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(labelDate);
  const host=sheet.querySelector('[data-list]');
  host.innerHTML='';
  const rows=eventsForDate(selectedDate);
  if(!rows.length){host.innerHTML='<div class="couple-calendar-empty"><strong>Belum ada kegiatan</strong><span>Tambahkan agenda biasa atau jadwal ketemuan pada tanggal ini.</span></div>';return;}
  rows.forEach(item=>host.append(renderEventCard(item)));
}

function renderEventCard(item){
  const mine=item.owner_id===activeUserId;
  const meeting=isMeeting(item);
  const article=document.createElement('article');
  article.className=`couple-agenda-card is-${safeColor(item.color)} ${mine?'is-mine':'is-partner'}${meeting?' is-meeting':''}`;
  article.dataset.eventId=item.id;
  const time=document.createElement('div');
  time.className='couple-agenda-card__time';
  time.textContent=item.all_day?'Seharian':timeRange(item);
  const body=document.createElement('div');
  body.className='couple-agenda-card__body';
  const title=document.createElement('strong');
  title.textContent=item.title;
  const owner=document.createElement('small');
  owner.textContent=mine?'Jadwal saya':(partner?.profile?.display_name||'Jadwal pasangan');
  body.append(title,owner);
  if(meeting){
    const badge=document.createElement('span');
    badge.className='couple-agenda-card__meeting';
    badge.textContent=`♡ Jadwal ketemuan · ${compactCountdown(new Date(item.start_at).getTime()-Date.now())}`;
    body.append(badge);
  }
  if(item.location){const location=document.createElement('span');location.textContent=`⌖ ${item.location}`;body.append(location);}
  if(item.notes){const notes=document.createElement('p');notes.textContent=item.notes;body.append(notes);}
  article.append(time,body);
  if(mine){const edit=document.createElement('button');edit.type='button';edit.className='couple-agenda-card__edit';edit.textContent='Ubah';edit.onclick=()=>openEditor(item);article.append(edit);}
  return article;
}

function renderMeetingCard(options={}){
  if(!sheet||!launcher)return;
  const card=sheet.querySelector('[data-meeting-card]');
  const title=sheet.querySelector('[data-meeting-title]');
  const meta=sheet.querySelector('[data-meeting-meta]');
  const kicker=sheet.querySelector('[data-meeting-kicker]');
  const timer=sheet.querySelector('[data-meeting-timer]');
  const action=sheet.querySelector('[data-meeting-action]');
  const launcherCopy=launcher.querySelector('[data-calendar-launcher-copy]');
  card.classList.toggle('has-meeting',Boolean(nextMeeting));
  card.classList.toggle('has-error',Boolean(options.error));
  launcher.classList.toggle('has-meeting',Boolean(nextMeeting));
  if(options.error){
    kicker.textContent='COUNTDOWN REPAIR';
    title.textContent='Countdown belum tersambung';
    meta.textContent='Jalankan SQL v4.9.3 ALL-IN-ONE di Supabase.';
    timer.hidden=true;
    action.textContent='Buka kalender';
    launcherCopy.textContent='Perlu repair SQL';
    return;
  }
  if(!nextMeeting){
    kicker.textContent='NEXT MEETING';
    title.textContent='Belum ada jadwal ketemuan';
    meta.textContent='Buat agenda lalu aktifkan pilihan “Jadwal ketemuan”.';
    timer.hidden=true;
    action.textContent='＋ Buat jadwal';
    launcherCopy.textContent='Agenda kalian';
    return;
  }
  kicker.textContent='NEXT MEETING';
  title.textContent=nextMeeting.title;
  meta.textContent=[formatMeetingDate(nextMeeting.start_at),nextMeeting.location?`⌖ ${nextMeeting.location}`:'',nextMeeting.owner_id===activeUserId?'Dibuat oleh kamu':`Dibuat oleh ${partner?.profile?.display_name||'pasangan'}`].filter(Boolean).join(' · ');
  timer.hidden=false;
  action.textContent='Lihat jadwal';
  updateCountdownDisplay();
}

function startCountdown(){
  stopCountdown();
  if(!nextMeeting)return;
  updateCountdownDisplay();
  countdownTimer=setInterval(updateCountdownDisplay,1000);
}

function stopCountdown(){
  if(countdownTimer)clearInterval(countdownTimer);
  countdownTimer=null;
}

function updateCountdownDisplay(){
  if(!nextMeeting||!sheet||!launcher)return;
  const ms=new Date(nextMeeting.start_at).getTime()-Date.now();
  if(ms<=0){
    stopCountdown();
    setTimeout(()=>refreshNextMeeting(),700);
    return;
  }
  const parts=countdownParts(ms);
  sheet.querySelector('[data-meeting-days]').textContent=String(parts.days);
  sheet.querySelector('[data-meeting-hours]').textContent=String(parts.hours).padStart(2,'0');
  sheet.querySelector('[data-meeting-minutes]').textContent=String(parts.minutes).padStart(2,'0');
  sheet.querySelector('[data-meeting-seconds]').textContent=String(parts.seconds).padStart(2,'0');
  const launcherCopy=launcher.querySelector('[data-calendar-launcher-copy]');
  launcherCopy.textContent=parts.days>0?`Ketemu ${parts.days} hari lagi`:parts.hours>0?`Ketemu ${parts.hours} jam lagi`:`Ketemu ${Math.max(1,parts.minutes)} menit lagi`;
  launcher.classList.add('has-meeting');
  if(isOpen){
    sheet.querySelectorAll('.couple-agenda-card__meeting').forEach(node=>{
      const card=node.closest('.couple-agenda-card');
      const item=eventsCache.find(row=>row.id===card?.dataset.eventId&&isMeeting(row));
      if(item)node.textContent=`♡ Jadwal ketemuan · ${compactCountdown(new Date(item.start_at).getTime()-Date.now())}`;
    });
  }
}

function handleMeetingAction(){
  if(nextMeeting){
    const date=new Date(nextMeeting.start_at);
    monthCursor=startOfMonth(date);
    selectedDate=dateKey(date);
    refreshMonth();
    return;
  }
  selectedDate=dateKey(new Date());
  monthCursor=startOfMonth(new Date());
  openEditor(null,{meeting:true});
}

function openEditor(item=null,options={}){
  if(!sheet)return;
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
  form.elements.countdown_enabled.checked=Boolean(options.meeting||isMeeting(item));
  form.elements.timeline_enabled.checked=Boolean(item?.timeline_enabled||options.meeting);
  const color=safeColor(item?.color||'rose');
  const radio=form.querySelector(`[name="color"][value="${color}"]`);
  if(radio)radio.checked=true;
  sheet.querySelector('[data-form-title]').textContent=item?'Ubah kegiatan':(options.meeting?'Buat jadwal ketemuan':'Tambah kegiatan');
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
  const meeting=form.elements.countdown_enabled.checked;
  const timelineEnabled=form.elements.timeline_enabled.checked;
  let start=new Date(form.elements.start_at.value);
  let end=form.elements.end_at.value?new Date(form.elements.end_at.value):null;
  if(!form.reportValidity())return;
  if(!title||Number.isNaN(start.getTime())){toast('Judul dan waktu mulai wajib diisi.',{type:'error'});return;}
  if(allDay){start=new Date(start.getFullYear(),start.getMonth(),start.getDate(),0,0,0,0);end=new Date(start.getFullYear(),start.getMonth(),start.getDate(),23,59,59,999);}
  if(end&&end<start){toast('Waktu selesai tidak boleh lebih awal dari waktu mulai.',{type:'error'});return;}
  if(meeting&&start.getTime()<=Date.now()){toast('Countdown ketemuan membutuhkan waktu mulai di masa depan.',{type:'error'});return;}
  const payload={
    universe_id:activeUniverseId,
    owner_id:activeUserId,
    title,
    notes:form.elements.notes.value.trim()||null,
    location:form.elements.location.value.trim()||null,
    start_at:start.toISOString(),
    end_at:end?end.toISOString():null,
    all_day:allDay,
    color:safeColor(form.elements.color.value),
    event_type:meeting?'meetup':'personal',
    countdown_enabled:meeting,
    timeline_enabled:timelineEnabled
  };
  submit.disabled=true;
  submit.textContent='Menyimpan…';
  try{
    const rpcArgs={
      p_event_id:eventId||null,p_universe_id:activeUniverseId,p_title:payload.title,p_notes:payload.notes,p_location:payload.location,
      p_start_at:payload.start_at,p_end_at:payload.end_at,p_all_day:payload.all_day,p_color:payload.color,p_event_type:payload.event_type,
      p_countdown_enabled:payload.countdown_enabled,p_timeline_enabled:payload.timeline_enabled
    };
    let response=await supabase().rpc('save_couple_calendar_event_v470',rpcArgs);
    if(response.error&&isMissingCalendarRpc(response.error)){
      response=eventId
        ?await supabase().from('couple_calendar_events').update(payload).eq('id',eventId).eq('owner_id',activeUserId).select().single()
        :await supabase().from('couple_calendar_events').insert(payload).select().single();
      if(response.error&&isMissingTimelineColumn(response.error)){
        const legacyPayload={...payload};delete legacyPayload.timeline_enabled;
        response=eventId
          ?await supabase().from('couple_calendar_events').update(legacyPayload).eq('id',eventId).eq('owner_id',activeUserId).select().single()
          :await supabase().from('couple_calendar_events').insert(legacyPayload).select().single();
      }
    }
    if(response.error)throw response.error;
    closeEditor();
    selectedDate=dateKey(start);
    monthCursor=startOfMonth(start);
    await Promise.all([refreshMonth(),refreshNextMeeting()]);
    const savedRow=Array.isArray(response.data)?response.data[0]:response.data;
    window.dispatchEvent(new CustomEvent('our-universe:calendar-updated',{detail:{eventId:savedRow?.id||eventId||null,timelineEnabled}}));
    toast(meeting?'Countdown ketemuan berhasil disimpan.':(eventId?'Kegiatan berhasil diperbarui.':'Kegiatan berhasil ditambahkan.'),{type:'success'});
  }catch(error){toast(friendlyError(error),{type:'error',duration:7000});}
  finally{submit.disabled=false;submit.textContent='Simpan';}
}

async function deleteCurrentEvent(){
  const form=sheet.querySelector('[data-form]');
  const eventId=form.elements.event_id.value;
  if(!eventId||!confirm('Hapus kegiatan ini dari kalender?'))return;
  const button=sheet.querySelector('[data-delete]');
  button.disabled=true;
  try{
    const{error}=await supabase().from('couple_calendar_events').delete().eq('id',eventId).eq('owner_id',activeUserId);
    if(error)throw error;
    closeEditor();
    await Promise.all([refreshMonth(),refreshNextMeeting()]);
    window.dispatchEvent(new CustomEvent('our-universe:calendar-updated',{detail:{eventId,deleted:true}}));
    toast('Kegiatan berhasil dihapus.',{type:'success'});
  }catch(error){toast(friendlyError(error),{type:'error'});}
  finally{button.disabled=false;}
}

function eventsForDate(key){
  return eventsCache.filter(item=>dateKey(new Date(item.start_at))===key).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
}
function isMeeting(item){return Boolean(item&&item.event_type==='meetup'&&item.countdown_enabled);}
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
function formatMeetingDate(value){return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
function countdownParts(ms){return{days:Math.floor(ms/86400000),hours:Math.floor(ms%86400000/3600000),minutes:Math.floor(ms%3600000/60000),seconds:Math.floor(ms%60000/1000)};}
function compactCountdown(ms){if(ms<=0)return'Sudah waktunya';const parts=countdownParts(ms);if(parts.days>0)return`${parts.days} hari ${parts.hours} jam lagi`;if(parts.hours>0)return`${parts.hours} jam ${parts.minutes} menit lagi`;return`${Math.max(1,parts.minutes)} menit lagi`;}
function focusRequestedEvent(){
  if(!requestedEventId||!sheet)return;
  requestAnimationFrame(()=>{const card=sheet.querySelector(`[data-event-id="${CSS.escape(requestedEventId)}"]`);if(!card)return;card.classList.add('is-focus');card.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>card.classList.remove('is-focus'),2200);requestedEventId='';});
}
function isMissingCalendarRpc(error){const message=String(error?.message||error||'');return /save_couple_calendar_event_v470|function.*not found|schema cache/i.test(message);}
function isMissingTimelineColumn(error){const message=String(error?.message||error||'');return /timeline_enabled/i.test(message);}
function friendlyError(error){
  const message=String(error?.message||error||'');
  if(message.includes('timeline_enabled')||message.includes('save_couple_calendar_event_v470'))return'Jalankan SQL v4.9.3 ALL-IN-ONE agar kalender dan Love Timeline tersambung penuh.';
  if(message.includes('event_type')||message.includes('countdown_enabled')||message.includes('start_at')||message.includes('couple_calendar_events')||message.includes('schema cache'))return'Kalender membutuhkan SQL v4.9.3 ALL-IN-ONE di Supabase.';
  return message||'Kegiatan belum dapat disimpan.';
}

events.on('realtime:change',event=>{if(['universe_members','profiles'].includes(event.detail?.table))scheduleStart(320);});
events.on('state:change',event=>{if(['user','universe','members'].includes(event.detail?.key))scheduleStart(90);});
window.addEventListener('our-universe:context-ready',()=>scheduleStart(0));
window.addEventListener('our-universe:context-cleared',()=>{clearTimeout(startupTimer);closeCalendar();activeUniverseId='';activeUserId='';partner=null;eventsCache=[];nextMeeting=null;stopCountdown();void disconnectChannel();if(launcher)launcher.hidden=true;});
window.addEventListener('our-universe:open-calendar',event=>openCalendar(event.detail||{}));
window.addEventListener('online',()=>scheduleStart(250));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleStart(180);});
window.addEventListener('pagehide',()=>{disconnectChannel();stopCountdown();clearTimeout(startupTimer);});
scheduleStart(0);
