const CACHE='our-universe-v4-2-database-music-player';
const SHELL=[
  './','./index.html','./404.html','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png',
  './css/tokens.css','./css/base.css','./css/layout.css','./css/components.css','./css/animations.css','./css/responsive.css','./css/readability.css','./css/memory-experience.css','./css/notifications.css','./css/v4-universe.css','./css/database-music-player.css',
  './js/bootstrap-fallback.js','./js/app.js','./js/config.js','./js/core/pwa.js','./js/core/performance.js','./js/core/router.js','./js/core/repository.js','./js/core/storage.js','./js/core/screenshot.js','./js/core/notifications.js','./js/components/profile-menu.js','./js/components/planet-deck.js','./js/components/planet-composer.js','./js/components/story-composer.js','./js/components/rebuild-gate.js','./js/components/database-music-player.js','./js/universe/galaxy-engine.js','./js/worlds/planet.js','./js/worlds/settings.js','./music/romantic-chime.wav','./images/paper-texture.svg','./images/nebula-blue.svg','./images/nebula-rose.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.hostname.endsWith('.supabase.co')||url.protocol==='wss:'||event.request.method!=='GET')return;
  if(url.origin!==self.location.origin)return;
  if(event.request.destination==='script'||event.request.destination==='style'){
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request).then(cached=>cached||fetch(event.request,{cache:'reload'}).then(response=>{
      if(response.ok)cache.put(event.request,response.clone());
      return response;
    }))));
    return;
  }
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok&&url.origin===location.origin){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  })));
});

self.addEventListener('push',event=>{
  const fallback={
    title:'✦ Kabar dari semesta kalian',
    body:'Sebuah bintang baru saja menyala.',
    icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',url:'./#activity',
    tag:'our-universe-update',event_type:'update'
  };
  let payload=fallback;
  try{payload={...fallback,...(event.data?.json()||{})};}catch{}
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const visible=windows.find(client=>client.visibilityState==='visible');
    if(visible){
      visible.postMessage({type:'ROMANTIC_PUSH',payload});
      return;
    }
    await self.registration.showNotification(payload.title,{
      body:payload.body,
      icon:payload.icon||fallback.icon,
      badge:payload.badge||fallback.badge,
      tag:payload.tag||fallback.tag,
      data:{url:payload.url||fallback.url,entry_id:payload.entry_id||null,event_type:payload.event_type||'update'},
      renotify:true,
      requireInteraction:false,
      silent:false,
      vibrate:[90,55,140,70,190],
      actions:[{action:'open',title:'Buka semesta'},{action:'later',title:'Nanti'}]
    });
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  if(event.action==='later')return;
  const target=new URL(event.notification.data?.url||'./#activity',self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if('focus' in client){
        if('navigate' in client)await client.navigate(target).catch(()=>{});
        return client.focus();
      }
    }
    return self.clients.openWindow?self.clients.openWindow(target):undefined;
  })());
});

self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
