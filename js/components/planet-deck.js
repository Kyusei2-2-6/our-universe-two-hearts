import { signedUrl } from '../core/storage.js';

const STYLE_LABELS={ocean:'Samudra',ember:'Ember',aurora:'Aurora',rose:'Rose',ice:'Es',forest:'Hutan',desert:'Gurun',lunar:'Lunar',violet:'Violet'};

export function createPlanetDeck({planets,onOpen,onCreate,onEdit,onIndexChange}={}){
  const root=document.createElement('section');root.className='planet-deck';root.setAttribute('aria-label','Planet buatan kalian');
  const viewport=document.createElement('div');viewport.className='planet-deck__viewport';
  const track=document.createElement('div');track.className='planet-deck__track';viewport.append(track);
  const footer=document.createElement('div');footer.className='planet-deck__footer';
  const dots=document.createElement('div');dots.className='planet-deck__dots';
  const hint=document.createElement('p');hint.className='planet-deck__hint';hint.textContent='Geser untuk berpindah · ketuk Buka Planet untuk masuk';
  footer.append(dots,hint);root.append(viewport,footer);

  if(!planets?.length){
    const empty=document.createElement('button');empty.type='button';empty.className='planet-deck__empty';empty.innerHTML='<span class="planet-deck__birth">＋</span><strong>Ciptakan planet pertama</strong><small>Semesta kalian dimulai dari sesuatu yang kalian beri nama sendiri.</small>';
    empty.onclick=()=>onCreate?.();track.append(empty);return {element:root,destroy(){}};
  }

  let index=Math.max(0,Math.min(planets.length-1,Number(localStorage.getItem('our-universe-planet-index')||0)));
  let down=false,startX=0,startOffset=0,lastX=0,lastTime=0,velocity=0,suppress=0,dragged=false;
  const cards=planets.map((planet,i)=>createCard(planet,i));
  track.append(...cards);
  planets.forEach((_,i)=>{const dot=document.createElement('button');dot.type='button';dot.setAttribute('aria-label',`Pilih planet ${i+1}`);dot.onclick=()=>go(i);dots.append(dot);});

  function createCard(planet,i){
    const article=document.createElement('article');article.className='planet-slide';article.tabIndex=0;article.dataset.index=String(i);article.dataset.style=planet.planet_style||'ocean';article.style.setProperty('--planet-accent',planet.accent_color||'#7C8CFF');
    article.innerHTML=`<div class="planet-slide__halo"></div><button class="planet-slide__sphere" type="button" aria-label="Buka ${escapeHtml(planet.name)}"><span class="planet-slide__surface"></span><span class="planet-slide__clouds"></span><span class="planet-slide__ring" aria-hidden="true"></span></button><div class="planet-slide__copy"><p class="eyebrow"></p><h2></h2><p class="planet-slide__description"></p><div class="planet-slide__meta"><span data-count></span><span data-story hidden></span></div><div class="planet-slide__actions"><button class="button button--primary" data-open type="button">Buka Planet</button><button class="icon-button" data-edit type="button" aria-label="Atur planet">✎</button></div></div>`;
    article.querySelector('.eyebrow').textContent=`PLANET ${String(i+1).padStart(2,'0')} · ${STYLE_LABELS[planet.planet_style]||'Dunia'}`;
    article.querySelector('h2').textContent=planet.name;
    article.querySelector('.planet-slide__description').textContent=planet.description||'Sebuah dunia yang kalian ciptakan bersama.';
    article.querySelector('[data-count]').textContent=`${planet.entry_count||0} isi`;
    const story=article.querySelector('[data-story]');if(planet.active_story_count){story.hidden=false;story.textContent=`${planet.active_story_count} story aktif`;article.classList.add('has-story');}
    const open=event=>{event?.stopPropagation?.();if(performance.now()<suppress)return;if(i!==index){go(i);return;}onOpen?.(planet);};
    article.querySelector('[data-open]').onclick=open;article.querySelector('.planet-slide__sphere').onclick=open;
    article.querySelector('[data-edit]').onclick=event=>{event.stopPropagation();if(i!==index){go(i);return;}onEdit?.(planet);};
    article.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();open(event);}};
    if(planet.cover_path)signedUrl(planet.cover_path).then(url=>{article.style.setProperty('--planet-cover',`url("${String(url).replace(/"/g,'\\"')}")`);article.classList.add('has-cover');}).catch(()=>{});
    return article;
  }

  // v4.2.1 · mobile cards stay inside the viewport while swipe remains smooth
  function layout(drag=0){
    const width=Math.min(viewport.clientWidth,980);
    const mobile=window.matchMedia?.('(max-width:700px)')?.matches??innerWidth<700;
    const gap=mobile?Math.max(320,width*1.08):Math.min(520,width*.59);
    cards.forEach((card,i)=>{
      const distance=i-index;
      const x=distance*gap+drag;
      const progress=distance+drag/gap;
      const abs=Math.abs(progress);
      const scale=mobile?Math.max(.9,1-abs*.08):Math.max(.55,1-abs*.23);
      const z=mobile?-abs*80:-abs*190;
      const rotateY=mobile?Math.max(-9,Math.min(9,-distance*6-drag/gap*6)):Math.max(-32,Math.min(32,-distance*18-drag/gap*18));
      const opacity=mobile?(abs>=.98?0:Math.max(.08,1-abs*.72)):Math.max(.18,1-abs*.29);
      const blur=mobile?0:Math.max(0,(abs-1)*2.4);
      card.style.transform=`translate3d(calc(-50% + ${x}px),-50%,${z}px) rotateY(${rotateY}deg) scale(${scale})`;
      card.style.opacity=String(opacity);
      card.style.filter=`blur(${blur}px)`;
      card.style.visibility=mobile&&abs>1.2?'hidden':'visible';
      card.style.pointerEvents=mobile&&abs>.55?'none':'';
      card.style.zIndex=String(100-Math.round(abs*10));
      card.classList.toggle('is-active',i===index&&Math.abs(drag)<8);
      card.setAttribute('aria-hidden',abs>(mobile ? .75 : 1.8)?'true':'false');
    });
    [...dots.children].forEach((dot,i)=>dot.classList.toggle('is-active',i===index));
  }
  function go(next,animate=true){index=Math.max(0,Math.min(planets.length-1,next));localStorage.setItem('our-universe-planet-index',String(index));viewport.classList.toggle('is-animating',animate);layout(0);onIndexChange?.(planets[index],index);setTimeout(()=>viewport.classList.remove('is-animating'),520);}
  function finish(delta){const width=Math.max(260,viewport.clientWidth*.72);const projected=delta+velocity*150;if(projected>width*.18)go(index-1);else if(projected<-width*.18)go(index+1);else go(index);suppress=performance.now()+240;}
  viewport.addEventListener('pointerdown',event=>{if(event.button!==undefined&&event.button!==0)return;down=true;dragged=false;startX=lastX=event.clientX;startOffset=0;lastTime=performance.now();velocity=0;viewport.classList.add('is-dragging');viewport.setPointerCapture?.(event.pointerId);});
  viewport.addEventListener('pointermove',event=>{if(!down)return;const now=performance.now();const dx=event.clientX-lastX;velocity=dx/Math.max(1,now-lastTime);lastX=event.clientX;lastTime=now;startOffset=event.clientX-startX;if(Math.abs(startOffset)>8)dragged=true;layout(startOffset);});
  const release=event=>{if(!down)return;down=false;viewport.classList.remove('is-dragging');viewport.releasePointerCapture?.(event.pointerId);if(dragged)finish(startOffset);else{velocity=0;startOffset=0;layout(0);suppress=0;}};
  viewport.addEventListener('pointerup',release);viewport.addEventListener('pointercancel',release);
  viewport.addEventListener('wheel',event=>{if(Math.abs(event.deltaX)>Math.abs(event.deltaY)){event.preventDefault();go(index+(event.deltaX>0?1:-1));}},{passive:false});
  const onResize=()=>layout(0);addEventListener('resize',onResize,{passive:true});
  requestAnimationFrame(()=>go(index,false));
  return {element:root,get activePlanet(){return planets[index];},go,destroy(){removeEventListener('resize',onResize);}};
}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
