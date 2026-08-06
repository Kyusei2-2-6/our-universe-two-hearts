const CACHE='our-universe-v4-9-4-replay-cinema-runtime';
const STATIC_CACHE=`${CACHE}-static`;
const PAGE_CACHE=`${CACHE}-pages`;
const SHELL=[
  './','./index.html','./404.html','./refresh-494.html','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png',
  './css/tokens.css','./css/base.css','./css/layout.css','./css/components.css','./css/animations.css','./css/responsive.css','./css/readability.css','./css/memory-experience.css','./css/notifications.css','./css/v4-universe.css','./css/mobile-solid-ui.css','./css/database-music-player.css','./css/v4.3-lightspeed-connect.css','./css/v4.4-couple-map-calendar.css','./css/our-bond.css','./css/planet-profile.css','./css/love-timeline-stats.css','./css/v4.8-cinematic-polish.css','./css/v4.8.1-living-home.css','./css/v4.9-cosmic-identity-journey.css',
  './js/bootstrap-fallback.js','./js/app.js','./js/config.js','./js/core/pwa.js','./js/core/performance.js','./js/core/router.js','./js/core/repository.js','./js/core/storage.js','./js/core/screenshot.js','./js/core/notifications.js','./js/core/data-mode.js','./js/core/content-feed.js','./js/components/profile-menu.js','./js/components/planet-deck.js','./js/components/planet-composer.js','./js/components/story-composer.js','./js/components/rebuild-gate.js','./js/components/database-music-player.js','./js/components/entry-card.js','./js/components/planet-profile-tile.js','./js/components/memory-viewer.js','./js/features/pwa-install.js','./js/features/couple-connect.js','./js/features/couple-location-map.js','./js/features/couple-calendar.js','./js/features/our-bond.js','./js/features/heartbeat-engine.js','./js/features/memory-replay.js','./js/features/love-cinema.js','./js/features/secret-room.js','./js/features/love-timeline.js','./js/features/relationship-stats.js','./js/features/cinematic-polish.js','./js/features/living-home.js','./js/universe/galaxy-engine.js','./js/worlds/planet.js','./js/worlds/settings.js','./images/paper-texture.svg','./images/nebula-blue.svg','./images/nebula-rose.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(STATIC_CACHE);
    await Promise.allSettled(SHELL.map(async url=>{
      const request=new Request(url,{cache:'reload'});
      const response=await fetch(request);
      if(response.ok)await cache.put(request,response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keep=new Set([STATIC_CACHE,PAGE_CACHE]);
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('our-universe-')&&!keep.has(key)).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||request.headers.has('range'))return;
  const url=new URL(request.url);
  if(url.hostname.endsWith('.supabase.co')||url.protocol==='wss:'||url.origin!==self.location.origin)return;
  if(['video','audio'].includes(request.destination))return;
  if(request.mode==='navigate'){
    event.respondWith(networkFirstPage(request));
    return;
  }
  if(['script','style','worker','font','image'].includes(request.destination)){
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstPage(request){
  const cache=await caches.open(PAGE_CACHE);
  try{
    const response=await fetch(request,{cache:'no-cache'});
    if(response.ok)await cache.put('./index.html',response.clone());
    return response;
  }catch{
    return(await cache.match('./index.html'))||(await caches.match('./index.html'))||Response.error();
  }
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(STATIC_CACHE);
  const cached=await cache.match(request,{ignoreSearch:true});
  const network=fetch(request,{cache:'no-cache'}).then(async response=>{
    if(response.ok&&response.type==='basic')await cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  if(cached){eventually(network);return cached;}
  return(await network)||Response.error();
}

function eventually(promise){promise.catch(()=>{});}

self.addEventListener('push',event=>{
  const fallback={title:'✦ Kabar dari semesta kalian',body:'Sebuah bintang baru saja menyala.',icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',url:'./#activity',tag:'our-universe-update',event_type:'update'};
  let payload=fallback;
  try{payload={...fallback,...(event.data?.json()||{})};}catch{}
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const visible=windows.find(client=>client.visibilityState==='visible');
    if(visible){visible.postMessage({type:'ROMANTIC_PUSH',payload});return;}
    await self.registration.showNotification(payload.title,{
      body:payload.body,icon:payload.icon||fallback.icon,badge:payload.badge||fallback.badge,tag:payload.tag||fallback.tag,
      data:{url:payload.url||fallback.url,entry_id:payload.entry_id||null,message_id:payload.message_id||null,event_type:payload.event_type||'update'},
      renotify:true,requireInteraction:false,silent:false,vibrate:[90,55,140,70,190],
      actions:[{action:'open',title:'Buka semesta'},{action:'later',title:'Nanti'}]
    });
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();if(event.action==='later')return;
  const target=new URL(event.notification.data?.url||'./#activity',self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if('focus'in client){if('navigate'in client)await client.navigate(target).catch(()=>{});return client.focus();}
    }
    return self.clients.openWindow?self.clients.openWindow(target):undefined;
  })());
});

self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
