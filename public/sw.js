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
// notifiche push: promemoria allenamento e messaggi (le manda il server, vedi pushTick in server.js)
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'UN-MEMBER', body: e.data?.text() || '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'UN-MEMBER', { body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag, data: { url: d.url || '/#/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/#/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.location.origin));
    if (c) { c.navigate?.(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
