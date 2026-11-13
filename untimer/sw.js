// UN-TIMER: tutto in cache, così il timer funziona anche senza rete (palestra, parco).
// Prima la rete (versione nuova), se non c'è la copia salvata.
const C = 'untimer-v13';
const FILES = ['./', 'privacy.html', 'timer.css', 'timer.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'nosleep.mp4'];
// voce inglese (file generati): salvati subito, così funziona anche senza internet
const EN = ["afap-1","afap-2","afap-3","esfatto-1","esfatto-2","esfatto-3","esultimo-1","esultimo-2","fine-1","fine-2","fine-3","fine-4","giro-1","giro-2","giro-3","giroemom-1","giroemom-2","giroemom-3","km-1","km-2","km-3","lavoro-1","lavoro-2","lavoro-3","lento-1","lento-2","lento-3","meta-1","meta-2","meta-3","min1-1","min1-2","min1-3","pausa-1","pausa-2","pronti-1","pronti-2","pronti-3","recupero-1","recupero-2","recupero-3","riparte-1","riparte-2","riparte-3","riprendi-1","riprendi-2","sec10-1","sec10-2","sec10-3","sec10-4","sec10-5","serie-1","serie-2","ultimo-1","ultimo-2","ultimo-3","ungiro-1","ungiro-2","ungiro-3","veloce-1","veloce-2","via-1","via-2","via-3"];
FILES.push(...EN.map((id) => `voce/en/${id}.mp3`));
// voce romana di Alessio
const RM = ["afap-1","afap-2","afap-3","conto-1","conto-2","conto-3","esfatto-1","esfatto-2","esfatto-3","esultimo-1","esultimo-2","fine-1","fine-2","fine-3","fine-4","giro-1","giro-2","giro-3","giroemom-1","giroemom-2","giroemom-3","lavoro-1","lavoro-2","lavoro-3","lento-1","lento-2","lento-3","meta-1","meta-2","meta-3","min1-1","min1-2","min1-3","pausa-1","pausa-2","pronti-1","pronti-2","pronti-3","recupero-1","recupero-2","recupero-3","riprendi-1","riprendi-2","sec10-1","sec10-2","sec10-3","serie-1","serie-2","ultimo-1","ultimo-2","ultimo-3","ungiro-1","ungiro-2","ungiro-3","veloce-1","veloce-2","via-1","via-2","via-3"];
FILES.push(...RM.map((id) => `voce/${id}.mp3`));
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
