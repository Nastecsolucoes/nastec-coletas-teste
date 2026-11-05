const CACHE='nastec-coletas-oficial-07-static-v1';
const ATIVOS=['./','./index.html','./app.js','./manifesto.webmanifest','./ícone.svg','./os-fichas-06.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 e.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});
