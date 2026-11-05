// UN-TIMER: tutto in cache, così il timer funziona anche senza rete (palestra, parco).
// Prima la rete (versione nuova), se non c'è la copia salvata.
const C = 'untimer-v2';
const FILES = ['./', 'timer.css', 'timer.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'nosleep.mp4'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(FILES))); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || !(u.origin === location.origin || u.hostname.startsWith('fonts.g'))) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const cp = r.clone(); caches.open(C).then((c) => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || Response.error())));
});
