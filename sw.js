// NASTEC Coletas: atualizacao online prioritária, operacao offline preservada.
// A troca do cache NAO remove IndexedDB (OS, registros, fotos, rascunhos).
const CACHE = 'nastec-coletas-offline-20261113-v3';
const ASSETS = ['./', './index.html', './app.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('nastec-coletas-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(req, {cache: 'no-store'});
      if (fresh.ok) await cache.put(req, fresh.clone());
      return fresh;
    } catch (error) {
      const cached = await cache.match(req, {ignoreSearch: true});
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const page = await cache.match('./index.html');
        if (page) return page;
      }
      throw error;
    }
  })());
});
