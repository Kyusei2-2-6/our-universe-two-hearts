import { state } from '../core/state.js';
import { repository } from '../core/repository.js';
import { signedUrl } from '../core/storage.js';
import { router } from '../core/router.js';
import { createPlanetProfileTile } from '../components/planet-profile-tile.js';
import { openStoryComposer } from '../components/story-composer.js';
import { openPlanetComposer } from '../components/planet-composer.js';
import { openEntryDetail,emptyState,profileMap } from './shared.js';
import { toast } from '../components/toast.js';
import { listPlanetEntryPage } from '../core/content-feed.js';
import { preferredPageSize,getDataMode } from '../core/data-mode.js';

const FILTERS=[
  ['', 'Semua'],['gallery','Foto & video'],['memory','Kenangan'],['note','Catatan'],['letter','Surat'],['music','Musik'],['file','Berkas'],['capsule','Kapsul']
];

export async function renderPlanet(container){
  const id=state.get('routeParams')?.id;
  if(!id){router.navigate('home',{},true);return;}
  container.innerHTML='<div class="planet-world-loading"><span></span><p>Menembus atmosfer…</p></div>';
  let planet;
  try{planet=await repository.getPlanet(id);}catch(error){container.innerHTML='';container.append(emptyState('Planet tidak ditemukan',error.message,()=>router.navigate('home')));return;}
  await enterAtmosphere(container,planet);

  const root=document.createElement('section');
  root.className='planet-profile';
  root.style.setProperty('--planet-accent',planet.accent_color||'#7C8CFF');
  root.dataset.style=planet.planet_style||'ocean';
  root.innerHTML=`
    <header class="planet-profile__header">
      <div class="planet-profile__cover"></div>
      <button class="planet-profile__back" data-back type="button" aria-label="Kembali ke semesta">←</button>
      <button class="planet-profile__menu" data-edit type="button" aria-label="Atur profil planet">•••</button>
      <div class="planet-profile__identity">
        <div class="planet-profile__avatar" aria-hidden="true"><div class="planet-profile__avatar-inner">✦</div></div>
        <div class="planet-profile__title"><h1></h1><p class="planet-profile__handle"></p></div>
        <div class="planet-profile__primary-actions">
          <button class="button button--primary" data-add type="button">＋ Tambah postingan</button>
          <button class="button button--ghost" data-edit-secondary type="button">Edit profil</button>
        </div>
      </div>
      <div class="planet-profile__bio">
        <p data-bio></p>
        <div class="planet-profile__stats">
          <span class="planet-profile__stat"><strong data-count>0</strong><small>postingan</small></span>
          <span class="planet-profile__stat"><strong>2</strong><small>hati terhubung</small></span>
          <span class="planet-profile__stat"><strong data-story-count>0</strong><small>story aktif</small></span>
        </div>
      </div>
    </header>
    <section class="planet-profile__stories" data-stories hidden></section>
    <section class="planet-profile__controls">
      <div class="planet-profile__filters" data-filters></div>
      <button class="planet-profile__search-toggle" data-search-toggle type="button" aria-label="Cari postingan">⌕</button>
      <div class="planet-profile__search" data-search-box hidden>
        <input class="input" data-search type="search" placeholder="Cari di planet ini…" autocomplete="off">
      </div>
    </section>
    <section class="planet-profile__grid" data-grid aria-label="Postingan planet"></section>
    <footer class="planet-profile__footer" data-feed-footer hidden>
      <small data-feed-status></small>
      <button class="button button--ghost" data-load-more type="button">Muat postingan berikutnya</button>
    </footer>`;

  root.querySelector('h1').textContent=planet.name;
  root.querySelector('.planet-profile__handle').textContent=`@${slugify(planet.name)} · planet privat kalian`;
  root.querySelector('[data-bio]').textContent=planet.description||'Sebuah ruang privat untuk menyimpan foto, video, surat, musik, dan cerita kalian berdua.';
  if(planet.cover_path){
    signedUrl(planet.cover_path).then(url=>{
      root.style.setProperty('--planet-cover',`url("${String(url).replace(/"/g,'\\"')}")`);
      root.classList.add('has-cover');
    }).catch(()=>{});
  }

  const filters=root.querySelector('[data-filters]');
  for(const [value,label] of FILTERS){
    const button=document.createElement('button');button.type='button';button.className='planet-profile__filter';button.dataset.value=value;button.textContent=label;
    button.onclick=()=>{activeType=value;syncFilters();load(true);};filters.append(button);
  }

  root.querySelector('[data-back]').onclick=()=>router.navigate('home');
  const editPlanet=()=>openPlanetComposer({planet,onSaved:async saved=>{planet=saved;await renderPlanet(container);},onDeleted:()=>router.navigate('home')});
  root.querySelector('[data-edit]').onclick=editPlanet;
  root.querySelector('[data-edit-secondary]').onclick=editPlanet;
  root.querySelector('[data-add]').onclick=()=>openStoryComposer({planetId:planet.id,onSaved:refreshPlanetContent});

  const grid=root.querySelector('[data-grid]');
  const search=root.querySelector('[data-search]');
  const searchBox=root.querySelector('[data-search-box]');
  const searchToggle=root.querySelector('[data-search-toggle]');
  const footer=root.querySelector('[data-feed-footer]');
  const loadMore=root.querySelector('[data-load-more]');
  const feedStatus=root.querySelector('[data-feed-status]');
  const pageSize=Math.max(12,preferredPageSize());
  const searchDelay=getDataMode()==='economy'?520:300;
  let timer,page=0,total=0,loading=false,requestToken=0,activeType='';

  searchToggle.onclick=()=>{
    searchBox.hidden=!searchBox.hidden;
    searchToggle.setAttribute('aria-expanded',String(!searchBox.hidden));
    if(!searchBox.hidden)setTimeout(()=>search.focus(),40);
  };
  search.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>load(true),searchDelay);};
  loadMore.onclick=()=>load(false);
  container.replaceChildren(root);
  syncFilters();
  await refreshPlanetContent();

  async function refreshPlanetContent(){await Promise.all([load(true),renderStories(root,planet.id)]);}

  function syncFilters(){
    root.querySelectorAll('.planet-profile__filter').forEach(button=>button.classList.toggle('is-active',button.dataset.value===activeType));
  }

  async function load(reset=false){
    if(loading&&!reset)return;
    const token=++requestToken;
    loading=true;
    if(reset){page=0;total=0;grid.innerHTML='<div class="skeleton planet-profile__empty"></div>';footer.hidden=true;}
    loadMore.disabled=true;loadMore.textContent='Membaca orbit…';
    try{
      const result=await listPlanetEntryPage(planet.id,{query:search.value.trim(),type:activeType,page,pageSize,knownCount:page===0?null:total});
      if(token!==requestToken)return;
      total=result.count;
      if(reset)grid.innerHTML='';
      if(!result.entries.length&&page===0){
        const empty=document.createElement('div');empty.className='planet-profile__empty';
        empty.append(emptyState(search.value||activeType?'Tidak ada postingan yang cocok':'Planet ini masih sunyi',search.value||activeType?'Coba kata kunci atau kategori lain.':'Tambahkan foto, video, surat, musik, atau cerita pertama kalian.',search.value||activeType?null:()=>openStoryComposer({planetId:planet.id,onSaved:refreshPlanetContent})));
        grid.append(empty);root.querySelector('[data-count]').textContent='0';footer.hidden=true;return;
      }
      const members=profileMap();
      for(const entry of result.entries){
        const tile=createPlanetProfileTile(entry,{profileMap:members,onOpen:(item,origin)=>openEntryDetail(item,{onChanged:refreshPlanetContent,origin})});
        grid.append(tile);
      }
      const shown=Math.min(total,(page*pageSize)+result.entries.length);
      root.querySelector('[data-count]').textContent=String(total);
      feedStatus.textContent=`${shown} dari ${total} postingan`;
      footer.hidden=!result.hasMore;
      if(result.hasMore)page+=1;
    }catch(error){
      if(reset)grid.innerHTML='';
      if(!grid.children.length){const empty=document.createElement('div');empty.className='planet-profile__empty';empty.append(emptyState('Postingan gagal dimuat',error.message));grid.append(empty);}else toast(error.message,{type:'error'});
      footer.hidden=true;
    }finally{
      if(token===requestToken){loading=false;loadMore.disabled=false;loadMore.textContent='Muat postingan berikutnya';}
    }
  }
}

async function renderStories(root,planetId){
  const host=root.querySelector('[data-stories]');
  try{
    const stories=(await repository.listActiveStories()).filter(item=>item.planet_id===planetId);
    root.querySelector('[data-story-count]').textContent=String(stories.length);
    if(!stories.length){host.hidden=true;host.innerHTML='';return;}
    host.hidden=false;host.innerHTML='<div class="planet-profile__story-row"></div>';
    const row=host.querySelector('.planet-profile__story-row');
    for(const story of stories){
      const button=document.createElement('button');button.type='button';button.className='planet-profile__story';
      button.innerHTML='<span class="planet-profile__story-ring"><span class="planet-profile__story-core">✦</span></span><strong></strong>';
      button.querySelector('strong').textContent=story.entries?.title||'Story';
      button.onclick=async()=>{try{const entry=await repository.getEntry(story.entry_id);await openEntryDetail(entry);}catch(error){toast(error.message,{type:'error'});}};
      row.append(button);
    }
  }catch(error){host.hidden=true;root.querySelector('[data-story-count]').textContent='0';console.warn(error);}
}

function slugify(value='planet'){return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'').slice(0,32)||'planet.kita';}
async function enterAtmosphere(container,planet){return new Promise(resolve=>{const splash=document.createElement('div');splash.className='atmosphere-transition';splash.style.setProperty('--planet-accent',planet.accent_color||'#7C8CFF');splash.innerHTML='<div class="atmosphere-transition__planet"></div><div class="atmosphere-transition__streaks"></div>';container.append(splash);requestAnimationFrame(()=>splash.classList.add('is-entering'));setTimeout(()=>{splash.remove();resolve();},620);});}
