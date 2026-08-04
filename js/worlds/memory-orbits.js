import { repository } from '../core/repository.js';
import { signedUrl } from '../core/storage.js';
import { formatDate } from '../core/utils.js';
import { createEntryCard } from '../components/entry-card.js';
import { openTypePicker, openComposer } from '../components/composer.js';
import { openPeriodComposer } from '../components/period-composer.js';
import { openModal } from '../components/modal.js';
import { confirmAction } from '../components/confirm.js';
import { toast } from '../components/toast.js';
import { worldHeader, emptyState, profileMap, openEntryDetail } from './shared.js';

const EMPTY_PERIOD={id:null,title:'Kenangan Tanpa Orbit',description:'Bagian-bagian yang belum dipindahkan ke suatu periode. Kalian dapat mengedit setiap isi dan memilih Orbit Kenangan kapan saja.',planet_style:'moon',accent_color:'#8792aa',start_date:null,end_date:null};

export async function renderMemoryOrbits(container){
  container.innerHTML='';
  container.append(worldHeader({
    eyebrow:'ORBIT KENANGAN',
    title:'Setiap periode menjadi sebuah dunia.',
    subtitle:'Bukan sekadar galeri. Buka satu orbit untuk mengikuti foto, video, musik, catatan, surat, dan momen sebagai perjalanan yang utuh.',
    actions:[{label:'＋ Buat Orbit Baru',primary:true,onClick:()=>openPeriodComposer({onSaved:load})}]
  }));
  const stage=document.createElement('section');stage.className='memory-orbit-stage';
  const grid=document.createElement('div');grid.className='period-grid';stage.append(grid);container.append(stage);

  async function load(){
    grid.innerHTML='<div class="skeleton" style="grid-column:1/-1;min-height:430px;border-radius:30px"></div>';
    try{
      const [periods,entries]=await Promise.all([repository.listPeriods(),repository.listEntries({limit:10000,ascending:true})]);
      const grouped=new Map(periods.map(period=>[period.id,[]]));const unassigned=[];
      for(const entry of entries){if(entry.period_id&&grouped.has(entry.period_id))grouped.get(entry.period_id).push(entry);else unassigned.push(entry);}
      grid.innerHTML='';
      if(!periods.length&&!unassigned.length){
        grid.append(emptyState('Belum ada Orbit Kenangan','Buat periode pertama. Setelah itu, setiap foto, video, musik, atau cerita dapat dimasukkan ke dalam dunia tersebut.',()=>openPeriodComposer({onSaved:load})));return;
      }
      for(const period of periods)grid.append(createPeriodCard(period,grouped.get(period.id)||[],load));
      if(unassigned.length)grid.append(createPeriodCard(EMPTY_PERIOD,unassigned,load,true));
      const create=document.createElement('button');create.type='button';create.className='period-card';create.style.setProperty('--period-accent','#8fb8ff');create.innerHTML='<div class="period-card__space"><div class="period-planet"></div></div><div class="period-card__copy"><p class="eyebrow">DUNIA BARU</p><h3>＋ Ciptakan periode berikutnya</h3><p>Kelompokkan bab kehidupan kalian berdasarkan bulan, tahun, perjalanan, atau cerita tertentu.</p></div>';create.onclick=()=>openPeriodComposer({onSaved:load});grid.append(create);
    }catch(error){
      grid.innerHTML='';grid.append(emptyState('Orbit Kenangan belum aktif',migrationMessage(error)));
    }
  }
  await load();
}

function createPeriodCard(period,entries,reload,isEmpty=false){
  const card=document.createElement('article');card.className=`period-card${isEmpty?' period-empty-card':''}`;card.dataset.style=period.planet_style||'moon';card.style.setProperty('--period-accent',safeColor(period.accent_color));
  card.innerHTML='<div class="period-card__space"><div class="period-planet"></div></div><div class="period-card__actions"></div><div class="period-card__copy"><p class="eyebrow"></p><h3></h3><p data-description></p><div class="period-card__meta"></div></div>';
  card.querySelector('.eyebrow').textContent=periodRange(period);
  card.querySelector('h3').textContent=period.title;
  card.querySelector('[data-description]').textContent=period.description||'Sebuah periode yang menunggu cerita kalian.';
  const attachmentCount=entries.reduce((sum,item)=>sum+(item.attachments?.length||0),0);
  const meta=card.querySelector('.period-card__meta');for(const text of [`${entries.length} isi`,`${attachmentCount} lampiran`]){const chip=document.createElement('span');chip.textContent=text;meta.append(chip);}
  const image=entries.flatMap(entry=>entry.attachments||[]).find(item=>item.kind==='image');if(image)applyCover(card,image);
  if(!isEmpty){
    const actions=card.querySelector('.period-card__actions');const edit=iconButton('✎','Edit orbit');edit.onclick=event=>{event.stopPropagation();openPeriodComposer({period,onSaved:reload});};
    const remove=iconButton('×','Hapus orbit');remove.onclick=async event=>{event.stopPropagation();const ok=await confirmAction({title:'Hapus Orbit Kenangan?',message:'Isi di dalamnya tidak ikut terhapus. Semua akan dipindahkan ke Kenangan Tanpa Orbit.',confirmLabel:'Hapus orbit',danger:true});if(!ok)return;try{await repository.deletePeriod(period.id);toast('Orbit dihapus. Semua isinya tetap aman.');await reload();}catch(error){toast(error.message,{type:'error'});}};actions.append(edit,remove);
  }
  card.onclick=()=>openPeriodExperience(period,entries,reload,isEmpty);return card;
}

async function applyCover(card,attachment){
  try{const url=await signedUrl(attachment.file_path);const space=card.querySelector('.period-card__space');space.style.backgroundImage=`linear-gradient(180deg,rgba(3,5,15,.08),rgba(3,5,15,.48)),url("${url}")`;space.style.backgroundSize='cover';space.style.backgroundPosition='center';space.querySelector('.period-planet').style.opacity='.72';}catch{}
}

function openPeriodExperience(period,entries,reload,isEmpty){
  const content=document.createElement('div');content.className='orbit-experience';content.style.setProperty('--period-accent',safeColor(period.accent_color));
  const hero=document.createElement('section');hero.className='orbit-experience__hero';hero.innerHTML='<div class="period-planet"></div><div class="orbit-experience__copy"><p class="eyebrow"></p><h2></h2><p></p><div class="toolbar"></div></div>';
  hero.querySelector('.eyebrow').textContent=periodRange(period);hero.querySelector('h2').textContent=period.title;hero.querySelector('.orbit-experience__copy > p:last-of-type').textContent=period.description||'Setiap bagian di dunia ini akan tersusun sebagai perjalanan kalian.';
  const toolbar=hero.querySelector('.toolbar');const add=document.createElement('button');add.className='button button--primary';add.type='button';add.textContent='＋ Tambah ke orbit ini';add.onclick=()=>openTypePicker({onChoose:type=>openComposer({type,initialPeriodId:period.id,onSaved:async()=>{modal.close();await reload();}})});toolbar.append(add);
  if(!isEmpty){const edit=document.createElement('button');edit.className='button button--ghost';edit.type='button';edit.textContent='Edit orbit';edit.onclick=()=>openPeriodComposer({period,onSaved:async()=>{modal.close();await reload();}});toolbar.append(edit);}
  content.append(hero);
  const story=document.createElement('div');story.className='orbit-story';content.append(story);
  const sorted=[...entries].sort((a,b)=>new Date(a.event_date||a.created_at)-new Date(b.event_date||b.created_at));
  if(!sorted.length)story.append(emptyState('Dunia ini masih sunyi','Tambahkan kenangan pertama ke Orbit ini.',()=>add.click()));
  else{
    const map=profileMap();let previousLabel='';
    for(const entry of sorted){
      const label=monthLabel(entry.event_date||entry.created_at);if(label!==previousLabel){const sep=document.createElement('div');sep.className='orbit-story-separator';sep.textContent=label;story.append(sep);previousLabel=label;}
      const wrapper=document.createElement('div');wrapper.className='orbit-story-card';wrapper.dataset.type=entry.type;
      const card=createEntryCard(entry,{profileMap:map,onOpen:item=>openEntryDetail(item,{onChanged:async()=>{modal.close();await reload();}}),onEdit:item=>openComposer({type:item.type,entry:item,onSaved:async()=>{modal.close();await reload();}})});wrapper.append(card);story.append(wrapper);
    }
  }
  const modal=openModal({title:'Orbit Kenangan',content,className:'orbit-experience-modal'});
  requestAnimationFrame(()=>observeStory(story));return modal;
}

function observeStory(host){
  const cards=[...host.querySelectorAll('.orbit-story-card')];if(!('IntersectionObserver'in window)){cards.forEach(card=>card.classList.add('is-visible'));return;}
  const observer=new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){item.target.classList.add('is-visible');observer.unobserve(item.target);}}, {rootMargin:'0px 0px -8% 0px',threshold:.12});cards.forEach(card=>observer.observe(card));
}
function periodRange(period){if(!period.start_date&&!period.end_date)return period.id?'PERIODE KALIAN':'BELUM DIKELOMPOKKAN';if(period.start_date&&period.end_date)return`${formatDate(period.start_date)} – ${formatDate(period.end_date)}`;return formatDate(period.start_date||period.end_date);}
function monthLabel(value){return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(value));}
function safeColor(value){return /^#[0-9a-f]{6}$/i.test(String(value||''))?value:'#8fb8ff';}
function iconButton(text,label){const button=document.createElement('button');button.type='button';button.className='icon-button';button.textContent=text;button.setAttribute('aria-label',label);return button;}
function migrationMessage(error){const message=String(error?.message||'');if(/memory_periods|period_id|relation/i.test(message))return'Jalankan file supabase/migrations/2026-08-04-memory-orbits.sql melalui koneksi psql. Migrasi ini hanya menambah fitur dan tidak menghapus akun atau data lama.';return message||'Fitur periode belum dapat dimuat.';}
