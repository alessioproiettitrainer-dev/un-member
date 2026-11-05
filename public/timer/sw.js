// UN-TIMER: tutto in cache, così il timer funziona anche senza rete (palestra, parco).
// Si prende prima dalla rete (versione nuova), se non c'è si usa la copia salvata.
const C = 'untimer-v1';
const FILES = ['/timer/', '/timer/timer.css', '/timer/timer.js', '/timer/manifest.json', '/timer/icon.svg', '/timer/icon-192.png'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(FILES))); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('untimer') && k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || (u.origin === location.origin && !u.pathname.startsWith('/timer/') && u.pathname !== '/nosleep.mp4')) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && (u.origin === location.origin || u.hostname.includes('fonts.g'))) { const cp = r.clone(); caches.open(C).then((c) => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || Response.error())));
});
