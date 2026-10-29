// Service worker: rende l'app installabile. I dati arrivano sempre dal server (niente cache),
// tranne la pagina "Stiamo lavorando per voi", mostrata quando il server si sta aggiornando (errore 502/503/504).
const PAGE = '/lavori.html';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open('lavori-v2').then((c) => c.add(PAGE))); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return; // solo l'apertura delle pagine
  e.respondWith(fetch(e.request).then((r) => (r.status >= 502 && r.status <= 504 ? caches.match(PAGE).then((p) => p || r) : r))
    .catch(() => caches.match(PAGE).then((p) => p || Response.error())));
});
