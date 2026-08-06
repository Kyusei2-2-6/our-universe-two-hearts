import { supabase } from '../core/supabase.js';
import { toast } from '../components/toast.js';

export function createRelationshipStats(api){
  let host=null;
  let active=false;
  let loading=false;
  let token=0;
  let snapshot=null;

  function mount(target){
    host=target;
    host.innerHTML=`<div class="relationship-stats relationship-journey">
      <section class="relationship-stats-hero relationship-journey-hero">
        <div class="relationship-stats-orbit" aria-hidden="true">
          <span class="relationship-stats-orbit__ring is-one"><i>✦</i></span>
          <span class="relationship-stats-orbit__ring is-two"><i>♡</i></span>
          <span class="relationship-stats-orbit__ring is-three"><i>☾</i></span>
          <div><strong data-stats-days>0</strong><small data-stats-days-label>hari terhubung</small></div>
        </div>
        <div class="relationship-stats-hero__copy"><p class="bond-kicker">RELATIONSHIP JOURNEY · TWO HEARTS</p><h3>Berapa lama kalian telah memilih orbit yang sama?</h3><span class="bond-muted">Tanggal, milestone, dan jejak semesta dirangkai menjadi perjalanan hubungan yang hanya dapat dilihat oleh kalian berdua.</span><div class="relationship-stats-duration" data-stats-duration></div><div class="relationship-stats-since" data-stats-since></div></div>
        <button class="bond-secondary" type="button" data-stats-edit>Atur perjalanan</button>
      </section>
      <section class="relationship-journey-map" data-stats-journey></section>
      <section class="relationship-stats-grid" data-stats-grid><div class="bond-empty bond-empty--large"><strong>Menghitung bintang kalian…</strong><span>Membaca jejak dari semesta bersama.</span></div></section>
      <section class="relationship-insights" data-stats-insights></section>
      <div class="relationship-stats-editor relationship-journey-editor" data-stats-editor hidden>
        <form data-stats-form>
          <header><div><small>RELATIONSHIP JOURNEY</small><strong>Simpan titik penting hubungan kalian</strong></div><button type="button" data-stats-cancel aria-label="Tutup">×</button></header>
          <div class="relationship-stats-form-row">
            <label class="bond-field"><span>Nama penghitung utama</span><input name="connection_title" maxlength="80" required value="Terhubung Sejak"></label>
            <label class="bond-field"><span>Tanggal mulai terhubung</span><input name="connected_on" type="date"></label>
          </div>
          <div class="relationship-journey-form-grid">
            <label class="bond-field"><span>Pertama berkomunikasi</span><input name="first_chat_on" type="date"></label>
            <label class="bond-field"><span>Pertama bertemu</span><input name="first_met_on" type="date"></label>
            <label class="bond-field"><span>Kencan pertama</span><input name="first_date_on" type="date"></label>
            <label class="bond-field"><span>Mulai bersama</span><input name="started_on" type="date"></label>
          </div>
          <label class="bond-field"><span>Nama hari jadi</span><input name="anniversary_title" maxlength="80" required value="Hari Kita"></label>
          <label class="bond-field"><span>Cerita singkat hubungan kalian</span><textarea name="relationship_story" maxlength="2400" rows="5" placeholder="Ceritakan bagaimana dua orbit ini akhirnya saling menemukan…"></textarea></label>
          <p class="relationship-stats-note">Tanggal ini tidak dipublikasikan. Data hanya tersimpan di semesta privat kalian dan dapat diubah kapan saja.</p>
          <div class="relationship-stats-form-actions"><button class="bond-secondary" type="button" data-stats-cancel>Batal</button><button class="bond-primary" type="submit">Simpan perjalanan</button></div>
        </form>
      </div>
    </div>`;
    host.querySelector('[data-stats-edit]').onclick=openEditor;
    host.querySelectorAll('[data-stats-cancel]').forEach(button=>button.onclick=closeEditor);
    host.querySelector('[data-stats-form]').onsubmit=saveProfile;
  }

  async function activate(){active=true;api.setSubtitle('Relationship Journey menghitung durasi dan merangkai milestone nyata kalian.');await load();}
  function deactivate(){active=false;closeEditor();}
  async function contextChanged(){snapshot=null;if(active)await load();}
  function realtime(){if(active)load();}

  async function load(){
    const {universeId}=api.getContext();
    if(!host||!universeId||loading)return;
    loading=true;const current=++token;renderLoading();
    try{
      const client=supabase();
      const results=await Promise.all([
        client.from('couple_relationship_profiles').select('*').eq('universe_id',universeId).maybeSingle(),
        client.from('entries').select('id,type,event_date,created_at,favorite,created_by',{count:'exact'}).eq('universe_id',universeId).limit(2000),
        client.from('attachments').select('id,kind,created_at',{count:'exact'}).eq('universe_id',universeId).limit(2000),
        client.from('planets').select('id,created_at,created_by',{count:'exact'}).eq('universe_id',universeId).limit(1000),
        client.from('couple_calendar_events').select('id,event_type,start_at,timeline_enabled,owner_id',{count:'exact'}).eq('universe_id',universeId).limit(2000),
        client.from('love_timeline_moments').select('id,moment_at,owner_id',{count:'exact'}).eq('universe_id',universeId).limit(2000),
        client.from('bond_pulses').select('id,pulse_type,sender_id,created_at',{count:'exact'}).eq('universe_id',universeId).limit(2000),
        client.from('couple_messages').select('id,sender_id,created_at',{count:'exact'}).eq('universe_id',universeId).limit(2000),
        client.from('comments').select('id,user_id,created_at',{count:'exact'}).eq('universe_id',universeId).limit(2000)
      ]);
      const firstError=results.find(result=>result.error)?.error;if(firstError)throw firstError;
      if(current!==token)return;
      snapshot=buildSnapshot(results);
      render();
    }catch(error){if(current!==token)return;renderError(error);}
    finally{if(current===token)loading=false;}
  }

  function buildSnapshot(results){
    const [profileResult,entriesResult,attachmentsResult,planetsResult,calendarResult,timelineResult,pulsesResult,messagesResult,commentsResult]=results;
    const entries=entriesResult.data||[];
    const attachments=attachmentsResult.data||[];
    const planets=planetsResult.data||[];
    const calendar=calendarResult.data||[];
    const timeline=timelineResult.data||[];
    const pulses=pulsesResult.data||[];
    const messages=messagesResult.data||[];
    const comments=commentsResult.data||[];
    const profile=profileResult.data||null;
    const now=Date.now();
    const linkedCalendar=calendar.filter(item=>item.timeline_enabled);
    const moments=[
      ...entries.map(item=>({at:item.event_date||item.created_at,owner:item.created_by,type:'entry'})),
      ...calendar.map(item=>({at:item.start_at,owner:item.owner_id,type:'calendar'})),
      ...timeline.map(item=>({at:item.moment_at,owner:item.owner_id,type:'timeline'})),
      ...pulses.map(item=>({at:item.created_at,owner:item.sender_id,type:'pulse'})),
      ...messages.map(item=>({at:item.created_at,owner:item.sender_id,type:'message'})),
      ...comments.map(item=>({at:item.created_at,owner:item.user_id,type:'comment'})),
      ...planets.map(item=>({at:item.created_at,owner:item.created_by,type:'planet'}))
    ].filter(item=>item.at&&Number.isFinite(new Date(item.at).getTime()));
    const firstMoment=moments.length?moments.reduce((earliest,item)=>new Date(item.at)<new Date(earliest.at)?item:earliest):null;
    const types=entries.reduce((map,item)=>map.set(item.type,(map.get(item.type)||0)+1),new Map());
    const media={photos:attachments.filter(item=>item.kind==='image').length,videos:attachments.filter(item=>item.kind==='video').length,audio:attachments.filter(item=>item.kind==='audio').length};
    const futureMeetups=calendar.filter(item=>item.event_type==='meetup'&&new Date(item.start_at).getTime()>now).length;
    const meetups=calendar.filter(item=>item.event_type==='meetup').length;
    const favorites=entries.filter(item=>item.favorite).length;
    const activeCategories=[entries.length,attachments.length,calendar.length,timeline.length,pulses.length,messages.length,comments.length,planets.length].filter(Boolean).length;
    const orbitPercent=Math.round(activeCategories/8*100);
    return{
      profile,entries,attachments,planets,calendar,timeline,pulses,messages,comments,moments,types,media,firstMoment,
      counts:{
        entries:entriesResult.count??entries.length,
        attachments:attachmentsResult.count??attachments.length,
        planets:planetsResult.count??planets.length,
        calendar:calendarResult.count??calendar.length,
        timeline:(timelineResult.count??timeline.length)+linkedCalendar.length,
        pulses:pulsesResult.count??pulses.length,
        messages:messagesResult.count??messages.length,
        comments:commentsResult.count??comments.length,
        meetups,futureMeetups,favorites,orbitPercent
      }
    };
  }

  function renderLoading(){
    const journey=host?.querySelector('[data-stats-journey]');if(journey)journey.innerHTML='<div class="relationship-journey-loading"><i></i><i></i><i></i></div>';
    const grid=host?.querySelector('[data-stats-grid]');if(grid)grid.innerHTML='<div class="relationship-stats-loading"><i></i><i></i><i></i><i></i></div>';
    const insights=host?.querySelector('[data-stats-insights]');if(insights)insights.innerHTML='';
  }

  function render(){
    if(!snapshot)return;
    renderHero();
    renderJourney();
    const grid=host.querySelector('[data-stats-grid]');grid.innerHTML='';
    const cards=[
      {icon:'✦',value:snapshot.counts.entries,label:'Cerita tersimpan',detail:entryDetail(snapshot.types)},
      {icon:'▧',value:snapshot.media.photos,label:'Foto bersama',detail:`${snapshot.media.videos} video · ${snapshot.media.audio} audio`},
      {icon:'◉',value:snapshot.counts.planets,label:'Planet dibuat',detail:`${snapshot.counts.favorites} cerita favorit`},
      {icon:'⌁',value:snapshot.counts.timeline,label:'Momen timeline',detail:'Momen manual + agenda pilihan'},
      {icon:'♡',value:snapshot.counts.meetups,label:'Jadwal ketemuan',detail:`${snapshot.counts.futureMeetups} jadwal mendatang`},
      {icon:'♢',value:snapshot.counts.pulses,label:'Heartbeat terkirim',detail:pulseDetail(snapshot.pulses)},
      {icon:'✉',value:snapshot.counts.messages,label:'Pesan pasangan',detail:`${snapshot.counts.comments} komentar kenangan`},
      {icon:'∞',value:`${snapshot.counts.orbitPercent}%`,label:'Orbit semesta aktif',detail:'Kategori fitur yang sudah terisi'}
    ];
    cards.forEach((item,index)=>grid.append(createStatCard(item,index)));
    renderInsights();
  }

  function renderHero(){
    const profile=snapshot.profile;
    const base=relationshipBase(profile);
    const days=base?daysSince(base):null;
    host.querySelector('[data-stats-days]').textContent=days===null?'♡':formatNumber(days);
    host.querySelector('[data-stats-days-label]').textContent=days===null?'atur tanggal kalian':'hari terhubung';
    const duration=host.querySelector('[data-stats-duration]');duration.innerHTML='';
    if(base){
      const parts=durationParts(base,new Date());
      [['Tahun',parts.years],['Bulan',parts.months],['Hari',parts.days]].forEach(([label,value])=>{
        const item=document.createElement('span');const strong=document.createElement('strong');strong.textContent=String(value);const small=document.createElement('small');small.textContent=label;item.append(strong,small);duration.append(item);
      });
    }
    const since=host.querySelector('[data-stats-since]');since.innerHTML='';
    if(base){
      const strong=document.createElement('strong');strong.textContent=profile?.connection_title||'Terhubung Sejak';
      const span=document.createElement('span');span.textContent=`${formatDateOnly(base)} · ${formatDuration(durationParts(base,new Date()))}`;
      since.append(strong,span);
    }else if(snapshot.firstMoment){
      const strong=document.createElement('strong');strong.textContent='Jejak pertama di aplikasi';
      const span=document.createElement('span');span.textContent=`${formatDate(snapshot.firstMoment.at)} · tanggal hubungan belum diatur`;
      since.append(strong,span);
    }else{
      since.textContent='Belum ada tanggal atau jejak yang tersimpan.';
    }
    host.querySelector('[data-stats-edit]').textContent=profile?'Ubah perjalanan':'Atur perjalanan';
  }

  function renderJourney(){
    const section=host.querySelector('[data-stats-journey]');section.innerHTML='';
    const profile=snapshot.profile||{};
    const base=relationshipBase(profile);
    const summary=document.createElement('div');summary.className='relationship-journey-summary';
    summary.append(createJourneySummaryCard('∞','Waktu dalam satu orbit',base?formatDuration(durationParts(base,new Date())):'Belum diatur',base?`${formatNumber(daysSince(base))} hari sejak ${formatDateOnly(base)}`:'Isi tanggal mulai terhubung untuk menyalakan penghitung.'));
    const anniversary=nextAnniversary(profile.started_on||profile.connected_on);
    summary.append(createJourneySummaryCard('☾',profile.anniversary_title||'Hari Kita',anniversary?anniversary.title:'Belum dihitung',anniversary?anniversary.detail:'Isi tanggal mulai bersama atau tanggal terhubung.'));
    section.append(summary);

    const milestones=relationshipMilestones(profile,snapshot.firstMoment,api.getContext().snapshot?.universe?.created_at);
    const timeline=document.createElement('article');timeline.className='relationship-journey-timeline bond-card';
    timeline.innerHTML='<header><div><small>CONSTELLATION OF US</small><strong>Titik perjalanan kalian</strong></div><span>tersusun berdasarkan tanggal</span></header>';
    const line=document.createElement('div');line.className='relationship-journey-line';
    if(!milestones.length){
      const empty=document.createElement('div');empty.className='relationship-journey-empty';empty.innerHTML='<span>✧</span><div><strong>Konstelasi ini masih menunggu titik pertama</strong><small>Tambahkan tanggal berkomunikasi, bertemu, berkencan, atau mulai bersama.</small></div>';
      line.append(empty);
    }else{
      milestones.forEach((item,index)=>line.append(createMilestone(item,index)));
    }
    timeline.append(line);section.append(timeline);

    if(profile.relationship_story){
      const story=document.createElement('article');story.className='relationship-journey-story bond-card';
      story.innerHTML='<header><div><small>OUR STORY</small><strong>Cerita di balik dua orbit</strong></div><span>♡</span></header>';
      const text=document.createElement('p');text.textContent=profile.relationship_story;story.append(text);section.append(story);
    }
  }

  function createJourneySummaryCard(icon,label,value,detail){
    const article=document.createElement('article');article.className='relationship-journey-summary-card';
    const mark=document.createElement('span');mark.textContent=icon;
    const copy=document.createElement('div');const small=document.createElement('small');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;const em=document.createElement('em');em.textContent=detail;copy.append(small,strong,em);article.append(mark,copy);return article;
  }

  function createMilestone(item,index){
    const node=document.createElement('div');node.className='relationship-journey-milestone';node.style.setProperty('--journey-index',String(index));
    const star=document.createElement('span');star.textContent=item.icon;
    const copy=document.createElement('div');const small=document.createElement('small');small.textContent=formatDateOnly(item.date);const strong=document.createElement('strong');strong.textContent=item.label;const em=document.createElement('em');em.textContent=item.detail;copy.append(small,strong,em);node.append(star,copy);return node;
  }

  function createStatCard(item,index){
    const article=document.createElement('article');article.className='relationship-stat-card';article.style.setProperty('--stat-index',String(index));
    const icon=document.createElement('span');icon.textContent=item.icon;
    const copy=document.createElement('div');const strong=document.createElement('strong');strong.textContent=typeof item.value==='number'?formatNumber(item.value):item.value;const label=document.createElement('b');label.textContent=item.label;const small=document.createElement('small');small.textContent=item.detail;copy.append(strong,label,small);article.append(icon,copy);return article;
  }

  function renderInsights(){
    const section=host.querySelector('[data-stats-insights]');section.innerHTML='';
    const contribution=contributionData(snapshot,api.getContext());
    const balance=document.createElement('article');balance.className='bond-card relationship-contribution';
    balance.innerHTML='<header><div><small>JEJAK KONTRIBUSI</small><strong>Siapa yang menyalakan bintang?</strong></div><span>berdasarkan data tersimpan</span></header>';
    const bars=document.createElement('div');bars.className='relationship-contribution-bars';
    bars.append(createContributionRow('Kamu',contribution.mine,contribution.total,'is-mine'),createContributionRow(api.getContext().partner?.profile?.display_name||'Pasangan',contribution.partner,contribution.total,'is-partner'));
    const note=document.createElement('p');note.textContent='Perbandingan ini hanya menghitung item yang memiliki pembuat, seperti cerita, momen, agenda, pesan, dan Heartbeat.';balance.append(bars,note);

    const activity=document.createElement('article');activity.className='bond-card relationship-monthly';
    activity.innerHTML='<header><div><small>6 BULAN TERAKHIR</small><strong>Aktivitas semesta</strong></div><span>semua jejak</span></header>';
    activity.append(createMonthlyBars(snapshot.moments));

    const first=document.createElement('article');first.className='bond-card relationship-first';
    first.innerHTML='<header><div><small>FIRST LIGHT</small><strong>Jejak paling awal</strong></div></header>';
    const firstBody=document.createElement('div');firstBody.className='relationship-first-body';
    const icon=document.createElement('span');icon.textContent='☄';const copy=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent=snapshot.firstMoment?formatDate(snapshot.firstMoment.at):'Belum ada jejak';
    const small=document.createElement('small');small.textContent=snapshot.firstMoment?firstMomentLabel(snapshot.firstMoment.type):'Isi planet atau timeline untuk menyalakan bintang pertama.';copy.append(strong,small);firstBody.append(icon,copy);first.append(firstBody);
    section.append(balance,activity,first);
  }

  function renderError(error){
    host.querySelector('[data-stats-journey]').innerHTML='<div class="bond-empty bond-empty--large is-error"><strong>Relationship Journey belum tersambung</strong><span>Jalankan migration v4.9.0 di Supabase, lalu muat ulang aplikasi.</span></div>';
    host.querySelector('[data-stats-grid]').innerHTML='';
    host.querySelector('[data-stats-insights]').innerHTML='';
    console.warn('Relationship Journey:',error);
  }

  function openEditor(){
    const form=host.querySelector('[data-stats-form]');form.reset();
    const profile=snapshot?.profile||{};
    form.elements.connection_title.value=profile.connection_title||'Terhubung Sejak';
    form.elements.connected_on.value=profile.connected_on||profile.started_on||profile.first_met_on||'';
    form.elements.first_chat_on.value=profile.first_chat_on||'';
    form.elements.first_met_on.value=profile.first_met_on||'';
    form.elements.first_date_on.value=profile.first_date_on||'';
    form.elements.started_on.value=profile.started_on||'';
    form.elements.anniversary_title.value=profile.anniversary_title||'Hari Kita';
    form.elements.relationship_story.value=profile.relationship_story||'';
    const today=new Date().toISOString().slice(0,10);
    form.querySelectorAll('input[type="date"]').forEach(input=>input.max=today);
    host.querySelector('[data-stats-editor]').hidden=false;
    form.elements.connection_title.focus();
  }
  function closeEditor(){const editor=host?.querySelector('[data-stats-editor]');if(editor)editor.hidden=true;}

  async function saveProfile(event){
    event.preventDefault();
    const {universeId,userId}=api.getContext();const form=event.currentTarget;
    if(!form.reportValidity())return;
    const fields=['connected_on','first_chat_on','first_met_on','first_date_on','started_on'];
    const dates=Object.fromEntries(fields.map(name=>[name,form.elements[name].value||null]));
    const today=new Date().toISOString().slice(0,10);
    if(fields.some(name=>dates[name]&&dates[name]>today)){toast('Tanggal perjalanan tidak boleh berada di masa depan.',{type:'error'});return;}
    if(dates.first_met_on&&dates.started_on&&dates.first_met_on>dates.started_on){toast('Tanggal pertama bertemu tidak boleh setelah tanggal mulai bersama.',{type:'error'});return;}
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Menyimpan…';
    try{
      const payload={
        universe_id:universeId,
        connection_title:form.elements.connection_title.value.trim(),
        connected_on:dates.connected_on,
        first_chat_on:dates.first_chat_on,
        first_met_on:dates.first_met_on,
        first_date_on:dates.first_date_on,
        started_on:dates.started_on,
        anniversary_title:form.elements.anniversary_title.value.trim(),
        relationship_story:form.elements.relationship_story.value.trim(),
        updated_by:userId
      };
      const {data,error}=await supabase().from('couple_relationship_profiles').upsert(payload,{onConflict:'universe_id'}).select().single();
      if(error)throw error;closeEditor();await load();window.dispatchEvent(new CustomEvent('our-universe:relationship-updated',{detail:{profile:data||payload}}));toast('Relationship Journey berhasil disimpan.',{type:'success'});
    }catch(error){toast(friendlyError(error),{type:'error',duration:6500});}
    finally{submit.disabled=false;submit.textContent='Simpan perjalanan';}
  }

  return{mount,activate,deactivate,contextChanged,realtime};
}

function relationshipBase(profile){return profile?.connected_on||profile?.started_on||profile?.first_met_on||null;}
function relationshipMilestones(profile,firstMoment,universeCreatedAt){
  const rows=[
    {date:profile?.connected_on,label:profile?.connection_title||'Mulai terhubung',detail:'Titik awal penghitung utama kalian.',icon:'∞'},
    {date:profile?.first_chat_on,label:'Pertama berkomunikasi',detail:'Ketika dua suara mulai saling menemukan.',icon:'✉'},
    {date:profile?.first_met_on,label:'Pertama bertemu',detail:'Saat dua orbit hadir di tempat yang sama.',icon:'✦'},
    {date:profile?.first_date_on,label:'Kencan pertama',detail:'Satu hari yang mulai terasa berbeda.',icon:'♡'},
    {date:profile?.started_on,label:profile?.anniversary_title||'Mulai bersama',detail:'Hari ketika perjalanan ini diberi nama.',icon:'☾'}
  ].filter(item=>item.date);
  if(firstMoment?.at)rows.push({date:toDateOnly(firstMoment.at),label:'Jejak pertama di aplikasi',detail:firstMomentLabel(firstMoment.type),icon:'☄'});
  if(universeCreatedAt)rows.push({date:toDateOnly(universeCreatedAt),label:'Semesta privat dibuat',detail:'OUR UNIVERSE mulai menyimpan cerita kalian.',icon:'◉'});
  return rows.filter(item=>item.date).sort((a,b)=>parseDateOnly(a.date)-parseDateOnly(b.date));
}
function nextAnniversary(value){
  const base=parseDateOnly(value);if(!base)return null;
  const today=new Date();today.setHours(0,0,0,0);
  let next=safeAnnualDate(today.getFullYear(),base.getMonth(),base.getDate());
  if(next<today)next=safeAnnualDate(today.getFullYear()+1,base.getMonth(),base.getDate());
  const days=Math.round((next-today)/86400000);
  const years=next.getFullYear()-base.getFullYear();
  return{title:days===0?'Hari ini 🎉':days===1?'Besok':`${days} hari lagi`,detail:`Menuju tahun ke-${years} pada ${new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(next)}`};
}
function safeAnnualDate(year,month,day){const date=new Date(year,month,day);if(date.getMonth()!==month)return new Date(year,month+1,0);return date;}
function entryDetail(types){const top=[...types.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2);return top.length?top.map(([type,count])=>`${labelType(type)} ${count}`).join(' · '):'Belum ada cerita';}
function labelType(type){return({memory:'kenangan',gallery:'galeri',letter:'surat',note:'catatan',wish:'harapan',music:'musik',timeline:'momen',capsule:'kapsul',file:'berkas'})[type]||type;}
function pulseDetail(rows){if(!rows.length)return'Belum ada sinyal hati';const counts=rows.reduce((map,item)=>(map[item.pulse_type]=(map[item.pulse_type]||0)+1,map),{});const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];return`${pulseLabel(top[0])} paling sering · ${top[1]} kali`;}
function pulseLabel(type){return({heartbeat:'Heartbeat',hug:'Pelukan',kiss:'Kecupan',support:'Dukungan'})[type]||'Sinyal';}
function contributionData(data,{userId,partner}){const partnerId=partner?.user_id;let mine=0;let partnerCount=0;for(const item of data.moments){if(item.owner===userId)mine+=1;else if(item.owner===partnerId)partnerCount+=1;}return{mine,partner:partnerCount,total:Math.max(1,mine+partnerCount)};}
function createContributionRow(label,value,total,className){const row=document.createElement('div');row.className=`relationship-contribution-row ${className}`;const head=document.createElement('div');const span=document.createElement('span');span.textContent=label;const b=document.createElement('b');b.textContent=formatNumber(value);head.append(span,b);const track=document.createElement('div');const fill=document.createElement('i');fill.style.setProperty('--contribution-width',`${Math.round(value/total*100)}%`);track.append(fill);row.append(head,track);return row;}
function createMonthlyBars(moments){const host=document.createElement('div');host.className='relationship-month-bars';const months=[];const now=new Date();for(let offset=5;offset>=0;offset--){const date=new Date(now.getFullYear(),now.getMonth()-offset,1);months.push({year:date.getFullYear(),month:date.getMonth(),label:new Intl.DateTimeFormat('id-ID',{month:'short'}).format(date),count:0});}for(const item of moments){const date=new Date(item.at);const target=months.find(month=>month.year===date.getFullYear()&&month.month===date.getMonth());if(target)target.count+=1;}const max=Math.max(1,...months.map(month=>month.count));for(const month of months){const column=document.createElement('div');const value=document.createElement('b');value.textContent=String(month.count);const bar=document.createElement('i');bar.style.setProperty('--month-height',`${Math.max(7,Math.round(month.count/max*100))}%`);const label=document.createElement('small');label.textContent=month.label;column.append(value,bar,label);host.append(column);}return host;}
function firstMomentLabel(type){return({entry:'Cerita pertama yang tersimpan',calendar:'Agenda kalender paling awal',timeline:'Momen timeline paling awal',pulse:'Heartbeat paling awal',message:'Pesan pasangan paling awal',comment:'Komentar kenangan paling awal',planet:'Planet pertama yang dibuat'})[type]||'Jejak pertama di semesta';}
function daysSince(value){const start=parseDateOnly(value);const today=new Date();today.setHours(12,0,0,0);return Math.max(1,Math.floor((today-start)/86400000)+1);}
function durationParts(value,end){const start=parseDateOnly(value);const finish=new Date(end);finish.setHours(12,0,0,0);let years=finish.getFullYear()-start.getFullYear();let cursor=new Date(start);cursor.setFullYear(cursor.getFullYear()+years);if(cursor>finish){years-=1;cursor=new Date(start);cursor.setFullYear(cursor.getFullYear()+years);}let months=0;while(months<11){const next=new Date(cursor);next.setMonth(next.getMonth()+1);if(next>finish)break;cursor=next;months+=1;}const days=Math.max(0,Math.floor((finish-cursor)/86400000));return{years,months,days};}
function formatDuration(parts){const values=[];if(parts.years)values.push(`${parts.years} tahun`);if(parts.months)values.push(`${parts.months} bulan`);if(parts.days||!values.length)values.push(`${parts.days} hari`);return values.join(' ');}
function parseDateOnly(value){const date=new Date(`${String(value).slice(0,10)}T12:00:00`);return date;}
function toDateOnly(value){const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function formatDate(value){return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value));}
function formatDateOnly(value){return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(parseDateOnly(value));}
function formatNumber(value){return new Intl.NumberFormat('id-ID').format(value||0);}
function friendlyError(error){const message=String(error?.message||error||'');if(/connected_on|first_chat_on|first_date_on|relationship_story|connection_title|couple_relationship_profiles|love_timeline|schema cache|relation|column/i.test(message))return'Relationship Journey membutuhkan migration v4.9.0 di Supabase.';return message||'Perjalanan belum dapat disimpan.';}
