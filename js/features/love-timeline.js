import { supabase } from '../core/supabase.js';
import { toast } from '../components/toast.js';

const KIND_META={
  memory:{label:'Kenangan',icon:'✦'},
  first:{label:'Pertama kali',icon:'☄'},
  date:{label:'Kencan',icon:'♡'},
  promise:{label:'Janji',icon:'∞'},
  milestone:{label:'Pencapaian',icon:'◉'},
  celebration:{label:'Perayaan',icon:'✺'}
};
const COLORS=['rose','violet','blue','mint','amber'];

export function createLoveTimeline(api){
  let host=null;
  let rows=[];
  let active=false;
  let loading=false;
  let filter='all';
  let sort='desc';
  let loadToken=0;

  function mount(target){
    host=target;
    host.innerHTML=`<div class="love-timeline">
      <section class="bond-hero love-timeline-hero">
        <div class="love-timeline-orbit" aria-hidden="true"><span>♡</span><i></i><b></b><em>✦</em><em>☾</em><em>∞</em></div>
        <div><p class="bond-kicker">LOVE TIMELINE · GALAXY JOURNEY</p><h3>Perjalanan kalian dalam satu garis bintang.</h3><span class="bond-muted">Momen buatan kalian dan agenda kalender pilihan akan muncul dalam satu timeline bersama.</span></div>
        <button class="bond-primary" type="button" data-timeline-add>＋ Tambah momen</button>
      </section>
      <section class="love-timeline-toolbar" aria-label="Filter Love Timeline">
        <div class="love-timeline-filters">
          <button type="button" class="is-active" data-timeline-filter="all">Semua</button>
          <button type="button" data-timeline-filter="moment">Momen</button>
          <button type="button" data-timeline-filter="calendar">Kalender</button>
        </div>
        <button class="love-timeline-sort" type="button" data-timeline-sort>Terbaru dulu ↓</button>
      </section>
      <section class="love-timeline-stage" data-timeline-stage><div class="bond-empty bond-empty--large"><strong>Menyiapkan orbit timeline…</strong><span>Menghubungkan momen kalian.</span></div></section>
      <div class="love-timeline-editor" data-timeline-editor hidden>
        <form data-timeline-form>
          <header><div><small>MOMEN BARU</small><strong data-timeline-form-title>Tambahkan bintang ke perjalanan kalian</strong></div><button type="button" data-timeline-cancel aria-label="Tutup">×</button></header>
          <input type="hidden" name="moment_id">
          <label class="bond-field"><span>Judul momen</span><input name="title" maxlength="140" required placeholder="Contoh: Hari pertama kita bertemu"></label>
          <div class="love-timeline-form-row">
            <label class="bond-field"><span>Waktu momen</span><input name="moment_at" type="datetime-local" required></label>
            <label class="bond-field"><span>Jenis momen</span><select name="kind">${Object.entries(KIND_META).map(([value,item])=>`<option value="${value}">${item.icon} ${item.label}</option>`).join('')}</select></label>
          </div>
          <div class="love-timeline-form-row love-timeline-form-row--small">
            <label class="bond-field"><span>Simbol</span><input name="emoji" maxlength="12" value="♡" placeholder="♡"></label>
            <fieldset><legend>Warna orbit</legend><div class="love-timeline-colors">${COLORS.map((color,index)=>`<label><input type="radio" name="color" value="${color}" ${index===0?'checked':''}><span class="is-${color}"></span></label>`).join('')}</div></fieldset>
          </div>
          <label class="bond-field"><span>Cerita singkat</span><textarea name="story" maxlength="2400" rows="5" placeholder="Tuliskan alasan momen ini penting untuk kalian…"></textarea></label>
          <div class="love-timeline-form-actions"><button class="bond-danger" type="button" data-timeline-delete hidden>Hapus</button><span></span><button class="bond-secondary" type="button" data-timeline-cancel>Batal</button><button class="bond-primary" type="submit">Simpan momen</button></div>
        </form>
      </div>
    </div>`;
    host.querySelector('[data-timeline-add]').onclick=()=>openEditor();
    host.querySelectorAll('[data-timeline-filter]').forEach(button=>button.onclick=()=>setFilter(button.dataset.timelineFilter));
    host.querySelector('[data-timeline-sort]').onclick=toggleSort;
    host.querySelectorAll('[data-timeline-cancel]').forEach(button=>button.onclick=closeEditor);
    host.querySelector('[data-timeline-form]').onsubmit=saveMoment;
    host.querySelector('[data-timeline-delete]').onclick=deleteMoment;
  }

  async function activate(){
    active=true;
    api.setSubtitle('Love Timeline menggabungkan momen khusus dan agenda kalender pilihan.');
    await load();
  }
  function deactivate(){active=false;closeEditor();}
  async function contextChanged(){rows=[];if(active)await load();}
  function realtime(){if(active)load();}

  async function load(){
    const {universeId}=api.getContext();
    if(!host||!universeId||loading)return;
    loading=true;
    const token=++loadToken;
    renderLoading();
    try{
      const [momentsResult,calendarResult]=await Promise.all([
        supabase().from('love_timeline_moments').select('*').eq('universe_id',universeId).order('moment_at',{ascending:false}).limit(300),
        supabase().from('couple_calendar_events').select('id,owner_id,title,notes,location,start_at,end_at,all_day,color,event_type,countdown_enabled,timeline_enabled').eq('universe_id',universeId).eq('timeline_enabled',true).order('start_at',{ascending:false}).limit(300)
      ]);
      if(momentsResult.error)throw momentsResult.error;
      if(calendarResult.error)throw calendarResult.error;
      if(token!==loadToken)return;
      rows=[
        ...(momentsResult.data||[]).map(item=>normalizeMoment(item)),
        ...(calendarResult.data||[]).map(item=>normalizeCalendar(item))
      ];
      render();
    }catch(error){
      if(token!==loadToken)return;
      renderError(error);
    }finally{if(token===loadToken)loading=false;}
  }

  function renderLoading(){
    const stage=host?.querySelector('[data-timeline-stage]');
    if(stage)stage.innerHTML='<div class="love-timeline-loading"><i></i><i></i><i></i></div>';
  }

  function render(){
    const stage=host.querySelector('[data-timeline-stage]');
    stage.innerHTML='';
    const filtered=rows.filter(item=>filter==='all'||item.source===filter).sort((a,b)=>sort==='desc'?b.timestamp-a.timestamp:a.timestamp-b.timestamp);
    if(!filtered.length){
      stage.innerHTML='<div class="bond-empty bond-empty--large"><strong>Timeline masih menunggu cerita pertama</strong><span>Tambahkan momen baru atau aktifkan “Masukkan ke Love Timeline” saat menyimpan agenda kalender.</span></div>';
      return;
    }
    const rail=document.createElement('div');
    rail.className='love-timeline-rail';
    let lastYear='';
    filtered.forEach((item,index)=>{
      const year=String(new Date(item.timestamp).getFullYear());
      if(year!==lastYear){
        const marker=document.createElement('div');marker.className='love-timeline-year';marker.textContent=year;rail.append(marker);lastYear=year;
      }
      rail.append(renderItem(item,index));
    });
    stage.append(rail);
  }

  function renderItem(item,index){
    const {userId,partner}=api.getContext();
    const mine=item.ownerId===userId;
    const article=document.createElement('article');
    article.className=`love-timeline-item is-${item.color} ${index%2?'is-right':'is-left'} is-${item.source}`;
    const star=document.createElement('span');star.className='love-timeline-item__star';star.textContent=item.emoji;
    const card=document.createElement('div');card.className='love-timeline-item__card';
    const meta=document.createElement('div');meta.className='love-timeline-item__meta';
    const source=document.createElement('span');source.className='love-timeline-source';source.textContent=item.source==='calendar'?'▦ Dari kalender':`${KIND_META[item.kind]?.icon||'✦'} ${KIND_META[item.kind]?.label||'Momen'}`;
    const time=document.createElement('time');time.dateTime=new Date(item.timestamp).toISOString();time.textContent=formatDate(item.timestamp,item.allDay);
    meta.append(source,time);
    const title=document.createElement('h4');title.textContent=item.title;
    card.append(meta,title);
    if(item.story){const story=document.createElement('p');story.textContent=item.story;card.append(story);}
    const footer=document.createElement('footer');
    const owner=document.createElement('small');owner.textContent=mine?'Ditambahkan oleh kamu':`Dari ${partner?.profile?.display_name||'pasangan'}`;footer.append(owner);
    if(item.source==='moment'&&mine){const edit=document.createElement('button');edit.type='button';edit.textContent='Ubah';edit.onclick=()=>openEditor(item.raw);footer.append(edit);}
    if(item.source==='calendar'){
      const open=document.createElement('button');open.type='button';open.textContent='Buka kalender';open.onclick=()=>{api.closePanel();setTimeout(()=>window.dispatchEvent(new CustomEvent('our-universe:open-calendar',{detail:{eventId:item.raw.id,date:item.raw.start_at}})),120);};footer.append(open);
    }
    card.append(footer);article.append(star,card);return article;
  }

  function renderError(error){
    const stage=host.querySelector('[data-timeline-stage]');
    stage.innerHTML='<div class="bond-empty bond-empty--large is-error"><strong>Love Timeline belum tersambung</strong><span>Jalankan SQL v4.9.3 ALL-IN-ONE di Supabase, lalu muat ulang aplikasi.</span></div>';
    console.warn('Love Timeline:',error);
  }

  function setFilter(next){
    filter=['all','moment','calendar'].includes(next)?next:'all';
    host.querySelectorAll('[data-timeline-filter]').forEach(button=>button.classList.toggle('is-active',button.dataset.timelineFilter===filter));
    render();
  }

  function toggleSort(){
    sort=sort==='desc'?'asc':'desc';
    host.querySelector('[data-timeline-sort]').textContent=sort==='desc'?'Terbaru dulu ↓':'Dari awal ↑';
    render();
  }

  function openEditor(item=null){
    const editor=host.querySelector('[data-timeline-editor]');
    const form=host.querySelector('[data-timeline-form]');
    form.reset();
    form.elements.moment_id.value=item?.id||'';
    form.elements.title.value=item?.title||'';
    form.elements.moment_at.value=toLocalInput(item?.moment_at?new Date(item.moment_at):new Date());
    form.elements.kind.value=item?.kind||'memory';
    form.elements.emoji.value=item?.emoji||'♡';
    form.elements.story.value=item?.story||'';
    const color=COLORS.includes(item?.color)?item.color:'rose';
    const radio=form.querySelector(`[name="color"][value="${color}"]`);if(radio)radio.checked=true;
    host.querySelector('[data-timeline-form-title]').textContent=item?'Ubah momen kalian':'Tambahkan bintang ke perjalanan kalian';
    host.querySelector('[data-timeline-delete]').hidden=!item;
    editor.hidden=false;
    setTimeout(()=>form.elements.title.focus(),60);
  }

  function closeEditor(){const editor=host?.querySelector('[data-timeline-editor]');if(editor)editor.hidden=true;}

  async function saveMoment(event){
    event.preventDefault();
    const {universeId,userId}=api.getContext();
    const form=event.currentTarget;
    if(!form.reportValidity())return;
    const momentAt=new Date(form.elements.moment_at.value);
    if(Number.isNaN(momentAt.getTime())){toast('Waktu momen belum valid.',{type:'error'});return;}
    const payload={
      universe_id:universeId,
      owner_id:userId,
      title:form.elements.title.value.trim(),
      story:form.elements.story.value.trim()||null,
      moment_at:momentAt.toISOString(),
      kind:Object.hasOwn(KIND_META,form.elements.kind.value)?form.elements.kind.value:'memory',
      emoji:form.elements.emoji.value.trim()||'♡',
      color:COLORS.includes(form.elements.color.value)?form.elements.color.value:'rose'
    };
    const id=form.elements.moment_id.value;
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Menyimpan…';
    try{
      const response=id
        ?await supabase().from('love_timeline_moments').update(payload).eq('id',id).eq('owner_id',userId).select().single()
        :await supabase().from('love_timeline_moments').insert(payload).select().single();
      if(response.error)throw response.error;
      closeEditor();await load();toast(id?'Momen berhasil diperbarui.':'Momen baru masuk ke Love Timeline.',{type:'success'});
    }catch(error){toast(friendlyError(error),{type:'error',duration:6500});}
    finally{submit.disabled=false;submit.textContent='Simpan momen';}
  }

  async function deleteMoment(){
    const {userId}=api.getContext();
    const form=host.querySelector('[data-timeline-form]');
    const id=form.elements.moment_id.value;
    if(!id||!confirm('Hapus momen ini dari Love Timeline?'))return;
    const button=host.querySelector('[data-timeline-delete]');button.disabled=true;
    try{
      const {error}=await supabase().from('love_timeline_moments').delete().eq('id',id).eq('owner_id',userId);
      if(error)throw error;closeEditor();await load();toast('Momen berhasil dihapus.',{type:'success'});
    }catch(error){toast(friendlyError(error),{type:'error'});}
    finally{button.disabled=false;}
  }

  function normalizeMoment(item){return{source:'moment',id:item.id,ownerId:item.owner_id,title:item.title,story:item.story||'',timestamp:new Date(item.moment_at).getTime(),kind:item.kind,emoji:item.emoji||'♡',color:COLORS.includes(item.color)?item.color:'rose',allDay:false,raw:item};}
  function normalizeCalendar(item){
    const location=item.location?`⌖ ${item.location}`:'';
    const story=[item.notes||'',location].filter(Boolean).join('\n');
    return{source:'calendar',id:`calendar:${item.id}`,ownerId:item.owner_id,title:item.title,story,timestamp:new Date(item.start_at).getTime(),kind:item.event_type==='meetup'?'date':'milestone',emoji:item.event_type==='meetup'?'♡':'▦',color:COLORS.includes(item.color)?item.color:'violet',allDay:Boolean(item.all_day),raw:item};
  }

  return{mount,activate,deactivate,contextChanged,realtime};
}

function formatDate(timestamp,allDay=false){
  const options={weekday:'long',day:'numeric',month:'long',year:'numeric'};
  if(!allDay){options.hour='2-digit';options.minute='2-digit';}
  return new Intl.DateTimeFormat('id-ID',options).format(new Date(timestamp));
}
function toLocalInput(date){const pad=value=>String(value).padStart(2,'0');return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;}
function friendlyError(error){const message=String(error?.message||error||'');if(/love_timeline|timeline_enabled|schema cache|relation/i.test(message))return'Love Timeline membutuhkan SQL v4.9.3 ALL-IN-ONE di Supabase.';return message||'Momen belum dapat disimpan.';}
