const CACHE='our-universe-two-hearts-v8-cinematic-memory';
const SHELL=[
  './','./index.html','./404.html','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png',
  './css/tokens.css','./css/base.css','./css/layout.css','./css/components.css','./css/animations.css','./css/responsive.css','./css/readability.css','./css/cosmic-orbits.css','./css/cinematic-memory.css',
  './js/bootstrap-fallback.js','./js/app.js','./js/config.js','./js/core/screenshot.js','./images/paper-texture.svg','./images/nebula-blue.svg','./images/nebula-rose.svg'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.hostname.endsWith('.supabase.co')||url.protocol==='wss:'||event.request.method!=='GET')return;
  if(event.request.destination==='script'||event.request.destination==='style'){event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));return;}
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response;}).catch(()=>caches.match('./index.html')));return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok&&url.origin===location.origin){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;})));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
