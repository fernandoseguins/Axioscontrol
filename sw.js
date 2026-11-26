// Service worker: deixa o app abrir sem internet (ex.: na rede Wi-Fi do mixer).
const CACHE = 'duon24-v5';
const FILES = [
  './', './index.html', './css/app.css', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './js/main.js', './js/state.js', './js/transport.js', './js/ui.js', './js/levels.js', './js/eq.js', './js/spectrum.js', './js/db.js', './js/axios-protocol.js', './js/nav.js',
  './js/views/mixer.js', './js/views/channel.js', './js/views/fx.js', './js/views/scenes.js', './js/views/routing.js',
  './js/views/tools.js', './js/views/system.js', './js/views/musician.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Rede primeiro (pega atualizações), cache como reserva offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});
