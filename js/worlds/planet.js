import { state } from '../core/state.js';
import { repository } from '../core/repository.js';
import { signedUrl,removeFiles } from '../core/storage.js';
import { router } from '../core/router.js';
import { createEntryCard } from '../components/entry-card.js';
import { openStoryComposer } from '../components/story-composer.js';
import { openComposer } from '../components/composer.js';
import { openPlanetComposer } from '../components/planet-composer.js';
import { openEntryDetail,deleteEntry,emptyState } from './shared.js';
import { profileMap } from './shared.js';
import { toast } from '../components/toast.js';

export async function renderPlanet(container){
  const id=state.get('routeParams')?.id;if(!id){router.navigate('home',{},true);return;}
  container.innerHTML='<div class="planet-world-loading"><span></span><p>Menembus atmosfer…</p></div>';
  let planet;try{planet=await repository.getPlanet(id);}catch(error){container.innerHTML='';container.append(emptyState('Planet tidak ditemukan',error.message,()=>router.navigate('home')));return;}
  await enterAtmosphere(container,planet);
  const root=document.createElement('section');root.className='planet-world';root.style.setProperty('--planet-accent',planet.accent_color||'#7C8CFF');root.dataset.style=planet.planet_style||'ocean';
  root.innerHTML=`<header class="planet-world__hero"><button class="button button--ghost" data-back type="button">← Semesta</button><div class="planet-world__orb"><span></span></div><div class="planet-world__copy"><p class="eyebrow">PLANET BUATAN KALIAN</p><h1></h1><p></p><div class="planet-world__stats"><span data-count></span><span data-types></span></div></div><div class="planet-world__hero-actions"><button class="button button--primary" data-add type="button">＋ Tambahkan story</button><button class="icon-button" data-edit type="button" aria-label="Atur planet">✎</button></div></header><section class="planet-story-ring" data-stories hidden></section><div class="planet-world__toolbar"><input class="input" data-search type="search" placeholder="Cari di planet ini…"><select class="select" data-filter><option value="">Semua isi</option><option value="gallery">Foto & video</option><option value="music">Musik</option><option value="note">Catatan</option><option value="letter">Surat</option><option value="file">Dokumen</option><option value="memory">Kenangan</option></select></div><section class="planet-memory-stream" data-grid></section>`;
  root.querySelector('h1').textContent=planet.name;root.querySelector('.planet-world__copy>p:nth-of-type(2)').textContent=planet.description||'Dunia yang kalian bangun dan isi bersama.';root.querySelector('[data-types]').textContent=planet.mode==='free'?'Semua jenis isi':`${(planet.accepted_content_types||[]).length} jenis isi`;
  if(planet.cover_path)signedUrl(planet.cover_path).then(url=>{root.style.setProperty('--planet-cover',`url("${url}")`);root.classList.add('has-cover');}).catch(()=>{});
  root.querySelector('[data-back]').onclick=()=>router.navigate('home');
  root.querySelector('[data-add]').onclick=()=>openStoryComposer({planetId:planet.id,onSaved:refreshPlanetContent});
  root.querySelector('[data-edit]').onclick=()=>openPlanetComposer({planet,onSaved:async saved=>{planet=saved;await renderPlanet(container);},onDeleted:()=>router.navigate('home')});
  const grid=root.querySelector('[data-grid]');const search=root.querySelector('[data-search]');const filter=root.querySelector('[data-filter]');let timer;
  search.oninput=()=>{clearTimeout(timer);timer=setTimeout(load,250);};filter.onchange=load;
  container.replaceChildren(root);await refreshPlanetContent();

  async function refreshPlanetContent(){await Promise.all([load(),renderStories(root,planet.id)]);}
  async function load(){grid.innerHTML='<div class="skeleton planet-stream-skeleton"></div>';try{let entries=await repository.listPlanetEntries(planet.id,{query:search.value.trim()});if(filter.value)entries=entries.filter(item=>item.type===filter.value);root.querySelector('[data-count]').textContent=`${entries.length} isi`;grid.innerHTML='';if(!entries.length){grid.append(emptyState('Planet ini masih sunyi','Tambahkan story, foto, lagu, atau catatan pertama ke dunia ini.',()=>openStoryComposer({planetId:planet.id,onSaved:refreshPlanetContent})));return;}const map=profileMap();entries.forEach((entry,index)=>{const card=createEntryCard(entry,{profileMap:map,onOpen:(item,origin)=>openEntryDetail(item,{onChanged:refreshPlanetContent,origin}),onEdit:item=>openComposer({type:item.type,entry:item,onSaved:refreshPlanetContent}),onDelete:item=>deleteEntry(item,refreshPlanetContent)});card.classList.add('planet-memory-card');card.style.setProperty('--stream-index',String(index));grid.append(card);});}catch(error){grid.innerHTML='';grid.append(emptyState('Isi planet gagal dimuat',error.message));}}
}

async function renderStories(root,planetId){const host=root.querySelector('[data-stories]');try{const stories=(await repository.listActiveStories()).filter(item=>item.planet_id===planetId);if(!stories.length){host.hidden=true;return;}host.hidden=false;host.innerHTML='<div class="planet-story-ring__label"><span></span><div><strong>Story aktif</strong><small>Kenangan yang baru ditambahkan</small></div></div><div class="planet-story-ring__list"></div>';const list=host.querySelector('.planet-story-ring__list');const members=profileMap();for(const story of stories){const button=document.createElement('button');button.type='button';button.className='story-bubble';button.innerHTML='<span class="story-bubble__ring"><span>✦</span></span><strong></strong><small></small>';button.querySelector('strong').textContent=story.entries?.title||'Story';button.querySelector('small').textContent=`Oleh ${members.get(story.entries?.created_by)?.display_name||'Kalian'}`;button.onclick=async()=>{try{const entry=await repository.getEntry(story.entry_id);await openEntryDetail(entry);}catch(error){toast(error.message,{type:'error'});}};list.append(button);}}catch(error){host.hidden=true;console.warn(error);}}

async function enterAtmosphere(container,planet){return new Promise(resolve=>{const splash=document.createElement('div');splash.className='atmosphere-transition';splash.style.setProperty('--planet-accent',planet.accent_color||'#7C8CFF');splash.innerHTML='<div class="atmosphere-transition__planet"></div><div class="atmosphere-transition__streaks"></div>';container.append(splash);requestAnimationFrame(()=>splash.classList.add('is-entering'));setTimeout(()=>{splash.remove();resolve();},780);});}
