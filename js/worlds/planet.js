import { state } from '../core/state.js';
import { repository } from '../core/repository.js';
import { signedUrl } from '../core/storage.js';
import { router } from '../core/router.js';
import { createEntryCard } from '../components/entry-card.js';
import { openStoryComposer } from '../components/story-composer.js';
import { openComposer } from '../components/composer.js';
import { openPlanetComposer } from '../components/planet-composer.js';
import { openEntryDetail,deleteEntry,emptyState,profileMap } from './shared.js';
import { toast } from '../components/toast.js';
import { listPlanetEntryPage } from '../core/content-feed.js';
import { preferredPageSize } from '../core/data-mode.js';

export async function renderPlanet(container){
  const id=state.get('routeParams')?.id;
  if(!id){router.navigate('home',{},true);return;}
  container.innerHTML='<div class="planet-world-loading"><span></span><p>Menembus atmosfer…</p></div>';
  let planet;
  try{planet=await repository.getPlanet(id);}catch(error){container.innerHTML='';container.append(emptyState('Planet tidak ditemukan',error.message,()=>router.navigate('home')));return;}
  await enterAtmosphere(container,planet);
  const root=document.createElement('section');root.className='planet-world';root.style.setProperty('--planet-accent',planet.accent_color||'#7C8CFF');root.dataset.style=planet.planet_style||'ocean';
  root.innerHTML=`<header class="planet-world__hero"><button class="button button--ghost" data-back type="button">← Semesta</button><div class="planet-world__orb"><span></span></div><div class="planet-world__copy"><p class="eyebrow">PLANET BUATAN KALIAN</p><h1></h1><p></p><div class="planet-world__stats"><span data-count></span><span data-types></span></div></div><div class="planet-world__hero-actions"><button class="button button--primary" data-add type="button">＋ Tambahkan story</button><button class="icon-button" data-edit type="button" aria-label="Atur planet">✎</button></div></header><section class="planet-story-ring" data-stories hidden></section><div class="planet-world__toolbar"><input class="input" data-search type="search" placeholder="Cari di planet ini…"><select class="select" data-filter><option value="">Semua isi</option><option value="gallery">Foto & video</option><option value="music">Musik</option><option value="note">Catatan</option><option value="letter">Surat</option><option value="file">Dokumen</option><option value="memory">Kenangan</option></select></div><section class="planet-memory-stream" data-grid></section><footer class="planet-feed-footer" data-feed-footer hidden><small class="planet-feed-footer__status" data-feed-status></small><button class="button button--ghost" data-load-more type="button">Muat kenangan berikutnya</button></footer>`;
  root.querySelector('h1').textContent=planet.name;
  root.querySelector('.planet-world__copy>p:nth-of-type(2)').textContent=planet.description||'Dunia yang kalian bangun dan isi bersama.';
  root.querySelector('[data-types]').textContent=planet.mode==='free'?'Semua jenis isi':`${(planet.accepted_content_types||[]).length} jenis isi`;
  if(planet.cover_path)signedUrl(planet.cover_path).then(url=>{root.style.setProperty('--planet-cover',`url("${url}")`);root.classList.add('has-cover');}).catch(()=>{});
  root.querySelector('[data-back]').onclick=()=>router.navigate('home');
  root.querySelector('[data-add]').onclick=()=>openStoryComposer({planetId:planet.id,onSaved:refreshPlanetContent});
  root.querySelector('[data-edit]').onclick=()=>openPlanetComposer({planet,onSaved:async saved=>{planet=saved;await renderPlanet(container);},onDeleted:()=>router.navigate('home')});
  const grid=root.querySelector('[data-grid]');
  const search=root.querySelector('[data-search]');
  const filter=root.querySelector('[data-filter]');
  const footer=root.querySelector('[data-feed-footer]');
  const loadMore=root.querySelector('[data-load-more]');
  const feedStatus=root.querySelector('[data-feed-status]');
  const pageSize=preferredPageSize();
  let timer,page=0,total=0,loading=false,requestToken=0;
  search.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>load(true),300);};
  filter.onchange=()=>load(true);
  loadMore.onclick=()=>load(false);
  container.replaceChildren(root);
  await refreshPlanetContent();

  async function refreshPlanetContent(){await Promise.all([load(true),renderStories(root,planet.id)]);}

  async function load(reset=false){
    if(loading&&!reset)return;
    const token=++requestToken;
    loading=true;
    if(reset){page=0;total=0;grid.innerHTML='<div class="skeleton planet-stream-skeleton"></div>';footer.hidden=true;}
    loadMore.disabled=true;
    loadMore.textContent='Membaca orbit…';
    try{
      const result=await listPlanetEntryPage(planet.id,{query:search.value.trim(),type:filter.value,page,pageSize});
      if(token!==requestToken)return;
      total=result.count;
      if(reset)grid.innerHTML='';
      if(!result.entries.length&&page===0){
        grid.append(emptyState('Planet ini masih sunyi','Tambahkan story, foto, lagu, atau catatan pertama ke dunia ini.',()=>openStoryComposer({planetId:planet.id,onSaved:refreshPlanetContent})));
        root.querySelector('[data-count]').textContent='0 isi';
        footer.hidden=true;
        return;
      }
      const map=profileMap();
      const baseIndex=page*pageSize;
      for(const [index,entry] of result.entries.entries()){
        const card=createEntryCard(entry,{profileMap:map,onOpen:(item,origin)=>openEntryDetail(item,{onChanged:refreshPlanetContent,origin}),onEdit:item=>openComposer({type:item.type,entry:item,onSaved:refreshPlanetContent}),onDelete:item=>deleteEntry(item,refreshPlanetContent)});
        card.classList.add('planet-memory-card');card.style.setProperty('--stream-index',String(baseIndex+index));grid.append(card);
      }
      const shown=Math.min(total,(page*pageSize)+result.entries.length);
      root.querySelector('[data-count]').textContent=`${total} isi`;
      feedStatus.textContent=`Menampilkan ${shown} dari ${total} isi`;
      footer.hidden=!result.hasMore;
      if(result.hasMore)page+=1;
    }catch(error){
      if(reset)grid.innerHTML='';
      if(!grid.children.length)grid.append(emptyState('Isi planet gagal dimuat',error.message));
      else toast(error.message,{type:'error'});
      footer.hidden=true;
    }finally{
      if(token===requestToken){loading=false;loadMore.disabled=false;loadMore.textContent='Muat kenangan berikutnya';}
    }
  }
}

async function renderStories(root,planetId){
  const host=root.querySelector('[data-stories]');
  try{
    const stories=(await repository.listActiveStories()).filter(item=>item.planet_id===planetId);
    if(!stories.length){host.hidden=true;return;}
    host.hidden=false;host.innerHTML='<div class="planet-story-ring__label"><span></span><div><strong>Story aktif</strong><small>Kenangan yang baru ditambahkan</small></div></div><div class="planet-story-ring__list"></div>';
    const list=host.querySelector('.planet-story-ring__list');const members=profileMap();
    for(const story of stories){
      const button=document.createElement('button');button.type='button';button.className='story-bubble';button.innerHTML='<span class="story-bubble__ring"><span>✦</span></span><strong></strong><small></small>';
      button.querySelector('strong').textContent=story.entries?.title||'Story';
      button.querySelector('small').textContent=`Oleh ${members.get(story.entries?.created_by)?.display_name||'Kalian'}`;
      button.onclick=async()=>{try{const entry=await repository.getEntry(story.entry_id);await openEntryDetail(entry);}catch(error){toast(error.message,{type:'error'});}};
      list.append(button);
    }
  }catch(error){host.hidden=true;console.warn(error);}
}

async function enterAtmosphere(container,planet){return new Promise(resolve=>{const splash=document.createElement('div');splash.className='atmosphere-transition';splash.style.setProperty('--planet-accent',planet.accent_color||'#7C8CFF');splash.innerHTML='<div class="atmosphere-transition__planet"></div><div class="atmosphere-transition__streaks"></div>';container.append(splash);requestAnimationFrame(()=>splash.classList.add('is-entering'));setTimeout(()=>{splash.remove();resolve();},780);});}
