// Service worker minimo: rende l'app installabile. Niente cache: i dati arrivano sempre dal server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
