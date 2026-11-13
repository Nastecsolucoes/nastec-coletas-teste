// NASTEC Coletas - correcao do cache offline; sem alteracao de dados locais.
const CACHE = 'nastec-coletas-offline-20261113-v1';
const ASSETS = ['./', './index.html', './app.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('nastec-coletas-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try { return await fetch(req); } catch (error) {
      if (req.mode === 'navigate') {
        const page = await caches.match('./index.html');
        if (page) return page;
      }
      throw error;
    }
  })());
});
