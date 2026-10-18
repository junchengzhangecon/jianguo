const CACHE='jianguo-pixel-v1.3.0';
const FILES=['./','index.html','styles.css','core.js','emoji-data.js','emoji.js','display.js','wake.js','app.js','assets/pixel.woff2','assets/naiwa.webp','assets/wake.webm','assets/wake.mp4','assets/icon.svg','assets/icon-192.png','assets/icon-512.png','manifest.webmanifest','坚果像素屏-离线版.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('jianguo-pixel-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();for(const client of await self.clients.matchAll())client.postMessage({offlineReady:true});})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);const hit=await cache.match(event.request,{ignoreSearch:true});if(hit)return hit;try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return cache.match(new URL('index.html',self.registration.scope).href);throw error;}})());
});
